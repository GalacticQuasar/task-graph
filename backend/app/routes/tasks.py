from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, col, select

from app import graph
from app.db import get_session
from app.graph import View
from app.models import Group, Task, TaskCreate, TaskRead, TaskUpdate, utcnow

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _get_task(session: Session, task_id: int) -> Task:
    task = session.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "task not found")
    return task


def _load_groups(session: Session, group_ids: list[int]) -> list[Group]:
    groups = session.exec(select(Group).where(col(Group.id).in_(group_ids))).all()
    if len(groups) != len(set(group_ids)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown group id")
    return list(groups)


def _set_parent(session: Session, task: Task, parent_id: int | None) -> None:
    if task.id is not None and parent_id == task.parent_id:
        return
    try:
        if task.id is not None:
            graph.check_reparent(session, task.id, parent_id)
        elif parent_id is not None and session.get(Task, parent_id) is None:
            raise LookupError
    except graph.CycleError as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e))
    except LookupError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "parent task not found")
    task.parent_id = parent_id
    task.position = graph.next_position(session, parent_id)


@router.get("", response_model=list[TaskRead])
def list_tasks(
    view: View = View.ACTIONABLE,
    group: int | None = None,
    session: Session = Depends(get_session),
):
    return [TaskRead.from_task(t) for t in graph.list_tasks(session, view, group)]


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(body: TaskCreate, session: Session = Depends(get_session)):
    task = Task(title=body.title, notes=body.notes, due_date=body.due_date)
    _set_parent(session, task, body.parent_id)
    task.groups = _load_groups(session, body.group_ids)
    session.add(task)
    session.commit()
    session.refresh(task)
    return TaskRead.from_task(task)


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, session: Session = Depends(get_session)):
    return TaskRead.from_task(_get_task(session, task_id))


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, body: TaskUpdate, session: Session = Depends(get_session)):
    task = _get_task(session, task_id)
    changes = body.model_dump(exclude_unset=True)
    if "parent_id" in changes:
        _set_parent(session, task, changes.pop("parent_id"))
    if "group_ids" in changes:
        task.groups = _load_groups(session, changes.pop("group_ids") or [])
    for key, value in changes.items():
        setattr(task, key, value)
    session.add(task)
    session.commit()
    session.refresh(task)
    return TaskRead.from_task(task)


@router.post("/{task_id}/complete", response_model=TaskRead)
def complete_task(task_id: int, session: Session = Depends(get_session)):
    task = _get_task(session, task_id)
    if task.completed_at is None:
        task.completed_at = utcnow()
        session.add(task)
        session.commit()
        session.refresh(task)
    return TaskRead.from_task(task)


@router.post("/{task_id}/uncomplete", response_model=TaskRead)
def uncomplete_task(task_id: int, session: Session = Depends(get_session)):
    task = _get_task(session, task_id)
    task.completed_at = None
    session.add(task)
    session.commit()
    session.refresh(task)
    return TaskRead.from_task(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, session: Session = Depends(get_session)):
    graph.delete_task(session, _get_task(session, task_id))
    session.commit()
