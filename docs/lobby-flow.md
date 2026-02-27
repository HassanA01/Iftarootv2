# Lobby Flow — How It Works

## Does the lobby use Redis?

**No.** The lobby uses Postgres (player registration) and in-process memory (WebSocket hub). Redis is wired up for the game engine (questions, answers, scoring) but is never called during the waiting phase.

---

## Step 1 — Player joins via HTTP

**Files:** `frontend/src/pages/JoinPage.tsx` → `backend/internal/handlers/session.go:JoinSession`

The player fills in the room code and their name. The frontend posts to `POST /api/v1/sessions/join`. The handler:

1. Looks up the session by code in Postgres (`game_sessions` table)
2. Inserts a row into `game_players` with a new UUID
3. Returns `{ player_id, session_id, code, name }`

The frontend stores `player_id` and `player_name` in `sessionStorage` (ephemeral — cleared on tab close) and navigates to `/game/:code`.

```
Browser                          Postgres
  |                                 |
  |-- POST /api/v1/sessions/join -->|
  |                                 |-- INSERT INTO game_players
  |<-- { player_id, code } ---------|
  |
sessionStorage.player_id = "uuid..."
navigate("/game/887904")
```

---

## Step 2 — Player lobby validates and loads

**Files:** `frontend/src/pages/PlayerLobbyPage.tsx`, `backend/internal/handlers/session.go:GetSessionByCode` + `ListSessionPlayers`

When `PlayerLobbyPage` mounts, it makes two HTTP requests before opening a WebSocket:

1. `GET /api/v1/sessions/code/:code` — validates the session exists. If this 404s, a "Game not found" error is shown and no WS is opened.
2. `GET /api/v1/sessions/:id/players` — fetches everyone already registered (the DB snapshot).

This DB snapshot is the initial player list. It covers players who joined before you — they won't send a WS event while you're connecting.

---

## Step 3 — WebSocket announces arrival

**Files:** `frontend/src/pages/PlayerLobbyPage.tsx` → `backend/internal/handlers/websocket.go:PlayerWebSocket` → `backend/internal/hub/hub.go`

Once the session is confirmed valid, the frontend opens a WS to:
```
/api/v1/ws/player/:code?player_id=<uuid>&name=<name>
```

The handler:
1. Creates a `Client` struct
2. Calls `hub.JoinRoom()` — adds the client to an **in-memory map** keyed by room code
3. Broadcasts `player_joined` to everyone already in that room

```
Browser                    Hub (in-memory, hub.go)
  |                              |
  |-- WS connect --------------->|
  |                              |-- rooms["887904"][thisClient] = true
  |                              |-- Broadcast("player_joined", {player_id, name})
  |                                   → delivered to host + all other connected players
```

The hub's room map is simply:
```go
// backend/internal/hub/hub.go
rooms map[string]map[*Client]bool
// e.g. "887904" → { hostClient: true, player1Client: true, player2Client: true }
```

No Redis. No database write. If the backend restarts, all connections are gone.

---

## Step 4 — Rendering the player list

**Files:** `frontend/src/pages/PlayerLobbyPage.tsx`, `frontend/src/pages/HostLobbyPage.tsx`

Both pages maintain a `wsEvents` state (a list of join/leave events received over WS). The final player list is a `useMemo` that merges the DB snapshot with those events:

```
displayed players = DB snapshot + WS join events − WS leave events  (deduplicated)
```

This handles both cases:
- **Players already in room** → come from the DB snapshot (HTTP fetch)
- **Players joining after you** → come from `player_joined` WS events

When either source changes, React recomputes the list and re-renders.

---

## Full Picture

```
                         POSTGRES                     HUB (RAM)
                      game_players                rooms["887904"]
                            │                            │
JOIN ──► POST /join ──► INSERT row                  (not touched)
           │
           └── navigate("/game/887904")
                      │
                      ├─ GET /sessions/code/:code   validate session exists
                      │       SELECT game_sessions
                      │
                      ├─ GET /sessions/:id/players  initial snapshot
                      │       SELECT game_players
                      │
                      └─ WS connect ───────────────► JoinRoom() → added to map
                                                      Broadcast(player_joined)
                                                           │
                                                 ┌─────────┴──────────┐
                                            host client          player clients
                                            HostLobbyPage        PlayerLobbyPage
                                            wsEvents += joined   wsEvents += joined
                                            useMemo recomputes   useMemo recomputes
                                            list re-renders      list re-renders
```

---

## What Redis is reserved for

`backend/internal/hub/hub.go` has `StoreGameState` / `GetGameState` methods that read/write Redis under the key `game:<code>:state`. These exist so that active game state (current question, scores, timers) survives a backend restart mid-game. They are called by the game engine (issue #4) — not during the lobby waiting phase.
