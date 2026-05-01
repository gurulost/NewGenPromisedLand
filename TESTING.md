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

# Focused map-generation regression and module-boundary suite
npm run test:map

# Public asset and Git LFS hydration guard
npm run assets:verify

# Run a targeted Vitest file or set of files
npx vitest run test/CityPanelIntegration.test.tsx
npx vitest run test/CityPanelIntegration.test.tsx shared/components/VictoryScreen.test.tsx

# Watch mode for local development
npx vitest watch

# Accessibility and performance subsets
npx vitest run test/a11y
npm run test:performance

# E2E tests
npm run test:e2e
npm run test:e2e:chromium
npm run test:e2e:matrix
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
- **Map generation tests**: deterministic characterization, capitals, water, settlements, resources, ruins, statistical fairness, and module-boundary coverage through `npm run test:map`.
- **Active faction ability tests**: data contract, shared availability, resolver effects, UI gating, AI use/skip heuristics, and deterministic ideal/blocked/marginal balance scenarios.
- **Playwright E2E tests**: browser-level flows under `test/e2e`.

## CI and Release Guardrails

CI uses `npm run check`, not the narrower `npm run typecheck`, so type checks and repository hygiene run together.

CI has a dedicated `map-generator-suite` merge gate for `npm run test:map`. It intentionally duplicates the map tests that are also covered by the full Vitest suite so map-generation regressions are visible as a focused failure. Any change to `shared/utils/mapGenerator.ts`, `shared/utils/mapGeneration*.ts`, `client/src/workers/mapGeneratorWorker.ts`, or map-generation report semantics should run this suite locally before handoff. Run `npm run test:performance` and `npm run build` as well when a map change touches tile-wide loops, water repair, pathfinding-style searches, resource placement, candidate sorting, or worker import/export shape.

CI has a dedicated `asset-integrity` merge gate. It checks out Git LFS assets, runs `git lfs fsck`, and runs `npm run assets:verify`. The asset verifier fails if any `client/public` file is still a Git LFS pointer, if any `.glb` file is not a hydrated GLB v2 binary with a matching header length, or if any public asset over 5 MiB is not covered by the Git LFS filter. Asset-dependent CI jobs also run the same verifier before building, running Vitest, running E2E tests, or running Lighthouse, which prevents release artifacts and browser tests from silently using pointer files instead of real assets.

CI also has a dedicated `performance-tests` job for `npm run test:performance`, and Lighthouse remains part of the blocking PR merge gate. The performance job intentionally does not perform an LFS checkout; asset hydration confidence comes from `asset-integrity` and the jobs that actually need public assets.

Active faction ability changes must treat `shared/data/factionAbilitySpecs.ts`, `shared/logic/factionAbilityAvailability.ts`, resolver behavior, UI availability, and AI heuristics as one coupled surface. Any ability marked `active` must have a canonical spec, shared availability gate, resolver effect, UI ready/blocked text, AI rule, and tests.

Run this focused active-ability gate for ability contract or tuning work:

```bash
npx vitest run test/unit/AbilityDataIntegrity.unit.test.ts test/unit/FactionAbilityHeuristics.unit.test.ts test/unit/FactionAbilityBalanceScenarios.unit.test.ts test/unit/FactionAbilities.unit.test.ts test/unit/AbilityOwnership.unit.test.ts test/unit/FactionAbilityButtons.unit.test.tsx test/unit/CombatAbilities.unit.test.ts shared/logic/activeEffects.test.ts
npm run check
```

Playwright starts the app through the configured `webServer` using `npm run dev:e2e`, which avoids the `tsx` CLI IPC path used by the normal dev server. Its readiness probe targets the app shell by default instead of `__health`, because E2E runs disable the save API and should not require a local Postgres role just to start browser tests.

The blocking pull request and push E2E gate is Chromium only: `npm run test:e2e:chromium -- test/e2e --reporter=html`. That is the required merge signal because it exercises the core browser gameplay flows with the most stable CI browser. A scheduled weekday job and manual `workflow_dispatch` job run the broader desktop/mobile/tablet matrix with `PLAYWRIGHT_FULL_MATRIX=true` and `PLAYWRIGHT_WORKERS=1`; that job uploads a Playwright report and is intentionally non-blocking. Full-matrix failures should be triaged before a release candidate, but they do not block routine PRs unless they reproduce in Chromium or in an isolated targeted rerun.

Local `npm run test:e2e` uses the broader project matrix from `playwright.config.ts`. Use `npm run test:e2e:matrix` when you want the same one-worker shape as the scheduled full-matrix job, and use `npm run test:e2e:chromium` when you want the same blocking gate that CI enforces.

Current E2E confidence note from April 30, 2026: the Chromium gate passed 9/9 after running outside the local sandbox so Playwright could bind its web server. Two local full-matrix attempts completed with 51 passing tests, 2 intentional mobile viewport skips, and 1 isolated browser-run failure each. The failed Firefox tutorial-overlay case passed immediately in a targeted Firefox rerun, and the failed mobile Safari handoff case passed immediately in a targeted mobile Safari rerun. No deterministic product regression was found in those attempts; until repeated clean full-matrix runs are captured, Chromium remains the blocking CI gate and the full matrix remains the scheduled release-confidence signal.

For local debugging against a server you already started, run `npm run dev:e2e` in one terminal and then run Playwright with either `PLAYWRIGHT_REUSE_SERVER=true` or `PLAYWRIGHT_SKIP_WEB_SERVER=true`. Reuse lets Playwright use the configured readiness URL and start the server only if needed; skip never starts a server and expects one to already be listening.

## Writing Tests

1. Keep game rules in shared logic tests when behavior is canonical.
2. Use test fixtures that satisfy current shared validation rules instead of bypassing product behavior.
3. Prefer accessible queries and scoped `within(...)` queries for UI assertions.
4. Mock browser, Three.js, Zustand, and network boundaries through the existing setup utilities.
5. Run the narrowest failing test first, then the relevant suite or repository check before handing off.
