Original prompt: Harden Covenant Legends multiplayer for Replit-hosted private/demo release as much as is safe locally, then leave direct Replit-agent backend instructions.

## Progress

- Added shared multiplayer protocol/rules constants and client/server version-gate helpers.
- Added server gates on playing lobby start/state/action/host/realtime recovery paths.
- Added client version headers/query parameters for multiplayer HTTP and SSE requests.
- Preserved host-transfer recovery state when `turnResolutionPending` is true.
- Added host replay snapshot upload after a new host catches up a raw `END_TURN`.
- Removed non-seeded shared gameplay randomness fallbacks from ruins rewards and city naming.
- Added private/demo Replit deployment documentation.

## Next Suggestions

- Full public multiplayer still needs server-authoritative resolution and player-scoped state projection.
- Replit should confirm single-process/sticky deployment and optionally wire matching `MULTIPLAYER_BUILD_ID` / `VITE_MULTIPLAYER_BUILD_ID`.

## Public Authoritative Multiplayer Progress

- Added public/private authority mode constants.
- Added player-scoped projected game-state snapshots for public multiplayer.
- Added public server-side action submission service using shared rule queries and `resolveAction`.
- Added public server-owned timeout request path and server-side AI advancement scaffolding.
- Added action audit and snapshot checkpoint schema/storage methods.
- Added a Postgres `LISTEN/NOTIFY` realtime adapter path while preserving in-memory SSE for private/demo.
- Updated lobby create/start, state fetch, and legacy queue/commit/snapshot routes for public-authoritative mode.
- Updated client lobby creation, online session state, public action submission, public sync/resync, and AI-host behavior.
- Added public multiplayer docs and Replit deployment requirements.
- Validation: `npm run check`; `npm run lint`; `npm run lint:hooks`; `npm run test:all`; `npx vitest run test/server/multiplayerRoutes.test.ts`; focused public multiplayer/shared reducer suites; `npm run assets:verify`; `npm run build`; `npm run ai:sim`.

## Remaining Verification Notes

- Replit still needs live two-browser verification after env vars, DB migration, and deployment because local tests cannot prove deployed process topology or production SSE behavior.
