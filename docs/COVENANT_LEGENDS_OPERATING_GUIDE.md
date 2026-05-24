# Covenant Legends Operating Guide

Last reviewed: 2026-05-23

This is the repo-specific operating guide for future Covenant Legends work. It consolidates project goals, architecture rules, design principles, multiplayer assumptions, recurring bug classes, validation standards, and artifact decisions that emerged across recent Codex sessions.

It is active guidance. If it conflicts with a more specific current doc, update this guide or the specific doc so future work does not split into competing truths.

This guide does not replace `TESTING.md` or the `newgen-regression-guard` skill. Use it to choose the right mental model and source documents; use those artifacts for exact command matrices.

## First Principles

- Covenant Legends is a browser-first, 2.5D turn-based strategy game inspired by the Book of Mormon. The product direction is closer to Polytopia/Civilization gameplay than a narrative demo.
- Quality expectations are production-grade. Do not frame current work as throwaway prototype polish when the actual goal is a public, playable strategy game.
- Gameplay clarity matters more than decorative UI. Players should see costs, requirements, immediate effects, and consequences without guessing hidden rules.
- Public multiplayer must be treated as adversarial/untrusted. Private/demo multiplayer may remain host-mediated, but public mode needs server authority, projected state, and live smoke proof.
- Active docs and current code are the source of truth. Archived checklists are forensic context, not operating guidance.

## Canonical Reading Order

For any substantial task, start with:

1. `README.md`
2. `docs/README.md`
3. `AGENTS.md`
4. The active reference for the surface being changed:
   - rules: `docs/RULES_SINGLE_SOURCE_OF_TRUTH.md`
   - multiplayer: `docs/MULTIPLAYER_PUBLIC_AUTHORITATIVE.md` and `docs/MULTIPLAYER_PRIVATE_DEMO_REPLIT.md`
   - UI: `docs/ui-style-guide.md`
   - units/abilities: `docs/UNIT_SYSTEM_DESIGN.md` and `docs/ACTIVE_FACTION_ABILITIES.md`
   - testing: `TESTING.md`
   - Replit/runtime: `replit.md`

Use `docs/archive/` only after checking the active docs.

## Architectural Invariants

### Gameplay Rules

- `shared/logic/resolveAction.ts` is the canonical mutation path.
- `shared/logic/gameReducer.ts` is a compatibility router, not the place to add new policy.
- `shared/logic/ruleQueries.ts` is the canonical non-mutating legality/explanation path for UI and AI.
- `shared/data/gameRules.ts` owns balance constants. Do not hide balance values in components.
- UI and AI may rank, display, and explain options, but legality should come from shared logic.
- If a change affects action availability, targeting, cost, cooldown, visibility, status effects, or turn flow, add or update resolver/rule-query tests.

### UI And Input Shell

- Gameplay UI should be dense, readable, and repeat-use friendly. Prefer panels, rows, tabs, lists, and clear hierarchy over decorative card stacks.
- Interactive overlays, modals, tutorials, chat, and fullscreen blockers must explicitly own pointer events and hotkey blocking.
- Public multiplayer should not interrupt real players with blocking tutorial overlays during turn handoff or active turns.
- Special routes and modals must stay inside the expected provider shell unless there is a documented reason.
- Text must fit at mobile and desktop sizes. Layout-sensitive UI needs browser or screenshot verification, not only unit tests.

### Multiplayer

- Private/demo mode is host-mediated. It is suitable for trusted invite play only when deployment topology is compatible with process-local realtime assumptions.
- Public mode is server-authoritative and separate from private/demo mode.
- Public clients submit intents through `POST /api/lobbies/:code/actions/submit`.
- Public state reads must use player-scoped projected snapshots through `GET /api/lobbies/:code/state`.
- Public mode must fail closed if shared realtime, public-mode flags, or build/version gates are missing.
- Public production lobbies should remain unranked until deployed live smoke/soak proves stability and hidden-state projection.

### Replit And Deployment Truth

- Git clean, Git pushed, Replit published, and live bundle freshness are different facts.
- For production indexing and SEO, audit `https://covenantlegends.com/`, not Replit preview URLs.
- Replit preview `noindex` behavior is expected and should not be treated as a production SEO failure.
- After env or build-id changes, verify the deployed process and live bundle markers before diagnosing product code.

## Gameplay And Design Principles

- Strategy information should be visible before commitment: requirements, costs, legal targets, immediate outcomes, and permanent effects.
- Moral/religious systems should be mechanically meaningful, not just themed labels. Faith, Pride, Dissent, diplomacy, economy, and war should create tradeoffs.
- Public V1 should optimize for reliable unranked play before competitive/ranked promises.
- AI is acceptable as an internal/playtest opponent when it uses canonical shared legality. It should not be described as polished strategic play until difficulty, diplomacy, personality/data references, and long-run behavior are validated.
- Balance changes should be intentional and data-backed. Characterization or golden-output changes are gameplay decisions, not snapshot churn.
- Visual polish should support map readability, action clarity, and faction identity.

## Recurring Bug Classes

Use these as search prompts before editing:

- Canonical rule drift: behavior added in React, Zustand, AI, or legacy helpers instead of shared resolver/rule queries.
- Cross-layer multiplayer drift: lobby UI, sync hooks, server policy/routes, turn ownership, and recovery behavior changed in only one layer.
- Overlay/input leaks: tutorial, modal, chat, or fullscreen UI click-throughs, missing providers, or global hotkeys firing under blockers.
- Worktree/merge loss: implementation moved without paired tests or companion UI/server/store changes.
- Replit deploy staleness: Git says synced but the public bundle is still old.
- Live smoke hygiene: temporary production users are unbounded or unlabelled.
- Browser/runtime edge cases: audio volume writes outside `[0, 1]`, local listener `EPERM`, provider credentials missing locally, or stale session/runtime env.

## Validation Standards

Always finish code or config changes with `npm run check` plus the surface-specific gates in `TESTING.md` and `newgen-regression-guard/references/validation-matrix.md`.

Choose the validation surface deliberately:

- Shared rules or legality: reducer/resolver/rule-query tests plus the nearest action-specific regression.
- Active abilities: the active-ability gate documented in `TESTING.md`.
- Multiplayer/lobby: lobby UI, server policy, realtime broker, online sync, and shared multiplayer sync tests together.
- Overlays/hotkeys/providers: modal/input blocking tests plus browser checks when layout or handoff behavior changes.
- Map generation: `npm run test:map`, with performance/build coverage for tile-wide loops or worker shape changes.
- Assets/metadata/PWA: asset verification, metadata tests, production build, and published-domain checks when public indexing is in scope.
- Live public multiplayer: smoke after deploy; soak before broad public confidence or ranked/competitive claims.

If a command fails because of sandbox limitations like `listen EPERM`, rerun in an appropriate local/elevated environment before calling the product broken.

## Artifact Decisions

| Topic | Artifact | Reason |
| --- | --- | --- |
| Project-specific operating behavior | This guide | Broad enough to centralize product, architecture, multiplayer, and validation guidance. |
| Non-negotiable agent behavior | `AGENTS.md` rule plus recurring bug lessons | Future agents need short, always-loaded rules. |
| Public launch confidence | `docs/PUBLIC_RELEASE_READINESS_RUBRIC.md` | Release readiness is recurring and needs a crisp go/no-go rubric. |
| Regression workflow | Existing `newgen-regression-guard` skill | Already covers the enforceable repo-specific validation behavior; do not duplicate it with a second skill. |
| Routine surface checks | Existing `TESTING.md` plus this guide | Keep commands close to the repo rather than scattering per-task checklists. |
| Ranked multiplayer balance, final AI personality, monetization, long-term liveops | No artifact yet | Too speculative until live unranked play, telemetry, and player feedback exist. |

## Operating Rule For Future Agents

Before substantial Covenant Legends work, classify the task by coupled surface: rules, UI/input, multiplayer/authority, map generation, assets/metadata, AI, deployment/runtime, or docs. Read the relevant active doc, preserve canonical ownership, add the narrowest regression test for known bug classes, and finish with validation evidence tied to the changed surface.
