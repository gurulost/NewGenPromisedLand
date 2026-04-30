# Chronicles of the Promised Land

Browser-first 2.5D turn-based strategy game inspired by the Book of Mormon. The project uses React, Three.js / React Three Fiber, Zustand, Tailwind, Express, Drizzle, Vitest, and Playwright.

## Current Documentation

Start here:

- [AGENTS.md](./AGENTS.md) - repo rules for AI/code agents
- [TESTING.md](./TESTING.md) - local and CI test policy
- [docs/README.md](./docs/README.md) - active documentation index
- [docs/PLAYER_REFERENCE.md](./docs/PLAYER_REFERENCE.md) - current player-facing rules reference
- [replit.md](./replit.md) - Replit/development environment guide

Historical checklists and one-time implementation reports live under [docs/archive](./docs/archive/README.md). Treat archive files as context only, not current source of truth.

## Common Commands

```bash
npm run dev
npm run check
npm run lint
npm run assets:verify
npm run test:performance
npm run test:e2e:chromium
npm run build
```

## Current Release Gates

CI blocks merges on type/hygiene checks, lint, asset integrity, production build, Vitest coverage, performance tests, Chromium E2E, and Lighthouse.

Playwright policy:

- Chromium is the blocking PR/push E2E gate.
- Full desktop/mobile/tablet Playwright matrix runs on schedule or manual dispatch as release-confidence coverage.

Asset policy:

- `npm run assets:verify` fails on unhydrated Git LFS pointers, malformed GLBs, and public assets over 5 MiB that are not LFS-filtered.
- Do not ship unless `asset-integrity` is green in CI.

## Architecture Short Form

- `client/` - React frontend and Three.js rendering
- `server/` - Express API, persistence, multiplayer, bug-report endpoints
- `shared/` - canonical game rules, data, types, map generation, AI logic
- `test/` - Vitest suites and Playwright E2E coverage

Game rules should live in `shared/` and flow through `shared/logic/resolveAction.ts`. Avoid duplicating rules in React components or Zustand stores.
