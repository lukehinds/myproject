import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.db import Base, engine
from app.routes import router

Base.metadata.create_all(bind=engine)

os.makedirs("web", exist_ok=True)

app = FastAPI(title="ToDo API")

app.include_router(router)

@app.get("/")
def serve_index():
    # If the frontend agent hasn't created it yet, this might return an error when accessed, 
    # but it will serve it correctly once created.
    return FileResponse("web/index.html")

app.mount("/", StaticFiles(directory="web"), name="web")
