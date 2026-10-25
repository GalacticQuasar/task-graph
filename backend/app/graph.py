"""Forest semantics: which tasks are actionable, safe re-parenting, splice-on-delete.

Edges mean "comes after", not a hard block: any task can be completed at any time.
A task is actionable when it is open and its parent (if any) is done.
"""

from enum import StrEnum

from sqlalchemy.orm import aliased
from sqlmodel import Session, col, func, select

from app.models import Task, TaskGroup


class View(StrEnum):
    ACTIONABLE = "actionable"
    ALL = "all"
    INBOX = "inbox"
    COMPLETED = "completed"


class CycleError(ValueError):
    pass


def list_tasks(session: Session, view: View, group_id: int | None = None) -> list[Task]:
    stmt = select(Task)
    if view is View.COMPLETED:
        stmt = stmt.where(col(Task.completed_at).is_not(None)).order_by(
            col(Task.completed_at).desc()
        )
    else:
        stmt = stmt.where(col(Task.completed_at).is_(None))
        if view is View.ACTIONABLE:
            parent = aliased(Task)
            stmt = stmt.outerjoin(parent, col(Task.parent_id) == parent.id).where(
                col(Task.parent_id).is_(None) | col(parent.completed_at).is_not(None)
            )
        elif view is View.INBOX:
            has_group = select(TaskGroup.task_id).where(TaskGroup.task_id == Task.id)
            stmt = stmt.where(col(Task.parent_id).is_(None), ~has_group.exists())
        stmt = stmt.order_by(
            col(Task.due_date).is_(None), col(Task.due_date), col(Task.position), col(Task.created_at)
        )
    if group_id is not None:
        stmt = stmt.where(
            select(TaskGroup.task_id)
            .where(TaskGroup.task_id == Task.id, TaskGroup.group_id == group_id)
            .exists()
        )
    return list(session.exec(stmt).all())


def is_actionable(session: Session, task: Task) -> bool:
    if task.completed_at is not None:
        return False
    if task.parent_id is None:
        return True
    parent = session.get(Task, task.parent_id)
    return parent is not None and parent.completed_at is not None


def check_reparent(session: Session, task_id: int, new_parent_id: int | None) -> None:
    """Raise CycleError if making new_parent_id the parent of task_id would form a cycle."""
    current = new_parent_id
    while current is not None:
        if current == task_id:
            raise CycleError(f"task {new_parent_id} is task {task_id} or one of its descendants")
        node = session.get(Task, current)
        if node is None:
            raise LookupError(f"parent task {current} not found")
        current = node.parent_id


def next_position(session: Session, parent_id: int | None) -> int:
    # `== None` compiles to IS NULL, so this also covers roots.
    stmt = select(func.max(Task.position)).where(Task.parent_id == parent_id)
    current = session.exec(stmt).one()
    return 0 if current is None else current + 1


def delete_task(session: Session, task: Task) -> None:
    """Delete a task, re-attaching its children to its parent so the chain stays intact."""
    children = session.exec(select(Task).where(Task.parent_id == task.id)).all()
    for child in children:
        child.parent_id = task.parent_id
        session.add(child)
    session.flush()
    session.delete(task)
