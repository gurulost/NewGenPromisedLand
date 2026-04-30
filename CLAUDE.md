# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Keep it aligned with `AGENTS.md`; that file is the richer agent guidance source.

## Project Overview

Chronicles of the Promised Land is a browser-first, 2.5D turn-based strategy game inspired by the Book of Mormon. Eight factions (Nephites, Lamanites, Mulekites, Anti-Nephi-Lehies, Zoramites, Jaredites, Hagoth's Mariners, Amulonites) compete through faith, warfare, diplomacy, economy, and exploration. The project targets AAA-quality UI/UX with Polytopia/Civilization-style gameplay.

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
