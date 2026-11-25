# ToDo

A small, single-user ToDo application: a FastAPI + SQLite backend and a
no-build-step frontend of vanilla HTML, modern CSS and ES modules. One server
process serves both, so the whole app starts with a single command.

## Requirements

Nothing to install by hand. This repository is a nono Nix workspace
(`.nono-workspace.json`), so `uv` is already on `PATH`; `uv` fetches Python
3.12 and the project's dependencies from `uv.lock` on first run.

## Run it

```sh
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then open <http://127.0.0.1:8000/>.

The SQLite database is created automatically at `./todos.db` on first start.
It is gitignored — delete the file to reset the app to empty.

## Test it

```sh
uv run pytest          # the backend test suite
uv run ruff check .    # lint
```

## How it fits together

| Path | What it is |
|---|---|
| `app/` | FastAPI application: models, schemas, routes, database setup |
| `tests/` | pytest suite covering every endpoint |
| `web/` | the frontend — `index.html`, `styles.css`, `app.js`, served as static files |
| `docs/API_CONTRACT.md` | the binding API contract both halves were built against |
| `pyproject.toml`, `uv.lock` | dependency manifest and lockfile |

The REST API lives under `/api` and is documented in full in
[`docs/API_CONTRACT.md`](docs/API_CONTRACT.md). FastAPI also publishes
interactive docs at <http://127.0.0.1:8000/docs> while the server is running.

## Scope and limits

This is a local, single-user app by design: there is no authentication, no
multi-user separation, and the server is meant to be bound to `127.0.0.1`.
Do not expose it to a network without adding both.
