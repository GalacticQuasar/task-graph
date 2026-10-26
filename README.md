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

One container serves both the UI and the API, with data in SQLite on a Docker volume. The
recommended setup runs it on a VPS behind a **Cloudflare Tunnel** (`compose.yaml`). The
`cloudflared` container dials out to Cloudflare, which serves your hostname over HTTPS. You
don't open any inbound ports and don't manage any certificates. This needs a domain whose DNS
is on Cloudflare; the free plan is enough.

1. **Install Docker on the server** (e.g. `curl -fsSL https://get.docker.com | sh`), then clone
   this repo onto it. ARM servers such as Oracle's Ampere instances work: the image builds there
   unchanged.
2. **Create the tunnel:** in the Cloudflare dashboard go to *Networking → Tunnels*, create a
   tunnel (type *Cloudflared*), and copy the token: the `eyJ…` string in the install command it
   shows. Don't run that command.
3. **Route a hostname** to the tunnel: e.g. `tasks.example.dev`, with service type **HTTP** and
   URL **`app:8000`** (the compose service name, not localhost). Cloudflare creates the DNS
   record for you.
4. **Configure and start:**

   ```sh
   cp .env.example .env    # set TASKGRAPH_TOKEN (openssl rand -hex 32) and TUNNEL_TOKEN
   docker compose up -d --build
   ```

5. Open `https://tasks.example.dev` and log in with `TASKGRAPH_TOKEN`.

To update, run `git pull && docker compose up -d --build`. To back up:
`docker compose cp app:/data/taskgraph.db ./backup.db`.

**About the token:** it's the only thing protecting a public deployment, so the image refuses to
start unless it's at least 32 characters. You type it once per device to log in, and phone
shortcuts send it as a bearer token. Changing it logs out every device. Keep `.env` private:
`TUNNEL_TOKEN` lets anyone run your tunnel.

**Other setups:** the image works behind any HTTPS reverse proxy (Caddy, nginx) via
`docker run -p 127.0.0.1:8000:8000 -e TASKGRAPH_TOKEN=… -v taskgraph-data:/data <image>`, with
the port bound to localhost so only the proxy can reach it. It also works
privately over [Tailscale](https://tailscale.com) with `tailscale serve --bg 8000`. Serve it over
HTTPS either way: installing on a phone requires it, and the login cookie is only marked
`Secure` over HTTPS. Never expose port 8000 to the internet directly: the server trusts
`X-Forwarded-*` headers.

| Variable | Default | Meaning |
| --- | --- | --- |
| `TASKGRAPH_TOKEN` | unset | Shared secret. Unset disables auth (dev only). |
| `TASKGRAPH_REQUIRE_TOKEN` | `1` in Docker | Refuse to start without a token of 32+ characters. |
| `TASKGRAPH_DB` | `sqlite:///taskgraph.db` (`/data/taskgraph.db` in Docker) | Database URL. |
| `TASKGRAPH_STATIC` | unset (`/app/static` in Docker) | Built frontend to serve at `/`. |

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
