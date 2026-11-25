import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield

def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_create_todo_happy_path():
    response = client.post("/api/todos", json={"title": "Buy milk", "notes": "Oat", "priority": "high", "due_date": "2026-11-30"})
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Buy milk"
    assert data["notes"] == "Oat"
    assert data["priority"] == "high"
    assert data["due_date"] == "2026-11-30"
    assert data["completed"] is False
    assert "id" in data
    assert "created_at" in data
    assert data["created_at"].endswith("Z")
    assert "updated_at" in data
    assert data["updated_at"].endswith("Z")

def test_create_todo_rejected_completed():
    response = client.post("/api/todos", json={"title": "Buy milk", "completed": True})
    assert response.status_code == 422

def test_create_todo_validation():
    # Empty title
    assert client.post("/api/todos", json={"title": ""}).status_code == 422
    # Whitespace title
    assert client.post("/api/todos", json={"title": "   "}).status_code == 422
    # Title too long
    assert client.post("/api/todos", json={"title": "A" * 201}).status_code == 422
    # Notes too long
    assert client.post("/api/todos", json={"title": "A", "notes": "A" * 2000}).status_code == 201
    assert client.post("/api/todos", json={"title": "A", "notes": "A" * 2001}).status_code == 422
    # Bad priority
    assert client.post("/api/todos", json={"title": "A", "priority": "super-high"}).status_code == 422
    # Bad date
    assert client.post("/api/todos", json={"title": "A", "due_date": "not-a-date"}).status_code == 422

def test_get_todo():
    r1 = client.post("/api/todos", json={"title": "Test"})
    t_id = r1.json()["id"]
    r2 = client.get(f"/api/todos/{t_id}")
    assert r2.status_code == 200
    assert r2.json()["title"] == "Test"

def test_get_todo_404():
    assert client.get("/api/todos/999").status_code == 404

def test_update_todo_omitted_vs_null():
    r1 = client.post("/api/todos", json={"title": "T1", "notes": "Some notes", "due_date": "2026-01-01"})
    t_id = r1.json()["id"]
    updated_at_initial = r1.json()["updated_at"]

    time.sleep(0.01) # ensure a small delay for updated_at
    # Omitted -> untouched
    r2 = client.patch(f"/api/todos/{t_id}", json={"title": "T2"})
    assert r2.status_code == 200
    data = r2.json()
    assert data["title"] == "T2"
    assert data["notes"] == "Some notes"
    assert data["due_date"] == "2026-01-01"
    assert data["updated_at"] > updated_at_initial
    
    updated_at_second = data["updated_at"]
    time.sleep(0.01)
    
    # Explicit null -> cleared
    r3 = client.patch(f"/api/todos/{t_id}", json={"notes": None, "due_date": None})
    assert r3.status_code == 200
    data = r3.json()
    assert data["notes"] is None
    assert data["due_date"] is None
    assert data["updated_at"] > updated_at_second

def test_update_todo_empty_body():
    r1 = client.post("/api/todos", json={"title": "T1", "notes": "Some notes"})
    t_id = r1.json()["id"]
    updated_at_initial = r1.json()["updated_at"]
    
    time.sleep(0.01)
    
    # Empty body -> untouched
    r4 = client.patch(f"/api/todos/{t_id}", json={})
    assert r4.status_code == 200
    data = r4.json()
    assert data["title"] == "T1"
    assert data["notes"] == "Some notes"
    assert data["due_date"] is None
    # No changes were made, so updated_at should remain the same
    assert data["updated_at"] == updated_at_initial

def test_update_todo_404():
    assert client.patch("/api/todos/999", json={"title": "A"}).status_code == 404

def test_delete_todo():
    r1 = client.post("/api/todos", json={"title": "T1"})
    t_id = r1.json()["id"]
    r2 = client.delete(f"/api/todos/{t_id}")
    assert r2.status_code == 204
    assert client.get(f"/api/todos/{t_id}").status_code == 404

def test_delete_todo_404():
    assert client.delete("/api/todos/999").status_code == 404

def test_clear_completed():
    client.post("/api/todos", json={"title": "T1"})
    r2 = client.post("/api/todos", json={"title": "T2"})
    client.patch(f"/api/todos/{r2.json()['id']}", json={"completed": True})
    
    res = client.post("/api/todos/clear-completed")
    assert res.status_code == 200
    assert res.json() == {"deleted": 1}

    todos = client.get("/api/todos").json()
    assert len(todos) == 1
    assert todos[0]["title"] == "T1"

def test_ordering():
    # Create unordered
    # We want: incomplete first, then high > normal > low, then created_at DESC
    
    # 1. incomplete, normal, created first
    t1 = client.post("/api/todos", json={"title": "T1", "priority": "normal"}).json()
    time.sleep(0.01)
    
    # 2. complete, high
    t2 = client.post("/api/todos", json={"title": "T2", "priority": "high"}).json()
    client.patch(f"/api/todos/{t2['id']}", json={"completed": True})
    time.sleep(0.01)
    
    # 3. incomplete, high, created later
    t3 = client.post("/api/todos", json={"title": "T3", "priority": "high"}).json()
    time.sleep(0.01)
    
    # 4. incomplete, low
    t4 = client.post("/api/todos", json={"title": "T4", "priority": "low"}).json()
    time.sleep(0.01)

    # 5. incomplete, high, created even later
    t5 = client.post("/api/todos", json={"title": "T5", "priority": "high"}).json()

    # Order should be:
    # Incomplete first:
    #   High: t5 (newer), t3 (older)
    #   Normal: t1
    #   Low: t4
    # Then complete:
    #   High: t2
    
    todos = client.get("/api/todos").json()
    assert [t["id"] for t in todos] == [t5["id"], t3["id"], t1["id"], t4["id"], t2["id"]]
