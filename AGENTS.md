# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Covenant Legends is a browser-first, 2.5D turn-based strategy game inspired by the Book of Mormon. Eight factions (Nephites, Lamanites, Mulekites, Anti-Nephi-Lehies, Zoramites, Jaredites, Hagoth's Mariners, Amulonites) compete through faith, warfare, diplomacy, economy, and exploration. The project targets AAA-quality UI/UX with Polytopia/Civilization-style gameplay.

## Commands

```bash
# Development
npm run dev              # Start dev server (localhost:5000)
npm run check            # TypeScript type checking + repo hygiene

# Testing
npm run test:all                      # Full Vitest suite with configured coverage
npm run test:performance              # Performance guardrails
npm run test:e2e:chromium             # Blocking Chromium E2E gate
npm run test:e2e:matrix               # One-worker full Playwright project matrix
npx vitest run test/unit              # Run unit tests
npx vitest run test/unit --coverage   # Unit tests with coverage report
npx vitest watch                      # Watch mode for development
npx vitest run "CombatResolver"       # Run specific test file by name
npx vitest run test/a11y              # Accessibility tests

# Linting
npm run lint             # ESLint check
npm run lint:hooks       # Strict React Hooks rule enforcement

# Building & Production
npm run assets:verify    # Verify public assets, GLB hydration, and LFS policy
npm run build            # Build frontend (Vite) + backend (esbuild)
npm run start            # Run production server

# Database
npm run db:push          # Push Drizzle schema changes to PostgreSQL

# AI Simulation
npm run ai:sim           # Run AI strategy simulator
```

## Architecture

### Monorepo Structure

- `/client` - React 18 frontend with Three.js/React Three Fiber for 2.5D rendering
- `/server` - Express backend on port 5000
- `/shared` - Pure game logic, types, and utilities (imported by both client and server)
- `/test` - Vitest unit/a11y/integration/performance suites plus Playwright E2E tests

### Path Aliases

```typescript
"@/*"       -> "./client/src/*"
"@shared/*" -> "./shared/*"
```

### Key Directories

**`/shared/logic/`** - Core game logic (pure functions, no React):
- `resolveAction.ts` - Canonical action resolver (single source of truth entry point)
- `gameReducer.ts` - Thin router delegating to `resolveAction.ts`
- `legacyHandlers.ts` - Legacy state machine handlers (being migrated into resolver)
- `combatResolver.ts` - Combat calculation engine
- `unitLogic.ts` - Movement validation, passability
- `pathfinding.ts` - A* pathfinding implementation

**`/shared/data/`** - Data-driven game configuration:
- `gameRules.ts` - Central balance config (unit stats, terrain costs, combat modifiers)
- `factions.ts`, `units.ts`, `technologies.ts`, `abilities.ts` - Game definitions

**`/shared/types/`** - TypeScript type definitions (GameState, Unit, City, etc.)

**`/client/src/lib/stores/`** - Zustand state management:
- `useLocalGame.ts` - Primary game state store

**`/client/src/components/`** - React components:
- `game/` - Core gameplay (GameCanvas, HexRenderer)
- `primitives/` - Reusable UI (PanelShell, GlowingButton, InfoTooltip)
- `hud/` - Player HUD components

### Technology Stack

- **Frontend**: React 18, Vite, Three.js + React Three Fiber, Zustand, Tailwind CSS, Radix UI, Framer Motion
- **Backend**: Express, Drizzle ORM (PostgreSQL)
- **Testing**: Vitest (90% line coverage required), Playwright for E2E
- **3D Assets**: GLTF/GLB models in `/client/public/`

## Development Patterns

### Operating Guidance

For substantial Covenant Legends work, read `docs/COVENANT_LEGENDS_OPERATING_GUIDE.md` before editing and classify the touched surface: rules, UI/input, multiplayer/authority, map generation, assets/metadata, AI, deployment/runtime, or docs. For public-launch or "can this go public?" questions, use `docs/PUBLIC_RELEASE_READINESS_RUBRIC.md` and require live deployed evidence, not just local tests.

### Game Logic Separation

All game rules live in `/shared/` as pure functions. Use `resolveAction.ts` as the canonical entry point for state transitions. Never put game logic directly in React components.

### Data-Driven Design

Game balance values are centralized in `/shared/data/gameRules.ts`. Modify balance there, not in scattered code.

### Testing

Tests require mocking for Three.js, Zustand, and browser APIs. The `test/setup.ts` file handles this - check it when debugging test failures. Coverage thresholds: 90% lines/statements, 80% branches/functions.

### Adding New Units/Features

1. Define types in `/shared/types/`
2. Add data in `/shared/data/`
3. Implement logic in `/shared/logic/`
4. Add or migrate action handling in `resolveAction.ts` (the reducer is legacy)
5. Create UI in `/client/src/components/`
6. Write tests before/during implementation

## Important Files

- `shared/logic/gameReducer.ts` - Thin router delegating to `resolveAction.ts`
- `shared/logic/legacyHandlers.ts` - Legacy game state machine handlers (being migrated into `resolveAction.ts`)
- `shared/data/gameRules.ts` - Game balance configuration
- `shared/utils/mapGenerator.ts` - Procedural map generation
- `test/setup.ts` - Test mocking configuration
- `README.md` - Current project overview and release gates
- `TESTING.md` - Current local and CI validation policy
- `docs/README.md` - Current documentation index
- `replit.md` - Additional architecture documentation

## Recurring Bug Lessons (living memory)
<!-- BUG-LESSONS:START -->
<!-- BUG-LESSON:worktree-merges-require-paired-tests -->
### Merge worktrees by surface, not mechanically
- First seen: 2026-04-03
- Last seen: 2026-04-03
- Recurrence count: 1
- Severity: high
- Symptom: Consolidated branches look mostly correct but silently drop one half of a feature, especially lobby, turn, settings, or store plumbing.
- Root cause: Worktree integration carried implementation without its paired tests or companion state and UI changes.
- Why it recurred: This repo has had many dirty detached worktrees and consolidation branches; naive cherry-picks or file-level merges hide coupled regressions until targeted suites run.
- Fix: Diff each surface against main, preserve snapshots, integrate implementation plus paired tests together, and rerun targeted suites before promotion.
- Prevention rule: Before merging or cleaning up worktrees, inventory branches and worktrees, archive dirty snapshots, and validate by touched surface instead of trusting a generic green run.
- Verification: `git worktree list --porcelain && git branch --no-merged main && npx vitest run test/LobbyRoomFactionSelection.test.tsx shared/logic/gameReducer.test.ts test/unit/HandoffScreen.unit.test.tsx test/server/lobbyRealtimeBroker.test.ts test/LobbyRoomClipboard.test.tsx`

<!-- BUG-LESSON:overlay-provider-shell-must-be-explicit -->
### Interactive overlays must opt into input and shared providers
- First seen: 2026-04-03
- Last seen: 2026-04-03
- Recurrence count: 1
- Severity: high
- Symptom: Tutorials, fullscreen blockers, chat, or special routes click through to the map, miss context providers, or ignore hotkey blocking and mobile viewport limits.
- Root cause: Interactive surfaces lived under GameUI or special routes but relied on implicit pointer-event inheritance or bypassed the shared provider shell.
- Why it recurred: This repo has multiple overlays, portals, and special routes, so one surface often gets fixed while another keeps the old pattern.
- Fix: Use shared modal/provider primitives, add explicit pointer-events-auto and data-ui-layer semantics, and keep special routes inside the shared provider shell.
- Prevention rule: For overlay, modal, hotkey, or special-route changes, inspect App.tsx, GameUI.tsx, ModalLayer, and relevant CSS before editing; do not rely on implicit behavior.
- Verification: `npx vitest run test/TutorialModalInputBlocking.test.tsx test/OverlayPointerEventsCanary.test.tsx test/AppProviders.test.tsx test/HotkeyInputBlocking.test.tsx`

<!-- BUG-LESSON:lobby-multiplayer-edits-are-cross-layer -->
### Treat lobby and multiplayer edits as cross-layer
- First seen: 2026-04-03
- Last seen: 2026-04-03
- Recurrence count: 1
- Severity: high
- Symptom: Duplicate factions become selectable, wrong player gets authority or recovery UI, stale queued actions survive turn end, or eliminated-player handoff breaks.
- Root cause: Lobby behavior is split across UI, client sync hooks, server policy/routes, and turn/store logic, but only one layer was edited or merged.
- Why it recurred: The same feature spans LobbyRoom, GameUI, useOnlineGameSync, server/multiplayerPolicy.ts, and server/routes.ts, so partial fixes look plausible until targeted tests run.
- Fix: Update all affected layers together and revalidate faction uniqueness, actor ownership, queue pruning, resync, and eliminated-player skipping.
- Prevention rule: When touching lobby, online, or turn-authority code, inspect both client and server surfaces before editing and assume the change is cross-layer until proven otherwise.
- Verification: `npx vitest run test/LobbyRoomFactionSelection.test.tsx test/LobbyRoomClipboard.test.tsx test/server/lobbyRealtimeBroker.test.ts test/server/multiplayerPolicy.test.ts client/src/hooks/onlineSyncUtils.test.ts shared/logic/multiplayerSync.test.ts`

<!-- BUG-LESSON:canonical-rules-live-in-shared-resolver -->
### Keep game rules in shared resolver
- First seen: 2026-04-03
- Last seen: 2026-04-03
- Recurrence count: 1
- Severity: high
- Symptom: Research, ability, city-capture, diplomacy, save/load, or turn-flow behavior drifts between gameplay logic and the UI/store.
- Root cause: Rules were changed in useLocalGame.ts, UI helpers, or legacy modules without the corresponding canonical shared logic moving with them.
- Why it recurred: This repo still contains legacy handlers and client-side helpers near the canonical path, so it is easy to patch the nearest caller instead of resolveAction.ts or a shared predicate.
- Fix: Route behavior through shared/logic/resolveAction.ts or a shared predicate in /shared, then update callers to consume that answer instead of keeping their own rule copy.
- Prevention rule: Before editing action availability or outcomes, search shared/logic, client/src/lib/stores/useLocalGame.ts, and UI helpers for duplicate logic; change the canonical shared path first.
- Verification: `npx vitest run shared/logic/gameReducer.test.ts shared/logic/resolveAction.guards.test.ts shared/logic/activeEffects.test.ts`
<!-- BUG-LESSONS:END -->
