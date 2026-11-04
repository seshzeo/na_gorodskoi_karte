from app.backend.schemas.common import ORMModel


class CategoryRead(ORMModel):
    id: int
    name: str
    slug: str
