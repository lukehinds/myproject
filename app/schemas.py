from datetime import UTC, date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_serializer

Priority = Literal["low", "normal", "high"]

TitleStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]

class TodoBase(BaseModel):
    title: TitleStr
    notes: str | None = Field(default=None, max_length=2000)
    priority: Priority = "normal"
    due_date: date | None = None

class TodoCreate(TodoBase):
    model_config = ConfigDict(extra="forbid")

class TodoUpdate(BaseModel):
    title: TitleStr | None = None
    notes: str | None = Field(default=None, max_length=2000)
    completed: bool | None = None
    priority: Priority | None = None
    due_date: date | None = None

    model_config = ConfigDict(extra="forbid")

class TodoRead(BaseModel):
    id: int
    title: str
    notes: str | None
    completed: bool
    priority: Priority
    due_date: date | None
    created_at: datetime
    updated_at: datetime
    
    @field_serializer("created_at", "updated_at")
    def serialize_datetime(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.isoformat().replace("+00:00", "Z")

    model_config = ConfigDict(from_attributes=True)
