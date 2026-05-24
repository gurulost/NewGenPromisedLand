# Public Release Readiness Rubric

Last reviewed: 2026-05-23

This rubric defines what "ready to go public" means for Covenant Legends. It is intentionally stricter than "the branch is clean" or "the app deployed."

Use this before a public launch, public multiplayer announcement, major Replit republish, or answer to "can this go public?"

## Verdicts

- **Not Ready**: repo, deploy, or critical gameplay confidence is missing.
- **Deploy Candidate**: local gates are green and GitHub is current, but live deployment has not passed public smoke.
- **Public V1 Ready**: live production URL serves the expected build and core public player paths pass.
- **Ranked/Competitive Ready**: public V1 is stable and hidden-state, audit, timeout, fairness, and longer soak criteria are proven. This is not the default bar.

## Release Gates

### 1. Repo And Build Truth

Required for Deploy Candidate:

- `git status --short --branch` is clean or all dirty docs/artifacts are intentionally excluded.
- Local branch is not ahead of or behind `origin/main` unless the release branch strategy explicitly says so.
- `npm run check` passes.
- `npm run lint` and `npm run lint:hooks` pass when client code changed.
- `npm run build` passes.
- `npm run assets:verify` passes when public assets, metadata, models, or release packaging changed.
- `git diff --check` has no whitespace errors.

### 2. Gameplay Rule Confidence

Required when gameplay changed:

- Mutating behavior flows through `resolveAction` or shared action helpers.
- UI/AI legality flows through `ruleQueries` or documented shared adapters.
- Targeted shared-logic tests cover changed costs, targets, cooldowns, action availability, status effects, visibility, and end-turn behavior.
- No new direct legality imports from client or AI surfaces bypass the canonical rule-query path.

### 3. UI, Input, And Onboarding Confidence

Required when player-facing UI changed:

- No blocking overlay, tutorial, modal, or chat surface leaks clicks to the map.
- Public multiplayer started matches suppress or simplify blocking tutorials during turn handoff.
- Mobile and desktop layouts do not clip or overlap critical text and controls.
- Accessibility queries and names remain stable for major dialogs and controls.
- Layout-sensitive changes have Playwright, screenshot, or equivalent browser verification.

### 4. Multiplayer Confidence

Required for Public V1 Ready:

- Production bundle preflight confirms the deployed build has current multiplayer hooks.
- Public mode is enabled only with server-authoritative settings and shared realtime configured.
- `npm run test:live:multiplayer -- --players=3 --rounds=4 --build-id=<deployed-build-id>` passes against `https://covenantlegends.com`.
- The live smoke report has `issueCount: 0` or all nonzero issues are explicitly accepted as non-release-blocking.
- Temporary smoke users are reused through `COVENANT_SMOKE_USER_PASSWORD` / `COVENANT_SMOKE_USERS` or are clearly tagged in the report.
- The temporary lobby is deleted unless intentionally kept for debugging.

Required before Ranked/Competitive claims:

- `npm run test:live:multiplayer:soak -- --players=4 --rounds=10 --build-id=<deployed-build-id>` passes.
- Soak covers reload/reconnect, active-player disconnect, host leave/claim, and eliminated-player handoff.
- Player-scoped state projection is checked for hidden enemy units and unrevealed resources/features.
- Server-owned timeout and AI advancement paths are verified live.
- Public action audit and snapshot checkpoint rows are present in production Postgres.

### 5. Deployment And Runtime Truth

Required for Public V1 Ready:

- The public URL, not only Replit preview, serves the expected build.
- Build id, commit metadata, or a unique marker proves bundle freshness.
- Required production envs are configured for the selected mode.
- Replit deployment topology matches the mode:
  - private/demo host-mediated mode needs one process or sticky single-instance behavior.
  - public authoritative mode needs shared realtime such as Postgres `LISTEN/NOTIFY`.
- If Replit or a platform process is stale, republish/restart and verify again before diagnosing code.

### 6. Production Surface

Required for Public V1 Ready:

- `https://covenantlegends.com/` is the SEO/indexing audit target.
- Replit preview `noindex` does not count as production indexing failure.
- PWA/social metadata and sitemap/robots changes are verified by tests and the served public URL when relevant.
- Save API disabled mode is quiet for reads and fails closed for writes.
- Error reporting and bug-report entry points remain available enough for public feedback.

## Public Readiness Answer Format

When asked "can this go public?", answer with:

1. Verdict: Not Ready, Deploy Candidate, Public V1 Ready, or Ranked/Competitive Ready.
2. Evidence: commit/build, deploy URL, gates run, live smoke report path and issue count.
3. Risks: unresolved release blockers or accepted risks.
4. Next action: the exact command or deploy step needed.

Do not answer "yes" based only on local tests. Public readiness requires live deployed proof.
