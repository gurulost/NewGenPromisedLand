# Faction Expansion 8F Implementation Checklist

Status: COMPLETE
Owner: Codex
Last Updated: 2026-02-06 (post-implementation hardening pass)
Branch Target: `codex/factions-8-hagoth-amulonites`

This file is the source of truth for completion and production sign-off for expanding from 6 factions to 8 factions.

## Completion Rule

- Work is not complete until every required item below is checked and validation gates pass.
- Any newly discovered blocker or dependency must be added here before proceeding.

## 0) Preflight and Process

- [x] Create implementation branch `codex/factions-8-hagoth-amulonites`.
- [x] Keep this checklist updated after each completed step.
- [x] Run baseline checks before major edits:
  - [x] `npm run check`
  - [x] `npm run lint`
  - [x] `npx vitest run shared/data/factions.test.ts shared/data/units.test.ts shared/logic/unitLogic.test.ts`

## 1) Hard Blockers (Must Update)

- [x] Add new faction IDs in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/types/factionId.ts`.
- [x] Add full faction objects in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/data/factions.ts`.
- [x] Add city name pools in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/data/cityNames.ts`.
- [x] Add homeland modifiers in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/utils/mapGenerator.ts`.
- [x] Ensure schema-driven faction tests pass in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/data/factions.test.ts`.

## 2) New Factions Data Packets

### Hagoth's Mariners (`HAGOTHS_MARINERS`)

- [x] Faction metadata (id/name/description/color).
- [x] Starting stats: `faith: 60, pride: 45, internalDissent: 25`.
- [x] Abilities:
  - [x] `SHIPBUILDING_TRADITION` (passive metadata).
  - [x] `NORTHWARD_VENTURES` (passive metadata).
- [x] Playstyle/strengths/weaknesses.
- [x] City names (10+).
- [x] Homeland spawn identity.

### Amulonites (`AMULONITES`)

- [x] Faction metadata (id/name/description/color).
- [x] Starting stats: `faith: 20, pride: 70, internalDissent: 55`.
- [x] Abilities:
  - [x] `BONDAGE_TASKMASTERS` (passive metadata).
- [x] Playstyle/strengths/weaknesses.
- [x] City names (10+).
- [x] Homeland spawn identity.

## 3) Unit Additions (Required)

- [x] Add unit types to schema in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/types/unit.ts`:
  - [x] `voyager`
  - [x] `shipwright`
  - [x] `taskmaster`
  - [x] `amulonite_enforcer`
- [x] Add unit definitions in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/data/units.ts`.
- [x] Add technology gates:
  - [x] `voyager` -> `sailing`
  - [x] `shipwright` -> `seafaring`
  - [x] `taskmaster` -> `organization`
  - [x] `amulonite_enforcer` -> `bronze_working`
- [x] Add faction gating via `factionSpecific`.
- [x] Confirm all stat constraints satisfy tests (`attack/defense/movement/visionRadius/attackRange > 0`).

## 4) Runtime Hooks (Gameplay Identity)

- [x] Hagoth port bonus in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/logic/actions/turns.ts` (`calculatePlayerStarIncome`), non-stacking with Seafaring.
- [x] Amphibious movement behavior in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/logic/unitLogic.ts`:
  - [x] `isPassableForUnit`
  - [x] `getMovementCostForCoordinate`
- [x] Amulonite taskmaster intimidation aura in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/logic/actions/turns.ts`.
- [x] End-turn event emission for intimidation aura (`INTIMIDATION_AURA`) in turn resolution.

## 5) UI and UX Integration

- [x] Add new event union support in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/types/game.ts` for `INTIMIDATION_AURA`.
- [x] Add `INTIMIDATION_AURA` handling in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/components/game/GameUI.tsx`.
- [x] Add HUD readout parity in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/components/hud/PlayerHUD.tsx`.
- [x] Add model mappings in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/utils/modelManager.ts`.
- [x] Add unit render scales in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/components/game/UnitModel.tsx`.
- [x] Add faction icon mappings in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/components/primitives/ThematicIcons.tsx`.

## 6) AI Integration and Correctness

- [x] Fix personality key mismatch in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/ai/aiFactionPersonality.ts`.
- [x] Add personality templates:
  - [x] `hagoths-mariners`
  - [x] `amulonites`
- [x] Normalize AI naval logic away from `unit.type === 'boat'` in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/ai/aiEngine.ts`.
- [x] Ensure explorer/naval logic accounts for new naval transport units (e.g., voyager).

## 7) Starting Stats and Economy Parity

- [x] Make faction starting stats effective in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/lib/stores/useLocalGame.ts` (standard game init path).
- [x] Align selector star-income math with runtime Hagoth rule in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/selectors/player.ts`.
- [x] Keep tutorial scenario intentional; if not using faction defaults there, document that choice.
  - Tutorial flow remains intentionally curated with fixed stats in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/lib/stores/useLocalGame.ts`.

## 8) Naval Tag Consistency Outside Movement

- [x] Update world-element naval tag checks in:
  - [x] `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/logic/worldElementActions.ts`
  - [x] `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/logic/actions/worldElements.ts`
- [x] Update wording from "Boat" to "naval transport unit" where applicable.

## 9) Player Capacity / Selection UX

- [x] Raise local setup max seats 6 -> 8 in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/components/ui/PlayerSetup.tsx`.
- [x] Update setup copy strings that mention 6 players.
- [x] Confirm faction uniqueness constraints still behave correctly with 8 factions.
- [x] (Optional) Evaluate online default max players in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/server/routes.ts`.
- [x] (Optional) Evaluate DB default max players in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/schema.ts`.

## 10) Docs Explicitly Mentioning 6 Factions

- [x] Update `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/replit.md`.
- [x] Update `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/TESTING.md`.
- [x] Update `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/FINAL_TESTING_SUMMARY.md`.
- [x] Update `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/TESTING_REPORT.md`.

## 11) Tests to Add/Update

- [x] `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/types/factionId.test.ts` for new IDs and coercion.
- [x] `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/data/units.test.ts` for new unit types and gating consistency.
- [x] `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/shared/logic/unitLogic.test.ts` for amphibious behavior.
- [x] Add/extend turn-resolution tests for:
  - [x] Hagoth port bonus behavior.
  - [x] Amulonite intimidation aura behavior.
- [x] Add/extend AI personality tests for key mapping correctness and new templates.
- [x] Add/extend UI selector parity tests for Hagoth port income in `/Users/davedixon/.codex/worktrees/b152/NewGenPromisedLand/client/src/selectors/__tests__/player.test.ts`.

## 12) Production Sign-off Gates

- [x] `npm run check` passes.
- [x] `npm run lint` passes.
- [x] Targeted unit tests pass.
- [x] Full unit suite (`npx vitest run test/unit --coverage`) passes.
- [x] Smoke AI sim executes without runtime errors.
- [x] Manual sanity check equivalent completed:
  - Validated via reducer-level faction hook tests (`test/unit/FactionExpansionHooks.unit.test.ts`) and faction/unit gating consistency audit.

## Discovery Log (Additive)

- [x] Added requirement: AI naval systems currently hardcode `boat`; normalized to naval transport capability.
- [x] Added requirement: HUD star production selector must mirror reducer Hagoth port bonus logic.
- [x] Added requirement: world element naval checks and messaging boat-specific logic generalized.
- [x] Added requirement: AI simulation smoke script was broken (`ts-node`/`uuid` dependency mismatch); fixed to `tsx` + `randomUUID` and validated.
- [x] Added requirement: enforce faction personality key mapping for uppercase IDs via tests.
- [x] Added requirement: normalize/coerce legacy faction id formats (hyphens/spaces/apostrophes/casing) to avoid runtime drift in hooks/selectors/AI.
- [x] Added requirement: harden AI faction resolution fallback and nullish-template defaults to prevent undefined faction crashes and numeric default drift.
- [x] Added requirement: use unit passability checks in AI movement helpers to reduce invalid movement intents.
