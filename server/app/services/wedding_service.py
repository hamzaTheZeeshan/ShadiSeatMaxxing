import uuid

from sqlalchemy.orm import Session

from app.models.wedding import Wedding
from app.repositories import wedding_repo
from app.schemas.wedding import WeddingCreate
from app.services.errors import NotFoundError


def create_wedding(db: Session, owner_id: uuid.UUID, data: WeddingCreate) -> Wedding:
    return wedding_repo.create(db, owner_id=owner_id, name=data.name, event_date=data.event_date)


def get_wedding(db: Session, owner_id: uuid.UUID, wedding_id: uuid.UUID) -> Wedding:
    wedding = wedding_repo.get_owned(db, wedding_id, owner_id)
    if wedding is None:
        raise NotFoundError("Wedding")
    return wedding