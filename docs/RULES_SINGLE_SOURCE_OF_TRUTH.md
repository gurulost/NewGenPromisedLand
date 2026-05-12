# Single Source of Truth Status (Rules/Logic)

Last reviewed: 2026-04-30

## Purpose

Keep gameplay rules from splitting across reducers, UI helpers, legacy modules, and tests. This file is active guidance, not an old audit log.

## Current Policy

- `shared/logic/resolveAction.ts` is the canonical action entry point.
- `shared/logic/gameReducer.ts` is a compatibility wrapper that delegates to `resolveActionState()`.
- Domain action behavior belongs in `shared/logic/actions/*` or shared logic helpers, not React components or Zustand stores.
- Combat behavior belongs in `shared/logic/combatResolver.ts`, `shared/logic/computeEffectiveStats.ts`, `shared/logic/effects.ts`, and `shared/logic/statusEffects.ts`.
- Movement, range, passability, and action-count helpers belong in `shared/logic/unitLogic.ts` and pathfinding helpers.
- UI action availability should flow through shared predicates such as `shared/logic/actionAvailability.ts`, `shared/logic/unitLogic.ts`, and `shared/logic/worldElementActions.ts`.
- Unit and ability definitions in `shared/data/*` describe available content; they are not implementation by themselves.

## Ownership Matrix

- `MOVE_UNIT`, `ATTACK_UNIT`: `shared/logic/actions/movementCombat.ts`, with combat resolved through `combatResolver.ts`.
- `END_TURN`: `shared/logic/actions/turns.ts`.
- Unit tactical actions such as `HEAL_UNIT`, `APPLY_STEALTH`, `RECONNAISSANCE`, `FORMATION_FIGHTING`, `SIEGE_MODE`, `RALLY_TROOPS`, `CLEAR_FOREST`, `BUILD_ROAD`, and `COASTAL_EXPLORE`: routed by `resolveAction.ts` into shared handlers.
- `USE_ABILITY` and `ACTIVATE_FACTION_ABILITY`: `shared/logic/actions/abilities.ts`, plus shared helpers such as `activeEffects.ts`, `culturalPressure.ts`, and `testimonyPressure.ts`.
- `WORLD_ELEMENT_HARVEST` and `WORLD_ELEMENT_BUILD`: `shared/logic/actions/worldElements.ts` and `shared/logic/worldElementActions.ts`.
- `CONVERT_UNIT`, `CONVERT_CITY`, `CONVERT_VILLAGE`: `shared/logic/actions/conversion.ts` and `shared/logic/conversion.ts`.
- Construction, recruitment, research, diplomacy, trade, and turn flow: the matching files under `shared/logic/actions/*` plus shared validation helpers.

## Legacy Boundaries

- `shared/logic/unitActions.ts` is a deprecated stub module. Do not add new behavior there.
- `shared/logic/combatSystem.ts` is compatibility-only. `calculateCombatDamage()` delegates to `resolveCombat`; other old helpers throw and should not gain new rules.
- `shared/logic/abilitySystem.ts` still contains direct tech ability logic and is the biggest remaining drift risk. New ability behavior should go through `shared/logic/actions/abilities.ts` or shared helpers first.
- `shared/logic/unitActionHandlers.ts` still owns several unit tactical handlers. It is acceptable current code, but new broad action domains should prefer `shared/logic/actions/*`.

## Active Balance Toggles (TEMPORARY)

Intentional non-default rule overrides live as flags on `GAME_RULES` in `shared/data/gameRules.ts`. Each entry below must list how to re-enable and which downstream surfaces are already gated. Remove the entry when the toggle is reverted.

- **Faith victory: DISABLED** (`GAME_RULES.victory.faithEnabled = false`).
  - Reason: faith=90 reachable trivially through diplomacy; produced instant or near-instant wins.
  - Re-enable: set `faithEnabled: true` in `shared/data/gameRules.ts`. No other code change required.
  - Already gated on the flag: faith branch in `checkVictoryConditions` (`shared/logic/actions/turns.ts`), AI progress/pivot logic in `calculateVictoryProgress` (`shared/ai/aiEngine.ts`), Faith tile + tooltip in `client/src/components/hud/PlayerHUD.tsx`.
  - Tests: `shared/logic/gameReducer.test.ts` covers both enabled and disabled paths.
  - Update on re-enable: `docs/PLAYER_REFERENCE.md` section 16, and remove this entry plus the matching one in `replit.md`.

## Open Hardening Work

- Retire or wrap remaining `abilitySystem.ts` behavior so `USE_ABILITY` cannot drift from resolver behavior.
- Keep `client/src/lib/helpers/actionAvailabilityHelpers.ts` as a thin UI adapter over shared predicates.
- Move any specialized UI gating that affects legal gameplay into shared logic before exposing it in a component.
- Add or update resolver-level tests whenever an action changes availability, cost, targeting, cooldown, status effects, or map visibility.
- When an ability is data-only or awaiting design, show it as passive/unavailable in UI and update `docs/PLAYER_REFERENCE.md` plus `docs/UNIT_SYSTEM_DESIGN.md`.
