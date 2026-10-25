# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Task Graph: a single-user task app where tasks form sequences ("comes after") and the main screen shows only actionable tasks. FastAPI + SQLite backend (`backend/`, managed with uv), React + Vite + TS PWA frontend (`frontend/`). See README.md for deployment and phone setup.

## Commands

```sh
# backend (run from backend/)
uv run uvicorn app.main:app --reload            # API on :8000; auth disabled unless TASKGRAPH_TOKEN is set
uv run pytest                                   # all tests
uv run pytest tests/test_tasks.py::test_forks_promote_all_children   # single test

# frontend (run from frontend/)
npm run dev                                     # :5173, proxies /api to :8000 (override with TASKGRAPH_API)
npm run build                                   # tsc -b + vite build (type errors fail the build)
npm run lint                                    # oxlint

# full stack in one container (repo root)
docker build -t taskgraph . && docker run -p 8000:8000 -e TASKGRAPH_TOKEN=... -v taskgraph-data:/data taskgraph
```

For browser checks with playwright-cli, use `playwright-cli open --browser=chromium` (the default `chrome` channel isn't installed here).

## Core semantics (must stay consistent across both halves)

- Tasks form a **forest**: `task.parent_id` is the single predecessor (NULL = starts a sequence). Edges mean "comes after", not a hard block, so any task can be completed at any time.
- **Actionable** = open AND (no parent OR parent completed). This rule exists twice: `backend/app/graph.py` (`list_tasks`, `View.ACTIONABLE`) and `frontend/src/forest.ts` (`isActionable`). Change both together.
- **Inbox** is derived, not a flag: open, root, and no groups. So any task added without a group or parent shows in the Inbox.
- **Delete splices**: children are re-parented to the deleted task's parent (`graph.delete_task`).
- **Re-parent** rejects cycles. `graph.check_reparent` walks up from the new parent and the route returns 409. The frontend also hides invalid targets via `selfAndDescendants` (picker, tree drag, graph connect), but the server is the authority.
- Groups are tags (many-to-many through `task_group`), and edges cross groups freely.

## Backend architecture

- `app/routes/tasks.py` uses `graph.py` for all forest logic, so keep tree rules there where they can be unit-tested. In `_set_parent`, compute `next_position` *before* assigning `parent_id`; otherwise autoflush counts the task as its own sibling.
- PATCH uses `model_dump(exclude_unset=True)` so that an explicit `null` (e.g. detach `parent_id`, clear `due_date`) is different from "not sent".
- Schema comes from `SQLModel.metadata.create_all`, and there are **no migrations**. Model changes won't alter an existing `taskgraph.db`.
- Auth (`app/auth.py`): one shared secret, `TASKGRAPH_TOKEN`. It is accepted either as `Authorization: Bearer` or as the HttpOnly cookie set by `POST /api/login`, which holds an HMAC of the token. Task and group routers get `require_auth` at `include_router` time in `main.py`. `/api/health`, `/api/login` and `/api/logout` are public. `TASKGRAPH_REQUIRE_TOKEN=1` (set in the Dockerfile) makes startup fail without a token.
- Route order in `main.py` matters: the real routers come first, then an `/api/{path}` catch-all that returns 404, then (only if `TASKGRAPH_STATIC` is set) `mount_frontend`'s SPA catch-all, which serves `index.html` for unknown paths such as `/share`.
- Tests: the `client` fixture overrides `get_session` with an in-memory StaticPool engine and deliberately does **not** enter `TestClient` as a context manager, so the lifespan (real DB, `check_config`) never runs. An autouse fixture clears the auth env vars, and auth tests opt in with `monkeypatch.setenv`.

## Frontend architecture

- **Data:** `api.ts` holds the fetch wrapper plus all TanStack Query hooks. Every task query key starts with `'tasks'` (including the single-task `['tasks', 'one', id]`), so mutations simply invalidate `['tasks']`. Delete removes its own single-task query first, to avoid a 404 refetch.
- **Forest on the client:** views fetch `view=all` (every open task, unfiltered) through `useForest()`, then derive heads, nesting, "then …" hints and group filtering on the client. This lets hints work when a predecessor sits in another group. The server's `actionable`/`inbox` views exist for API clients and the inbox badge.
- **App shell:** `App.tsx` is an auth gate (`useMe`). It shows `Login` on a 401 from `/api/me`, otherwise `MainApp`. Tabs live in the URL hash (`#next|#inbox|#graph|#done`). The Android share target (`/share?title&text&url`, defined in `vite.config.ts`) is read once at module load and prefills the Inbox capture box.
- **401 handling:** `main.tsx` re-checks `['me']` on any 401, with two exceptions: the `me` query itself (which would loop) and the `['login']` mutation (a wrong token shouldn't reset the form).
- **Task editor:** a single sheet opened from anywhere via `OpenTaskContext` (`openTask.ts`).
- **Tree drag-and-drop:** `components/TaskTree.tsx`, using dnd-kit and used only in "Show all" mode. The whole row is the drag node (so the overlay gets the row's size) and the grip is the activator. It uses `pointerWithin` collision detection. The "start a new sequence" drop zone is `position: fixed` on purpose: if it shifted the layout, dnd-kit's measured drop rects would go stale.
- **Graph view:** `views/GraphView.tsx` (React Flow + dagre) is lazy-loaded to keep the main bundle small. Nodes are laid out by dagre and are not draggable. Connecting handles re-parents, and clicking an edge detaches. Keep React Flow's attribution visible: `hideAttribution` requires a Pro subscription.
- **Styling:** plain CSS in `src/index.css`, with tokens on `:root` and a `prefers-color-scheme: dark` override. Design is mobile-first, with `env(safe-area-inset-*)` padding.
