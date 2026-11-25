# ToDo app — architecture & API contract

Authored by the **lead**. Backend and frontend build against this in parallel.
If you need a change to this contract, ask the lead — do not change it unilaterally.

## Stack (lead decision)

- **Backend:** Python 3.12 + FastAPI + SQLAlchemy 2.0 ORM + SQLite.
- **Frontend:** vanilla HTML + modern CSS + ES modules. **No build step.**
- **Dependencies:** managed by `uv` via `pyproject.toml` + `uv.lock` (both committed).
- **One server:** FastAPI serves the API *and* the static frontend, so the whole
  app runs from a single command. No separate dev server, no proxy.

## Repository layout and file ownership

| Path | Owner | Notes |
|---|---|---|
| `pyproject.toml`, `uv.lock` | backend | dependency manifest + lockfile |
| `app/**` | backend | FastAPI application package |
| `tests/**` | backend | pytest suite |
| `web/index.html` | frontend | markup |
| `web/styles.css` | frontend | all styling |
| `web/app.js` | frontend | all behaviour |
| `docs/**`, `README.md` | lead | coordination + run instructions |

Do not edit files you do not own. `crew claim <path>` before you start.

## Run command (must work exactly as written)

```sh
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```

`http://127.0.0.1:8000/` must serve the app UI. `uv run pytest` must run the tests.

## Resource shape

A `Todo` is serialised as:

```json
{
  "id": 1,
  "title": "Buy milk",
  "notes": "Oat, not dairy",
  "completed": false,
  "priority": "normal",
  "due_date": "2026-11-30",
  "created_at": "2026-11-25T20:40:00Z",
  "updated_at": "2026-11-25T20:40:00Z"
}
```

- `id` — integer, server-assigned.
- `title` — string, **required**, 1–200 chars after stripping whitespace.
- `notes` — string or `null`, max 2000 chars.
- `completed` — boolean, defaults `false`.
- `priority` — one of `"low" | "normal" | "high"`, defaults `"normal"`.
- `due_date` — ISO-8601 date (`YYYY-MM-DD`) or `null`.
- `created_at` / `updated_at` — ISO-8601 UTC timestamps, server-managed.

## Endpoints

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| `GET` | `/api/health` | — | `200 {"status":"ok"}` | — |
| `GET` | `/api/todos` | — | `200 [Todo, ...]` | — |
| `POST` | `/api/todos` | `TodoCreate` | `201 Todo` | `422` |
| `GET` | `/api/todos/{id}` | — | `200 Todo` | `404` |
| `PATCH` | `/api/todos/{id}` | `TodoUpdate` | `200 Todo` | `404`, `422` |
| `DELETE` | `/api/todos/{id}` | — | `204` no body | `404` |
| `POST` | `/api/todos/clear-completed` | — | `200 {"deleted": 3}` | — |

- `TodoCreate`: `title` required; `notes`, `priority`, `due_date` optional.
  `completed` is **rejected** on create.
- `TodoUpdate`: every field optional (`title`, `notes`, `completed`,
  `priority`, `due_date`). Omitted fields are left untouched; explicit `null`
  clears `notes` / `due_date`. An empty body is a no-op returning the todo.
- `GET /api/todos` ordering: incomplete before complete, then `high > normal > low`
  priority, then `created_at` descending. Frontend may re-sort for display but
  must not depend on any other server order.

## Error format

FastAPI default: `{"detail": "..."}` for 404s, and FastAPI's validation array
for 422s. Frontend must surface `detail` when it is a string. When `detail` is
FastAPI's validation array, surface the first entry's `msg`. Fall back to a
generic message otherwise.

> Amended by the lead after the frontend found that 422s were falling through
> to a generic message. The original contract only required the string case.

## Non-negotiables

- No secrets, no auth (single-user local app) — but **no raw SQL string
  interpolation** and no `eval`. Parameterised queries / ORM only.
- The SQLite file lives at `./todos.db` and is **gitignored**.
- Accessibility: keyboard operable, real labels, visible focus, correct ARIA
  for the checkbox/list semantics, and live-region announcements for changes.
- Styling must support light **and** dark via `prefers-color-scheme`.
