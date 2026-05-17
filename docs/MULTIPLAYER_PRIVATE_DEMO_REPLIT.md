# Private/Demo Multiplayer Deployment Notes

This release keeps Covenant Legends multiplayer private/demo only. The transport is still HTTP plus SSE invalidation, and gameplay outcome is still host-mediated instead of fully server-authoritative.

## Current Safety Contract

- Lobbies persist a server-created canonical initial snapshot at start.
- Guests queue actions with `baseActionVersion`; stale actions are rejected/tombstoned.
- Host commits of queue-backed guest actions must match the server-stored queued payload.
- Host-uploaded snapshots are schema and invariant checked.
- Playing lobby requests are version-gated by shared multiplayer protocol and rules version.
- If host transfer happens while `turnResolutionPending` is still true, the new host is told to resync and can upload the missing resolved snapshot after replaying the committed `END_TURN`.

## Replit Deployment Requirements

- Run one active Node server process for private/demo multiplayer, or guarantee sticky routing to one process.
- Do not enable autoscaled multi-process multiplayer until realtime invalidation moves to Redis, Postgres `LISTEN/NOTIFY`, or managed realtime.
- **Published deployment type must be `vm` (matches `.replit` `[deployment]` `deploymentTarget = "vm"`).** The published setting in the Replit Publishing UI overrides the file, so always verify with `getDeploymentInfo()` after republishing — `deploymentType` must report `"vm"`.
- If you must keep autoscale instead of vm (e.g. for cost or cold-start reasons), the deployment **must be pinned to a maximum of 1 instance** in the Publishing UI → Advanced settings. More than one autoscaled instance will silently break lobby/SSE sync because the realtime broker is in-memory and process-local. This is a temporary constraint until a shared realtime transport is added.
- After changing the published deployment type, run a two-client multiplayer smoke test and confirm SSE/sync events propagate between both clients before declaring the change healthy.
- Set `DATABASE_URL` to a durable Postgres database.
- Set `SESSION_SECRET` in production.
- Keep HTTPS/proxy forwarding correct because production session cookies are secure.
- Recommended: set the same commit/deployment id in both:
  - `MULTIPLAYER_BUILD_ID`
  - `VITE_MULTIPLAYER_BUILD_ID`
- Optional stricter gate after confirming Replit injects matching values at build and runtime:
  - `MULTIPLAYER_REQUIRE_BUILD_ID=true`

If build ids are not configured, protocol and rules version gates still protect against mixed game-rule deployments. Build-id gating is intentionally optional so a missing Replit env var does not block private/demo matches by default.
If `MULTIPLAYER_REQUIRE_BUILD_ID=true` is set without `MULTIPLAYER_BUILD_ID`, multiplayer requests fail closed with a server configuration error.

## Public Multiplayer Follow-Up

Do not market this as public competitive multiplayer yet. Public play still requires:

- server-authoritative action resolution
- canonical full server state persisted after committed actions
- player-scoped state projection for fog/hidden information
- server-owned turn timeout resolution
- audit hashes or checksums per committed action
- shared realtime transport for multi-instance deployment
