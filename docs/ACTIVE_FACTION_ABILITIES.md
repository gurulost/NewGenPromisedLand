# Active Faction Abilities

Active faction abilities are treated as tactical tools with a canonical shared contract. Do not add an ability to a faction as `active` unless the game can answer, in shared logic, whether it can be used, what it targets, what it changes, what it costs, when cooldown starts, how AI evaluates it, and what the player sees when blocked.

## Canonical Contract

Every active faction ability must have:

- a canonical definition in `shared/data/abilities.ts`
- a spec in `shared/data/factionAbilitySpecs.ts`
- shared availability coverage through `getFactionAbilityAvailability`
- a resolver-backed effect through `USE_ABILITY`
- UI ready and blocked text from the spec
- an AI use rule, unless the spec is explicitly `design_pending` or `disabled`
- deterministic tests for ideal, blocked, and marginal use

If an ability is not ready for all of those, mark it `design_pending` or `disabled`; do not expose a no-op active button.

## Current Implemented Actives

- `TITLE_OF_LIBERTY`: Nephite area morale/combat buff from a friendly unit source.
- `WARRIOR_RAGE`: Lamanite offensive burst with a defense tradeoff.
- `lamanite_guerrilla_tactics`: Lamanite forest-positioning defensive tool.
- `CULTURAL_RECLAMATION`: Mulekite cultural pressure that weakens defense and improves later conversion setup.
- `COVENANT_OF_PEACE`: Anti-Nephi-Lehi low-volume instant conversion when faith advantage and range are satisfied.
- `MISSIONARY_ZEAL`: Anti-Nephi-Lehi testimony pressure projected through missionaries.
- `RAMEUMPTOM`: Zoramite economy burst with dissent risk.
- `ANCIENT_MIGHT`: Jaredite combat burst with Pride momentum risk.

## Balance Notes

`COVENANT_OF_PEACE` is the sharpest instant swing because it can flip a unit outright. Keep its range, faith advantage, and cooldown under playtest watch.

`CULTURAL_RECLAMATION` and `MISSIONARY_ZEAL` are deliberately pressure/status tools, not guaranteed immediate conversions. Cultural Reclamation's pressure improves conversion odds at equal faith, but its faith cost can make immediate follow-up conversion less attractive until the player rebuilds faith. That is acceptable for now because the ability is intended to set up a later conversion window rather than replace the conversion action.

`RAMEUMPTOM` and `ANCIENT_MIGHT` are intentionally tempting risk plays: both create visible upside while pushing the player toward existing dissent or Pride instability.

`lamanite_guerrilla_tactics` remains active for now. It is technically safe, available to AI, and tested as an idempotent forest tool whose bonus is removed after leaving forest. It still feels philosophically close to a passive terrain rule, so revisit after playtesting whether the manual activation creates enough tactical satisfaction to justify staying active.

## Required Validation

For active ability changes, run:

```bash
npx vitest run test/unit/AbilityDataIntegrity.unit.test.ts test/unit/FactionAbilityHeuristics.unit.test.ts test/unit/FactionAbilityBalanceScenarios.unit.test.ts test/unit/FactionAbilities.unit.test.ts test/unit/AbilityOwnership.unit.test.ts test/unit/FactionAbilityButtons.unit.test.tsx test/unit/CombatAbilities.unit.test.ts shared/logic/activeEffects.test.ts
npm run check
```

Run `npm run test:all` before release candidates or any tuning that changes costs, cooldowns, target rules, or resolver effects.
