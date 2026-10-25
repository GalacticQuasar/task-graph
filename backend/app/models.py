from datetime import date, datetime, timezone

from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TaskGroup(SQLModel, table=True):
    __tablename__ = "task_group"

    task_id: int = Field(foreign_key="task.id", primary_key=True, ondelete="CASCADE")
    group_id: int = Field(foreign_key="groups.id", primary_key=True, ondelete="CASCADE")


class Group(SQLModel, table=True):
    __tablename__ = "groups"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    color: str = "#888888"

    tasks: list["Task"] = Relationship(back_populates="groups", link_model=TaskGroup)


class Task(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    notes: str = ""
    # Predecessor in the sequence; NULL means this task is a root.
    parent_id: int | None = Field(default=None, foreign_key="task.id", index=True)
    due_date: date | None = None
    position: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    completed_at: datetime | None = None

    groups: list[Group] = Relationship(back_populates="tasks", link_model=TaskGroup)


# --- API schemas ---


class GroupCreate(SQLModel):
    name: str
    color: str = "#888888"


class GroupUpdate(SQLModel):
    name: str | None = None
    color: str | None = None


class GroupRead(SQLModel):
    id: int
    name: str
    color: str


class TaskCreate(SQLModel):
    title: str
    notes: str = ""
    parent_id: int | None = None
    due_date: date | None = None
    group_ids: list[int] = []


class TaskUpdate(SQLModel):
    title: str | None = None
    notes: str | None = None
    parent_id: int | None = None
    due_date: date | None = None
    position: int | None = None
    group_ids: list[int] | None = None


class TaskRead(SQLModel):
    id: int
    title: str
    notes: str
    parent_id: int | None
    due_date: date | None
    position: int
    created_at: datetime
    completed_at: datetime | None
    group_ids: list[int]

    @classmethod
    def from_task(cls, task: Task) -> "TaskRead":
        return cls(
            **task.model_dump(exclude={"groups"}),
            group_ids=sorted(g.id for g in task.groups),
        )


class Capture(SQLModel):
    title: str
