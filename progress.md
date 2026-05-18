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

## Live Multiplayer Browser Smoke Hardening

- 2026-05-17 follow-up: live public-authoritative API turn cycling worked for three players, but browser lobby/game entry crashed with React maximum-update-depth error #185.
- Current fix path: keep chat Zustand selectors stable, add real-Zustand regression coverage outside the mocked Vitest setup, add durable lobby automation hooks, correct public-authoritative lobby copy, and add a repeatable three-player/four-round live browser smoke.
- Local validation passed: real-Zustand chat smoke, focused lobby/chat tests, multiplayer guardrail Vitest matrix, `npm run check`, `npm run lint`, `npm run lint:hooks`, `npm run build`, and `git diff --check`.
- Production smoke now creates/deletes its temporary public lobby and writes artifacts, but current `https://covenantlegends.com` is still on a deployment without the new lobby automation hooks. Republish the updated code, then rerun `npm run test:live:multiplayer -- --players=3 --rounds=4 --build-id=<deployed-build-id>`.
- 2026-05-17 live rerun after Replit freshness passed bundle preflight and reproduced a real lobby UI blocker: server-created placeholder seats (`userId: null`, `isAI: false`) rendered as occupied `Unknown` seats, so browser agents could not claim seats 2/3. Patched `LobbyRoom` to render those placeholders as empty claimable seats, added regression coverage, and improved the live smoke report to capture exact same-origin HTTP error responses for future 403 diagnosis.
- Added a `data-seat-state` deployment marker/test hook and required it in the live smoke preflight so stale Replit bundles stop before creating temporary live users/lobbies.
- Replit publish generated a destructive `DROP TABLE "user_sessions" CASCADE` migration because the runtime `connect-pg-simple` table was not declared in Drizzle schema. Added `user_sessions` to `shared/schema.ts` to preserve production sessions during deploy diffing.
- Replit development also needs to create the same session table before publish compares dev/prod DB schemas, so Replit development now uses the Postgres session store when `REPL_ID` is present.
- Fresh deployed live smoke reached three claimed seats and game start, then hit a real first-turn automation blocker: the tutorial overlay correctly intercepted the End Turn click. Updated the live smoke harness to dismiss the tutorial overlay through its own controls before game-start, handoff, and end-turn interactions, and to log each dismissal.
- Follow-up smoke exposed app-side start fragility: lobby chat/read or realtime activity can race the host start write, return "Lobby changed while starting game", and strand players in the lobby. Patched the start route to retry transient lobby write conflicts, and gated lobby chat transport setup so unclaimed non-host viewers do not hammer chat/realtime endpoints with 403s before they claim a seat.
- Also removed production `/api/animation-overrides` fetch noise by keeping server override sync behind dev/explicit flag, while preserving local animation overrides. The live smoke now ignores normal EventSource `net::ERR_ABORTED` close events but still records same-origin HTTP 4xx/5xx responses.
- Fresh publish smoke completed one full 3-player round before finding two new issues: crossfade code could set negative audio volume, and public-authoritative `/actions/submit` could lose a concurrent lobby write race on later turns. Patched crossfade volume clamping and added retry handling for transient public action submission conflicts.
