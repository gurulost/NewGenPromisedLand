# Testing Framework Documentation

## Overview

Chronicles of the Promised Land uses Vitest for unit, integration, component, accessibility, and performance tests, with Playwright for browser E2E coverage. GitHub Actions runs the repository checks, lint, build, Vitest coverage suite, Playwright E2E suite, and Lighthouse audit.

## Configuration

- **Vitest config**: `vitest.config.ts`
- **Vitest environment**: `jsdom`
- **Vitest setup**: `test/setup.ts`
- **Vitest include globs**:
  - `test/**/*.{test,spec}.{js,ts,jsx,tsx}`
  - `shared/**/*.{test,spec}.{js,ts,jsx,tsx}`
  - `client/**/*.{test,spec}.{js,ts,jsx,tsx}`
- **Vitest excludes**: `test/e2e/**/*` and `node_modules/**/*`
- **Playwright config**: `playwright.config.ts`
- **Playwright tests**: `test/e2e`

## Commands

```bash
# Repository checks used by CI
npm run check

# Unit/component/integration suite with configured coverage
npm run test:all

# Run a targeted Vitest file or set of files
npx vitest run test/CityPanelIntegration.test.tsx
npx vitest run test/CityPanelIntegration.test.tsx shared/components/VictoryScreen.test.tsx

# Watch mode for local development
npx vitest watch

# Accessibility and performance subsets
npx vitest run test/a11y
npx vitest run test/performance

# E2E tests
npx playwright test
npx playwright test test/e2e --project=chromium
npm run test:e2e -- test/e2e/main-menu-setup.spec.ts --project=mobile-chrome
```

## Coverage

Vitest coverage is configured with V8 and reports text, HTML, and JSON output.

Current global thresholds:

- Branches: 80%
- Functions: 80%
- Lines: 90%
- Statements: 90%

The current coverage config excludes `server/`, `test/`, `dist/`, config files, declarations, `node_modules/`, and `public/`. Server coverage is not enabled in the current policy.

## Test Areas

- **Shared data tests**: game rules, factions, units, technologies, abilities, and reference integrity.
- **Shared logic tests**: reducer routing, action resolution, combat, movement, construction, effects, turn flow, AI rules, and multiplayer sync.
- **Client component tests**: UI panels, overlays, HUD behavior, hotkey blocking, provider shell behavior, and store-connected components.
- **Accessibility tests**: focused a11y checks under `test/a11y`.
- **Performance tests**: guardrail benchmarks under `test/performance`.
- **Playwright E2E tests**: browser-level flows under `test/e2e`.

## CI and Release Guardrails

CI uses `npm run check`, not the narrower `npm run typecheck`, so type checks and repository hygiene run together.

Asset-dependent CI jobs hydrate Git LFS assets during checkout and verify that `client/public` does not contain Git LFS pointer files before building, running Vitest, running E2E tests, or running Lighthouse. This prevents release artifacts and browser tests from silently using pointer files instead of real assets.

Playwright starts the app through the configured `webServer` using `npm run dev:e2e`, which avoids the `tsx` CLI IPC path used by the normal dev server. Its readiness probe targets the app shell by default instead of `__health`, because E2E runs disable the save API and should not require a local Postgres role just to start browser tests. CI currently runs the Chromium project only; local runs use the broader desktop, mobile, and tablet project matrix from `playwright.config.ts`.

For local debugging against a server you already started, run `npm run dev:e2e` in one terminal and then run Playwright with either `PLAYWRIGHT_REUSE_SERVER=true` or `PLAYWRIGHT_SKIP_WEB_SERVER=true`. Reuse lets Playwright use the configured readiness URL and start the server only if needed; skip never starts a server and expects one to already be listening.

## Writing Tests

1. Keep game rules in shared logic tests when behavior is canonical.
2. Use test fixtures that satisfy current shared validation rules instead of bypassing product behavior.
3. Prefer accessible queries and scoped `within(...)` queries for UI assertions.
4. Mock browser, Three.js, Zustand, and network boundaries through the existing setup utilities.
5. Run the narrowest failing test first, then the relevant suite or repository check before handing off.
