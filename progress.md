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
