# Tutorial Overlay Input-Layer Hardening Checklist

Source of truth checklist for a large/intense task.

## Metadata
- Created: 2026-02-07T19:02:11
- Last Updated: 2026-02-07T19:02:11
- Workspace: /Users/davedixon/Documents/GitHub/NewGenPromisedLand
- Checklist Doc: /Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/tutorial-overlay-input-layer-hardening-production-checklist.md

## Scope
- [x] Q-000 [status:verified] Capture explicit scope, constraints, and success criteria.
  - Scope: Find and fix pointer-event click-through/input-blocking regressions similar to tutorial modal bug for overlays rendered in/around `GameUI`.
  - Constraint: Preserve intended non-interactive overlays (`pointer-events-none`) and avoid changing gameplay semantics.
  - Success criteria: Interactive overlays explicitly capture pointer events; regression tests cover this bug class.

## Sign-off Gate
- [x] G-001 [status:verified] All queued work, findings, fixes, and validations are complete.
- [x] G-002 [status:verified] All findings are resolved or marked `accepted_risk` with rationale and owner.
- [x] G-003 [status:verified] Required validation suite has been rerun on the final code state.
- [x] G-004 [status:verified] Residual risks and follow-ups are documented.

## Rerun Matrix
- [x] G-010 [status:verified] If code changes after any checked `V-*`, reset affected validation items to unchecked.
- [x] G-011 [status:verified] Final sign-off only after a full validation pass completed after the last code edit.

## Audit Queue
- [x] Q-001 [status:verified] Create checklist and baseline scope.
- [x] Q-002 [status:verified] Complete discovery/audit of impacted systems.
- [x] Q-003 [status:verified] Implement required changes.
- [x] Q-004 [status:verified] Expand or update automated tests.
- [x] Q-005 [status:verified] Run full validation suite.
- [x] Q-006 [status:verified] Final code-quality pass and sign-off review.

## Findings Log
- [x] F-001 [status:verified] [P1] [confidence:0.97] Tutorial overlays (`TutorialOverlay`, `TutorialLibrary`) did not opt into pointer events under `GameUI` root `pointer-events-none`, causing click-through to game map.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TutorialOverlay.tsx:48`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TutorialLibrary.tsx:28`.
  - Owner: codex
  - Linked Fix: P-001
- [x] F-002 [status:verified] [P1] [confidence:0.90] Desktop `GameLogPanel` collapsed button/expanded panel lack `pointer-events-auto` under `GameUI` root, making interaction vulnerable to click-through/non-registration.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/GameLogPanel.tsx:171`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/GameLogPanel.tsx:191`.
  - Owner: codex
  - Linked Fix: P-002
- [x] F-003 [status:verified] [P2] [confidence:0.85] Full-screen transition overlays (`AITurnIndicator`, `TurnTransition`) lack explicit pointer-event opt-in under `GameUI`, so they do not reliably block background world input.
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/AITurnIndicator.tsx:444`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TurnTransition.tsx:55`.
  - Owner: codex
  - Linked Fix: P-003
- [x] F-004 [status:verified] [P2] [confidence:0.74] `data-ui-layer="modal"` components rely on implicit pointer-event inheritance; missing an explicit global guard makes this bug class easy to reintroduce.
  - Evidence: multiple modal components under `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/` with `data-ui-layer` attributes and mixed class-level pointer-event declarations.
  - Owner: codex
  - Linked Fix: P-004
- [x] F-005 [status:verified] [P2] [confidence:0.88] Modal-layer semantics were duplicated manually across overlays, making future drift/regressions likely.
  - Evidence: repeated manual `data-ui-layer` + dialog semantics in tutorial/transition overlays before shared abstraction.
  - Owner: codex
  - Linked Fix: P-005
- [x] F-006 [status:verified] [P2] [confidence:0.86] No real-browser canary existed to verify tutorial modal clicks do not reach world-map handlers.
  - Evidence: e2e suite had no tutorial input-blocking assertion under `test/e2e/` before this pass.
  - Owner: codex
  - Linked Fix: P-006

## Fix Log
- [x] P-001 [status:verified] Added `pointer-events-auto` to tutorial overlay backdrops.
  - Addresses: F-001
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TutorialOverlay.tsx:48`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TutorialLibrary.tsx:28`; regression tests in `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test/TutorialModalInputBlocking.test.tsx`.
- [x] P-002 [status:verified] Add pointer-event opt-in to desktop `GameLogPanel` interactive roots.
  - Addresses: F-002
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/GameLogPanel.tsx:171`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/GameLogPanel.tsx:191`.
- [x] P-003 [status:verified] Add pointer-event opt-in to `AITurnIndicator` and `TurnTransition` fullscreen overlays.
  - Addresses: F-003
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/AITurnIndicator.tsx:444`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/AITurnIndicator.tsx:445`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/AITurnIndicator.tsx:469`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TurnTransition.tsx:55`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TurnTransition.tsx:56`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TurnTransition.tsx:70`.
- [x] P-004 [status:verified] Add global `data-ui-layer` pointer-event safety guard and tutorial layer labeling to reduce regression risk.
  - Addresses: F-004
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/index.css:40`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TutorialOverlay.tsx:49`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TutorialLibrary.tsx:29`.
- [x] P-005 [status:verified] Added shared `ModalLayer` / `ModalLayerContent` primitive and migrated touched overlays to use it.
  - Addresses: F-005
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/primitives/ModalLayer.tsx:1`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TutorialOverlay.tsx:5`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TutorialLibrary.tsx:4`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/AITurnIndicator.tsx:5`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/TurnTransition.tsx:6`, `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/client/src/components/ui/GameLogPanel.tsx:5`.
- [x] P-006 [status:verified] Added Playwright browser canary to assert tutorial buttons close modal without map click-through.
  - Addresses: F-006
  - Evidence: `/Users/davedixon/Documents/GitHub/NewGenPromisedLand/test/e2e/tutorial-overlay-input-blocking.spec.ts:1`.

## Validation Log
- [x] V-001 [status:verified] `npm run check`
  - Evidence: 2026-02-07 local run passed (`tsc`), after tutorial overlay fix and after new tutorial regression tests.
- [x] V-002 [status:verified] `npx vitest run test/TutorialModalInputBlocking.test.tsx`
  - Evidence: 2026-02-07 local run passed (3/3 tests).
- [x] V-003 [status:verified] `npx vitest run test/TutorialModalInputBlocking.test.tsx test/OverlayPointerEventsCanary.test.tsx`
  - Evidence: 2026-02-08 final local rerun passed (7/7 tests).
- [x] V-004 [status:verified] `npm run check` (final rerun after all edits)
  - Evidence: 2026-02-08 final local rerun passed (`tsc`).
- [x] V-005 [status:verified] `python3 /Users/davedixon/.codex/skills/intense-job-checklist/scripts/validate_checklist.py "/Users/davedixon/Documents/GitHub/NewGenPromisedLand/docs/tutorial-overlay-input-layer-hardening-production-checklist.md"`
  - Evidence: 2026-02-07 run passed (Warnings: 0, Errors: 0).
- [x] V-006 [status:verified] `npx eslint client/src/components/ui/AITurnIndicator.tsx client/src/components/ui/TurnTransition.tsx client/src/components/ui/GameLogPanel.tsx client/src/components/ui/TutorialOverlay.tsx client/src/components/ui/TutorialLibrary.tsx test/OverlayPointerEventsCanary.test.tsx test/TutorialModalInputBlocking.test.tsx`
  - Evidence: 2026-02-08 targeted lint run passed (0 errors, 0 warnings).
- [x] V-007 [status:verified] `npx eslint client/src/components/primitives/ModalLayer.tsx client/src/components/ui/TutorialOverlay.tsx client/src/components/ui/TutorialLibrary.tsx client/src/components/ui/AITurnIndicator.tsx client/src/components/ui/TurnTransition.tsx client/src/components/ui/GameLogPanel.tsx test/OverlayPointerEventsCanary.test.tsx test/TutorialModalInputBlocking.test.tsx test/e2e/tutorial-overlay-input-blocking.spec.ts`
  - Evidence: 2026-02-08 targeted lint rerun passed (0 errors, 0 warnings).
- [x] V-008 [status:verified] `npx vitest run test/TutorialModalInputBlocking.test.tsx test/OverlayPointerEventsCanary.test.tsx`
  - Evidence: 2026-02-08 post-refactor rerun passed (7/7 tests).
- [x] V-009 [status:verified] `npx playwright test test/e2e/tutorial-overlay-input-blocking.spec.ts --project=chromium`
  - Evidence: 2026-02-08 browser canary passed (2/2 tests).
- [x] V-010 [status:verified] `npm run check`
  - Evidence: 2026-02-08 post-refactor rerun passed (`tsc`).

## Residual Risks
- [x] R-001 [status:accepted_risk] Overlay components using third-party dialog portals may mask pointer-event inheritance bugs in local testing.
  - Rationale: Some modals may work today due to portal behavior rather than explicit pointer-event handling.
  - Owner: codex
  - Follow-up trigger/date: Re-audit when dialog libraries or modal architecture changes.

## Change Log
- 2026-02-07T19:02:11: Checklist initialized.
- 2026-02-07T19:06:00: Scoped canary audit; logged findings F-002..F-004 and planned fixes P-002..P-004.
- 2026-02-07T19:09:00: Implemented pointer-event hardening across canary overlays, added overlay canary tests, and reran validation commands.
- 2026-02-07T19:12:00: Completed sign-off gates and recorded accepted residual risk.
- 2026-02-08T00:20:00: Added modal-layer semantics to fullscreen transition overlays, reran lint/tests/types, and refreshed final evidence.
- 2026-02-08T00:22:00: Strengthened canary assertions for modal semantics (`data-ui-layer`, `aria-modal`) and revalidated lint/tests/types.
- 2026-02-08T00:30:00: Added shared modal-layer primitive, migrated touched overlays, added Playwright click-through canary, and reran lint/vitest/playwright/tsc.
