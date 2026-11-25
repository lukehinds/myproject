from datetime import UTC, date, datetime
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Priority(str, Enum):
    low = "low"
    normal = "normal"
    high = "high"

def utcnow() -> datetime:
    return datetime.now(UTC)

class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    priority: Mapped[Priority] = mapped_column(SQLEnum(Priority), default=Priority.normal, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
