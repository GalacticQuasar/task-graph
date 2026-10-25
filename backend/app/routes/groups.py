from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.db import get_session
from app.models import Group, GroupCreate, GroupRead, GroupUpdate

router = APIRouter(prefix="/groups", tags=["groups"])


def _get_group(session: Session, group_id: int) -> Group:
    group = session.get(Group, group_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "group not found")
    return group


def _commit(session: Session, group: Group) -> Group:
    session.add(group)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "group name already exists")
    session.refresh(group)
    return group


@router.get("", response_model=list[GroupRead])
def list_groups(session: Session = Depends(get_session)):
    return session.exec(select(Group).order_by(Group.name)).all()


@router.post("", response_model=GroupRead, status_code=status.HTTP_201_CREATED)
def create_group(body: GroupCreate, session: Session = Depends(get_session)):
    return _commit(session, Group.model_validate(body))


@router.patch("/{group_id}", response_model=GroupRead)
def update_group(group_id: int, body: GroupUpdate, session: Session = Depends(get_session)):
    group = _get_group(session, group_id)
    group.sqlmodel_update(body.model_dump(exclude_unset=True))
    return _commit(session, group)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, session: Session = Depends(get_session)):
    session.delete(_get_group(session, group_id))
    session.commit()
