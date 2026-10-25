# Task Graph

A task list where tasks can come *after* other tasks. Instead of one flat list, tasks form
sequences (`work out → shave → shower → trim nails`), and the main screen shows only what you
can act on right now: tasks with no unfinished predecessor.

- **Up next**: actionable tasks, each with a hint of what follows. "Show all" switches to the
  full tree, where you can drag a task's ⠿ grip onto another task to reorder sequences.
- **Inbox**: captured tasks with no group and no predecessor, waiting to be filed.
- **Graph**: the whole forest as a diagram. Drag between dots to connect, tap a line to detach.
- **Done**: completed tasks by day.
- **Groups** are tags (school, health, …). Sequences can cross groups.

Edges mean "comes after", not "blocked by": you can complete any task at any time. Each task
has at most one predecessor, and loops are rejected.

## Development

```sh
cd backend  && uv run uvicorn app.main:app --reload   # API on :8000
cd frontend && npm install && npm run dev            # UI on :5173, proxies /api to :8000
```

Without `TASKGRAPH_TOKEN` set, the backend runs with **auth disabled** (it logs a warning).
Tests: `cd backend && uv run pytest`. Frontend checks: `cd frontend && npm run build && npm run lint`.

## Deploy

One container serves both the UI and the API. Data lives in SQLite under `/data`.

```sh
docker build -t taskgraph .
docker run -d --name taskgraph --restart unless-stopped \
  -p 8000:8000 \
  -e TASKGRAPH_TOKEN="$(openssl rand -hex 32)" \
  -v taskgraph-data:/data \
  taskgraph
```

The image refuses to start without `TASKGRAPH_TOKEN`. Keep the token: you'll type it once on
each device to log in, and phone shortcuts send it as a bearer token. Changing it logs out
every device.

**Serve it over HTTPS.** Installing the app on a phone requires HTTPS, and the login cookie is
only marked `Secure` over HTTPS. The easiest private setup is [Tailscale](https://tailscale.com):
install it on the server and your phone, then run `tailscale serve --bg 8000` on the server to
get `https://<machine>.<tailnet>.ts.net` with a valid certificate. That keeps the app off the
public internet. Any other HTTPS reverse proxy (Caddy, nginx) works too.

| Variable | Default | Meaning |
| --- | --- | --- |
| `TASKGRAPH_TOKEN` | unset | Shared secret. Unset disables auth (dev only). |
| `TASKGRAPH_REQUIRE_TOKEN` | `1` in Docker | Refuse to start without a token. |
| `TASKGRAPH_DB` | `sqlite:///taskgraph.db` (`/data/taskgraph.db` in Docker) | Database URL. |
| `TASKGRAPH_STATIC` | unset (`/app/static` in Docker) | Built frontend to serve at `/`. |

Back up by copying `taskgraph.db` out of the volume, e.g.
`docker cp taskgraph:/data/taskgraph.db ./backup.db`.

## Phone setup

### Install the app

- **iPhone (Safari):** open your HTTPS URL, log in, then Share → **Add to Home Screen**.
- **Android (Chrome):** open the URL, log in, then menu → **Install app**.

### Quick capture

Captured tasks land in the Inbox, to be filed later.

**iPhone: Shortcuts app.** Create a shortcut with two actions:

1. **Ask for Input**, type *Text*, prompt "Task".
2. **Get Contents of URL**
   - URL: `https://<your-host>/api/capture`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer <your token>`
   - Request Body: **JSON**, with one field `title` (Text) set to the *Provided Input*
     variable from step 1.

Name it "Add task". Then you can run it from the home screen, the Action Button, or Siri
("Hey Siri, add task"), or put it in the share sheet. For the share sheet, turn on "Show in
Share Sheet" and use *Shortcut Input* instead of Ask for Input.

**Android:** once the app is installed, **Share → Tasks** from any app opens the Inbox with
the shared text filled in. For a home-screen capture button, an app like *HTTP Shortcuts* can
send the same POST request as the iPhone shortcut.

**Anything else** (scripts, a desktop launcher):

```sh
curl -X POST https://<your-host>/api/capture \
  -H "Authorization: Bearer $TASKGRAPH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "email advisor"}'
```
