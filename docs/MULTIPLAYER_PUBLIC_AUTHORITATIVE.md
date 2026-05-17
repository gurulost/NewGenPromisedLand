# Public Multiplayer Authoritative Mode

Public multiplayer is a separate server-authoritative mode. The existing private/demo host-mediated mode remains available for trusted invite games, but public lobbies must use the server as the gameplay authority.

## Runtime Contract

- Public lobbies are created with `multiplayerAuthorityMode: "public_authoritative"`.
- Clients submit intents to `POST /api/lobbies/:code/actions/submit`.
- The server derives the actor from the authenticated user, lobby seats, and canonical current turn.
- The server validates legality with shared rule queries and applies accepted actions through `resolveAction(..., { source: "server" })`.
- The server persists a canonical snapshot after every accepted action.
- `GET /api/lobbies/:code/state` returns a player-scoped projected snapshot for public lobbies.
- The old host routes, `/actions/queue`, `/actions/commit`, and `PUT /state`, are private/demo-only and reject public-authoritative lobbies.
- AI and timeout actions are server-owned in public mode.

## Replit Requirements

Set these before enabling public lobby creation:

```bash
PUBLIC_MULTIPLAYER_ENABLED=true
VITE_PUBLIC_MULTIPLAYER_ENABLED=true
MULTIPLAYER_REALTIME_ADAPTER=postgres_notify
MULTIPLAYER_REQUIRE_BUILD_ID=true
MULTIPLAYER_BUILD_ID=<deployed-build-id>
VITE_MULTIPLAYER_BUILD_ID=<same-deployed-build-id>
DATABASE_URL=<replit-postgres-url>
```

Then run:

```bash
npm run db:push
npm run check
npm run build
```

Public mode fails closed if `PUBLIC_MULTIPLAYER_ENABLED=true` is not set or if `MULTIPLAYER_REALTIME_ADAPTER` is still `memory`.

## Current Public V1 Behavior

- Public lobbies are unranked.
- HTTP action submission plus SSE invalidation remains the transport model.
- Polling fallback remains required.
- The Postgres realtime adapter uses `LISTEN/NOTIFY` so SSE invalidation is no longer tied to a single Node process.
- Full canonical snapshots are stored server-side; clients receive projected snapshots.
- Action audit rows and snapshot checkpoint rows are written for accepted/rejected public actions.

## Still Not Ranked-Ready Until Verified Live

Before marketing public mode as ranked/competitive, verify on the deployed Replit instance:

- two-browser public lobby start and multi-turn play
- projected state responses do not contain hidden enemy units or unrevealed resources/features
- stale clients are rejected and resynced
- AI turns resolve on the server
- timeout request applies only after the configured timeout
- SSE works across the deployed process topology, with polling fallback still catching up
- action audit and snapshot checkpoint rows are present in Postgres
