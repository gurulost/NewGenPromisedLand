# Chronicles of the Promised Land - Development Guide

## Overview

Chronicles of the Promised Land is a browser-first, 2.5D turn-based strategy game inspired by the Book of Mormon. It features eight factions (Nephites, Lamanites, Mulekites, Anti-Nephi-Lehies, Zoramites, Jaredites, Hagoth's Mariners, and Amulonites) competing for dominance in ancient Americas through faith, warfare, and diplomacy. The project aims for AAA-quality UI/UX and deep strategic gameplay akin to Polytopia and Civilization.

## User Preferences

Preferred communication style: Simple, everyday language.

## Documentation Map

- `README.md` is the starting point for current project status and release gates.
- `docs/README.md` indexes active gameplay, analytics, UI, and operations references.
- `docs/archive/` contains historical checklists, implementation reports, and old handoff notes. Treat archive files as context only.

## System Architecture

The application uses a modern full-stack monorepo architecture with a clear separation of concerns.

### Monorepo Structure
- `/client`: React frontend
- `/server`: Node.js backend
- `/shared`: Shared game logic, types, and utilities
- `/migrations`: Database migration files

### Frontend
- **Framework**: React 18 with TypeScript
- **3D Rendering**: Three.js with React Three Fiber for 2.5D hex-grid gameplay
- **State Management**: Zustand
- **Styling**: Tailwind CSS with Radix UI components
- **Build Tool**: Vite
- **UI/UX**: AAA-quality design with consistent golden/amber theming, professional primitives (PanelShell, GlowingButton), comprehensive accessibility, mobile responsiveness, and touch optimization. Features include cinematic menus, dynamic construction halls, detailed player HUDs, and an advanced InfoTooltip system.
- **Visuals**: Authentic Mesoamerican textures, optimized 3D models for terrain, units, and resources with automatic positioning. Animated cloud-like fog of war and Polytopia-style camera controls.

### Backend
- **Runtime**: Node.js with Express
- **Storage**: Database-backed storage through `server/storage.ts`.
- **Database**: Drizzle ORM for PostgreSQL. `DATABASE_URL` is required at server startup.
- **Bug Reporting**: In-game bug report system with optional R2 screenshot upload, diagnostic payload collection, fingerprinting, 24h duplicate detection, offline queue with auto-retry, and optional webhook notification.
  - Client entry points: desktop utility dock ("Something not working?"), mobile HUD menu ("Report Issue"), and ErrorBoundary ("Report issue" button).
  - Shared types: `shared/types/bugReport.ts`; server logic: `server/bugReports.ts`; client util: `client/src/utils/bugReport.ts`.
  - Optional env: `BUG_REPORT_WEBHOOK_URL` for Slack/Discord webhook notifications.
  - Screenshot upload uses R2 storage (same secrets as voice notes).

### Multiplayer Operations
- **Required in production**
  - `DATABASE_URL`: PostgreSQL connection string (server fails startup if missing).
  - `SESSION_SECRET`: session signing secret (required when `NODE_ENV=production`).
- **Current private/demo architecture**
  - Online multiplayer remains host-driven. The server coordinates lobby state, queued actions, committed action metadata, canonical initial snapshots, and uploaded host snapshots, but it does not fully replay and authorize every game rule outcome yet.
  - Lobby start persists a canonical initial game snapshot on the server. Online clients should load that snapshot instead of independently creating their own initial game state from the seed.
  - Guest actions carry the action version they were based on. Stale queued actions are rejected/tombstoned so they do not keep reappearing in the host queue.
  - Queue-backed host commits are tied to the server-stored queued action. A host cannot change the action payload while reusing the same queued-action identity.
  - Host-uploaded snapshots are schema-validated and checked against lobby players, factions, current actor, action version, and committed action metadata. This is hardening, not a replacement for future server-authoritative resolution.
- **Deployment topology**
  - The realtime broker for lobby and multiplayer sync events is in-memory and process-local. Private/demo multiplayer currently assumes a single running Node process or sticky single-instance deployment.
  - Polling catch-up still exists, but multi-instance autoscaling without Redis, Postgres LISTEN/NOTIFY, or a managed realtime adapter can delay or miss SSE push events between clients connected to different processes.
  - Do not enable multiple active server processes for the private/demo multiplayer release unless traffic is pinned to one process or a shared realtime transport is added.
- **Multiplayer runtime flags**
  - `MULTIPLAYER_TURN_RECOVERY` (default: `true`): enable host timeout recovery flow for disconnected remote turns.
  - `MULTIPLAYER_TURN_TIMEOUT_MS` (default: `90000`): inactivity threshold before host can force remote `END_TURN`.
  - `MULTIPLAYER_MAX_ACTION_BYTES` (default: `32768`): max serialized action payload size accepted by queue/commit endpoints.
  - `MULTIPLAYER_STRICT_RESYNC` (default: `true`): client strict sequential version checks + forced authoritative resync flow.
  - `VITE_MULTIPLAYER_STRICT_RESYNC` (default: `true`): client-side build-time override for strict resync behavior.
- **Cookie/session behavior**
  - Production sessions use `connect-pg-simple` with `createTableIfMissing: true`.
  - Session cookies use `secure: true` in production, so HTTPS + correct proxy forwarding are required.

### Active Balance Toggles (TEMPORARY)

These are intentional non-default rule overrides currently in `shared/data/gameRules.ts`. When fixing or rebalancing the underlying system, flip the listed flag and remove the entry here.

- **Faith victory: DISABLED** — `GAME_RULES.victory.faithEnabled = false` in `shared/data/gameRules.ts`. Reason: faith=90 is too easy to reach via diplomacy and was producing instant/cheap wins.
  - **To re-enable:** set `faithEnabled: true` in `shared/data/gameRules.ts` (single-line change). The faith branch in `checkVictoryConditions` (`shared/logic/actions/turns.ts`), the AI's pivot logic in `calculateVictoryProgress` (`shared/ai/aiEngine.ts`), and the Faith tile + tooltip line in `client/src/components/hud/PlayerHUD.tsx` are all already gated on this flag and will light back up automatically.
  - **Tests covering both states:** `shared/logic/gameReducer.test.ts` — "awards faith victory when threshold and dissent are met" (temporarily flips flag on) and "does not award faith victory while the faith win condition is disabled" (verifies disabled state).
  - **Player-facing docs to update on re-enable:** `docs/PLAYER_REFERENCE.md` section 16 (Victory Conditions).

### Core Game Mechanics
- **Data-Driven**: All game rules, including abilities, costs, and terrain effects, are centrally configured.
- **Game Logic**: Pure functions for movement, combat, pathfinding, and resource management within `/shared`.
- **Turn-Based System**: Local multiplayer (pass-and-play) with client-side game logic processing through a shared reducer.
- **Map Generation**: Procedural map generation with Polytopia-style terrain distribution, village spawning, and faction-specific homeland modifiers. Includes a unified scripture-themed resource system with moral choices.
- **Combat System**: Advanced combat calculations with unit-specific bonuses, formation tactics, terrain modifiers, and faith/pride bonuses.
- **Technology Tree**: Comprehensive technology tree with prerequisites, cost validation, and themed descriptions.
- **Unit System**: Comprehensive unit abilities (e.g., Worker construction, Scout stealth, Missionary healing) with visual indicators and status effects.
- **City Management**: Full-featured city panel for construction, unit recruitment, and resource generation.
- **Performance**: Instanced rendering for hex grid, React memoization, and optimized data processing.
- **Testing**: Extensive Vitest-based testing suite covering core game mechanics, UI components, and edge cases.

## External Dependencies

- **React Ecosystem**: React, React DOM, React Three Fiber, React Three Drei
- **3D Graphics**: Three.js
- **UI Components**: Radix UI
- **State Management**: Zustand
- **Database**: Drizzle ORM for PostgreSQL
- **Build Tools**: Vite, TypeScript, ESBuild
- **Styling**: Tailwind CSS, PostCSS
- **Animation**: GSAP (for camera animations)
- **Gestures**: @use-gesture/react (for touch interactions)
- **Compression**: LZ-String (for save files)
