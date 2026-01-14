# Single Source of Truth Audit (Rules/Logic)

Date: 2026-01-14

## Goal
Consolidate all gameplay rules into a single canonical resolver so that actions, combat, abilities, and statuses cannot diverge across the reducer, action handlers, UI helpers, or legacy modules.

## Current Sources of Truth (Observed)
Primary
- `shared/logic/resolveAction.ts` — canonical action resolver (single entry point).
- `shared/logic/actions/*.ts` — domain action modules (movement/combat, construction, diplomacy, etc.).
- `shared/logic/combatResolver.ts` — combat math + ability effects (now via computeEffectiveStats + effects).
- `shared/logic/unitLogic.ts` — movement/attack gating + visibility and range checks.

Secondary / Partial / Legacy
- `shared/logic/unitActionHandlers.ts` — action-specific handlers (clear forest, build road, heal, stealth, rally, etc.).
- `shared/logic/unitActions.ts` — deprecated stubs (no rules).
- `shared/logic/combatSystem.ts` — deprecated wrappers (no rules).
- `shared/logic/abilitySystem.ts` — tech abilities with their own costs/logic.
- `shared/logic/statusEffects.ts` — morale debuff behavior and immunity checks.

UI/Client Rules
- `client/src/utils/unitAbilityState.ts` — action availability for UI (costs, cooldowns, tech checks).
- `client/src/lib/helpers/actionAvailabilityHelpers.ts` — movement/attack/ability gating; partially duplicates rules.
- `client/src/components/ui/AbilitiesPanel.tsx` — triggers actions; encodes side rules like capture targeting.

## Action Matrix (Current Implementation)

Action Type -> Primary Handler -> Other Implementations / Drift Risks

- MOVE_UNIT -> `handleMoveUnit` (actions/movementCombat)
  - UI gating: `actionAvailabilityHelpers.ts`

- ATTACK_UNIT -> `handleAttackUnit` (actions/movementCombat + combatResolver)
  - Legacy combat: `combatSystem.ts`

- END_TURN -> `handleEndTurn` (actions/turns)

- HEAL_UNIT -> `handleHealUnit` (unitActionHandlers)
  - Legacy healing logic: `combatSystem.ts`
  - UI availability: `unitAbilityState.ts`

- APPLY_STEALTH -> `handleApplyStealth` (unitActionHandlers)
  - UI availability: `unitAbilityState.ts`

- RECONNAISSANCE -> `handleReconnaissance` (unitActionHandlers)

- RALLY_TROOPS -> `handleRallyTroops` (unitActionHandlers)
  - UI availability/cooldown: `unitAbilityState.ts`, `actionAvailabilityHelpers.ts`

- FORMATION_FIGHTING -> `handleFormationFighting` (unitActionHandlers)
  - Combat effect: `combatResolver.ts`

- SIEGE_MODE -> `handleSiegeMode` (unitActionHandlers)
  - Combat effect: `combatResolver.ts`

- CLEAR_FOREST -> `handleClearForest` (unitActionHandlers)
  - Legacy clear forest: `unitActions.ts`

- BUILD_ROAD -> `handleBuildRoad` (unitActionHandlers)
  - Legacy build road: `unitActions.ts`

- COASTAL_EXPLORE -> `handleCoastalExplore` (unitActionHandlers)
  - UI text: `buildingEffects.ts`

- USE_ABILITY -> `handleUseAbility` (actions/abilities)
  - Tech ability implementations: `abilitySystem.ts`

- WORLD_ELEMENT_HARVEST/BUILD -> `handleWorldElementHarvest/Build` (actions/worldElements)
  - UI gating: `actionAvailabilityHelpers.ts` / `AbilitiesPanel.tsx`

- CONVERT_UNIT/CITY/VILLAGE -> actions/conversion + `conversion.ts`
  - Legacy convert logic: `combatSystem.ts`, `abilitySystem.ts`

- BUILD_UNIT/RECRUIT_UNIT/BUILD_IMPROVEMENT/BUILD_STRUCTURE/START_CONSTRUCTION
  -> actions/construction + `buildingRequirements.ts`/`constructionRules.ts`
  - UI gating: `BuildingMenu.tsx`, `actionAvailabilityHelpers.ts`

## Known Drift Risks
- Legacy modules (`unitActions.ts`, `combatSystem.ts`, `abilitySystem.ts`) encode conflicting costs/requirements.
- UI availability checks can diverge from reducer rules if not sourced from a shared predicate.
- Ability immunity logic (YOUNG_VIGOR) is not consistently applied when statuses are added manually.

## Target Architecture (Single Source of Truth)

**Canonical entry points**
- `shared/logic/resolveAction.ts` — the only place that applies game rules to actions.
- `shared/logic/resolveCombat.ts` — applies combat to state changes.
- `shared/logic/computeEffectiveStats.ts` — computes final stats used by combat and UI.

**Resolver output**
- `{ state, events, messages }` so UI and telemetry consume outputs without duplicating logic.

**Effect hooks (minimal)**
- `onComputeStats(unit, ctx)`
- `onBeforeAttack(attacker, defender, ctx)`
- `onAfterAttack(...)`
- `onTurnStart(unit/player)`
- `onAction(unit, actionType)`

## Migration Strategy (Phased)

Phase 0 — Scaffolding
- Add `resolveAction` as the canonical API.
- Add `resolveCombat` and `computeEffectiveStats` scaffolds.

Progress so far:
- `shared/logic/resolveAction.ts`, `shared/logic/resolveCombat.ts`, `shared/logic/computeEffectiveStats.ts` added.
- `client/src/lib/stores/useLocalGame.ts` now calls `resolveActionState()`.
- Tests and AI harness now call `resolveActionState()` instead of `gameReducer` directly.
- `resolveAction` now directly handles: HEAL_UNIT, APPLY_STEALTH, RECONNAISSANCE, FORMATION_FIGHTING, SIEGE_MODE, RALLY_TROOPS, CLEAR_FOREST, BUILD_ROAD, COASTAL_EXPLORE.
- `resolveAction` now directly handles: MOVE_UNIT, ATTACK_UNIT, END_TURN, all BUILD/RESEARCH/CONVERT/TRADE/DIPLOMACY actions, plus HARVEST_RESOURCE and ACTIVATE_FACTION_ABILITY.
- `resolveAction` no longer falls back to `gameReducer`; any new actions must be added here.

Phase 1 — Action migration
- Move action logic from `legacyHandlers.ts` into `shared/logic/actions/*`.
- `gameReducer.ts` is now a thin router that delegates to `resolveAction`.

Phase 2 — Effect system + combat
- Move ability/status effects into effect hooks.
- Replace ad‑hoc combat math with `computeEffectiveStats` + `resolveCombat`.

Phase 3 — Delete legacy rules
- Remove logic from `unitActions.ts`, `combatSystem.ts`, `abilitySystem.ts` (or convert to pure helpers).

Phase 4 — UI alignment
- UI helpers consume resolver outputs or shared predicates.

## Immediate TODOs
- Decide whether to delete or stub out `unitActions.ts` and `combatSystem.ts` (already deprecated).
- Move UI availability checks to shared predicates to avoid drift.
