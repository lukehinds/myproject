
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, delete, desc, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db

router = APIRouter(prefix="/api")

@router.get("/health")
def health_check():
    return {"status": "ok"}

@router.get("/todos", response_model=list[schemas.TodoRead])
def list_todos(db: Session = Depends(get_db)):
    priority_order = case(
        (models.Todo.priority == models.Priority.high, 3),
        (models.Todo.priority == models.Priority.normal, 2),
        (models.Todo.priority == models.Priority.low, 1),
        else_=0
    )
    stmt = select(models.Todo).order_by(
        models.Todo.completed.asc(),
        desc(priority_order),
        models.Todo.created_at.desc()
    )
    return list(db.scalars(stmt))

@router.post("/todos", response_model=schemas.TodoRead, status_code=status.HTTP_201_CREATED)
def create_todo(todo_in: schemas.TodoCreate, db: Session = Depends(get_db)):
    todo = models.Todo(**todo_in.model_dump())
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo

@router.get("/todos/{todo_id}", response_model=schemas.TodoRead)
def get_todo(todo_id: int, db: Session = Depends(get_db)):
    todo = db.get(models.Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo

@router.patch("/todos/{todo_id}", response_model=schemas.TodoRead)
def update_todo(todo_id: int, todo_in: schemas.TodoUpdate, db: Session = Depends(get_db)):
    todo = db.get(models.Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    
    update_data = todo_in.model_dump(exclude_unset=True)
    if update_data:
        for key, value in update_data.items():
            setattr(todo, key, value)
        db.commit()
        db.refresh(todo)
    return todo

@router.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    todo = db.get(models.Todo, todo_id)
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    db.delete(todo)
    db.commit()

@router.post("/todos/clear-completed")
def clear_completed(db: Session = Depends(get_db)):
    stmt = delete(models.Todo).where(models.Todo.completed == True)
    result = db.execute(stmt)
    db.commit()
    return {"deleted": result.rowcount}
