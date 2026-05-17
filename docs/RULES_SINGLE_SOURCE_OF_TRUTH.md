# Single Source of Truth Status (Rules/Logic)

Last reviewed: 2026-04-30

## Purpose

Keep gameplay rules from splitting across reducers, UI helpers, legacy modules, and tests. This file is active guidance, not an old audit log.

## Current Policy

- `shared/logic/resolveAction.ts` is the canonical action entry point.
- `shared/logic/gameReducer.ts` is a compatibility wrapper that delegates to `resolveActionState()`.
- `shared/logic/ruleQueries.ts` is the canonical non-mutating legality/explanation entry point for UI and AI.
- `shared/logic/actionPreconditions.ts` owns shared actor, turn, and city-ownership preconditions used by both `resolveAction` and rule queries.
- Domain action behavior belongs in `shared/logic/actions/*` or shared logic helpers, not React components or Zustand stores.
- Combat behavior belongs in `shared/logic/combatResolver.ts`, `shared/logic/computeEffectiveStats.ts`, `shared/logic/effects.ts`, and `shared/logic/statusEffects.ts`.
- Movement, range, passability, and action-count primitives may live in `shared/logic/unitLogic.ts`, but UI and AI command legality must consume them through `shared/logic/ruleQueries.ts`.
- Rendering-only fog and visible-unit helpers belong behind `shared/logic/visibilityQueries.ts`; command legality must not be added there.
- UI and AI action availability must flow through `shared/logic/ruleQueries.ts`. React components, Zustand stores, selectors, and AI engines must not import gameplay legality helpers directly.
- Unit and ability definitions in `shared/data/*` describe available content; they are not implementation by themselves.

## Ownership Matrix

| Action family | Mutation owner | Legality/explanation owner | UI/AI adapter |
| --- | --- | --- | --- |
| Shared preconditions | `resolveAction.ts` | `actionPreconditions.ts` | `ruleQueries.ts` |
| `MOVE_UNIT`, `ATTACK_UNIT` | `actions/movementCombat.ts`, `combatResolver.ts` | `ruleQueries.ts`, `unitLogic.ts`, `combatResolver.ts` | selectors, panels, and AI consume `ruleQueries.ts` |
| `END_TURN` | `actions/turns.ts` | `ruleQueries.ts`, `turnOrder.ts` | stores dispatch only |
| Unit tactical actions | `unitActionHandlers.ts` via `resolveAction.ts` | `ruleQueries.ts`, `actionAvailability.ts`, `unitLogic.ts` | `actionAvailabilityHelpers.ts` formats shared results |
| `USE_ABILITY`, `ACTIVATE_FACTION_ABILITY` | `actions/abilities.ts` | `ruleQueries.ts`, `factionAbilityAvailability.ts` | ability UI and AI consume `ruleQueries.ts` |
| `WORLD_ELEMENT_HARVEST`, `WORLD_ELEMENT_BUILD` | `actions/worldElements.ts` | `ruleQueries.ts`, `worldElementActions.ts` | world-element UI and AI consume `ruleQueries.ts` |
| `CONVERT_UNIT`, `CONVERT_CITY`, `CONVERT_VILLAGE` | `actions/conversion.ts`, `conversion.ts` | `ruleQueries.ts`, `conversion.ts` | unit/city/village UI consume shared costs/reasons |
| Construction and recruitment | `actions/construction.ts` | `ruleQueries.ts`, `constructionValidation.ts`, `buildingRequirements.ts` | city/build menus and AI consume shared options |
| Research | `actions/research.ts` | `ruleQueries.ts`, `technologyHelpers.ts` | tech UI and AI format shared legality |
| Fog/rendering visibility | rendering only | `visibilityQueries.ts`, `unitLogic.ts` | renderers consume `visibilityQueries.ts` |
| Faith project | `faithProject.ts`, `actions/turns.ts` | `ruleQueries.ts`, `faithProject.ts` | faith-project UI formats shared reasons |
| Diplomacy and trade | `actions/diplomacy.ts`, `tradeRoutes.ts` | add to `ruleQueries.ts` before expanding UI/AI behavior | diplomacy UI/AI consume shared checks |

## Legacy Boundaries

- `shared/logic/unitActions.ts` is a deprecated stub module. Do not add new behavior there.
- `shared/logic/combatSystem.ts` is compatibility-only. `calculateCombatDamage()` delegates to `resolveCombat`; other old helpers throw and should not gain new rules.
- `shared/logic/abilitySystem.ts` still contains direct tech ability logic and is the biggest remaining drift risk. New ability behavior should go through `shared/logic/actions/abilities.ts` or shared helpers first.
- `shared/logic/unitActionHandlers.ts` still owns several unit tactical handlers. It is acceptable current code, but new broad action domains should prefer `shared/logic/actions/*`.

## Direct Import Allowlist

The current target is zero direct gameplay-legality imports from `client/src` and `shared/ai`. `test/unit/CanonicalRulesDrift.unit.test.ts` scans those surfaces and fails if they import `constructionValidation`, `worldElementActions`, `factionAbilityAvailability`, `actionAvailability`, `unitLogic`, `combatResolver`, `technologyHelpers`, `conversion`, `abilitySystem`, `unitActions`, or `combatSystem` directly.

Allowed exceptions must be rendering-only and routed through a wrapper with a name that makes that boundary clear, such as `shared/logic/visibilityQueries.ts`. Do not add a new allowlist entry unless the import is explicitly not deciding action legality.

## Active Balance Toggles

No temporary faith-victory disablement is active. The old banked-Faith threshold branch has been replaced by the Consecration project rules in `GAME_RULES.victory.faithVictory`, with canonical handling in `shared/logic/faithProject.ts` and `shared/logic/actions/turns.ts`.

## Open Hardening Work

- Retire or wrap remaining `abilitySystem.ts` behavior so `USE_ABILITY` cannot drift from resolver behavior.
- Keep `client/src/lib/helpers/actionAvailabilityHelpers.ts` as a thin UI adapter over `shared/logic/ruleQueries.ts`.
- Keep `client/src/selectors/*` as presentation selectors. If a selector answers whether a gameplay action is legal, it must call `shared/logic/ruleQueries.ts`.
- AI may score and rank actions in `shared/ai/*`, but candidate legality must come from `shared/logic/ruleQueries.ts` and execution must pass through `explainAction()` before `resolveActionState()`.
- Move any specialized UI gating that affects legal gameplay into shared logic before exposing it in a component.
- Add or update resolver-level tests whenever an action changes availability, cost, targeting, cooldown, status effects, or map visibility.
- Add or update `shared/logic/ruleQueries.test.ts` and `test/unit/CanonicalRulesDrift.unit.test.ts` whenever a new action family gains UI or AI legality checks.
- When an ability is data-only or awaiting design, show it as passive/unavailable in UI and update `docs/PLAYER_REFERENCE.md` plus `docs/UNIT_SYSTEM_DESIGN.md`.
