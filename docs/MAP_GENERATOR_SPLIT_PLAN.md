# Map Generator Split Plan

`shared/utils/mapGenerator.ts` is currently about 4,000 lines. The generator is gameplay-critical and reasonably well covered by invariant tests, so the right next step is a planned, behavior-preserving split rather than a casual refactor.

## Goals

- Preserve generated-map behavior unless a change is intentionally designed, reviewed, and covered by tests.
- Keep the current public import path stable for callers: `@shared/utils/mapGenerator`.
- Make future map work easier to assign by responsibility: capitals, water, villages, resources, ruins, diagnostics, and orchestration.
- Improve reviewability by moving one subsystem at a time behind characterization coverage.

## Non-Goals

- Do not rebalance terrain, water, resources, villages, ruins, or capital placement during extraction.
- Do not change map sizes, faction terrain bias, public worker payloads, or generation report semantics as part of the split.
- Do not rewrite the generator around a new architecture until the existing responsibilities are isolated.

## Public API To Preserve

The first split pass should keep these exports and behaviors stable:

- `MapGenerator`
- `SeededRandom`
- `MAP_GENERATION_CONSTANTS`
- `MAP_SIZE_CONFIGS`
- `CAPITAL_MIN_DISTANCE_BY_SIZE`
- `MapSize`
- `MapSizeConfig`
- `MapGenerator.generateMap()`
- `MapGenerator.getCapitalPositions()`, including defensive coordinate copies
- `MapGenerator.getGenerationReport()`
- The worker import shape in `client/src/workers/mapGeneratorWorker.ts`

## Proposed Module Boundaries

- `mapGenerator.ts`: public facade, orchestration, import compatibility, and high-level generation sequence.
- `mapGenerationConstants.ts`: existing size, spacing, count, and tuning constants.
- `mapGenerationTypes.ts`: internal config, report, diagnostics, candidate, and subsystem context types.
- `mapGenerationRandom.ts`: `SeededRandom`, derived stream names, deterministic shuffle/helpers.
- `mapGenerationDiagnostics.ts`: report builders, spread summaries, diagnostics defaults, and debug logging helpers.
- `mapCapitalPlacement.ts`: capital candidate selection, fallback placement, spacing, land access, and per-capital reports.
- `mapWaterGeneration.ts`: water motifs, water masks, body analysis, coastal/repair rules, and water resources.
- `mapSettlementPlacement.ts`: neutral cities, expansion villages, contested villages, ring counts, and village diagnostics.
- `mapTerrainGeneration.ts`: base terrain probabilities, noise classification, and faction terrain modifiers.
- `mapLandResources.ts`: land resource candidates, spacing/cap constraints, home-zone guarantees, and variety guarantees.
- `mapRuins.ts`: ruins targets, placement candidates, spacing, and special feature assignment.

## Extraction Order

1. Keep characterization tests green and document the split plan.
2. Extract shared internal types without moving logic.
3. Extract diagnostics/report building first, because it should not affect placement decisions.
4. Extract deterministic helpers and placement-context builders.
5. Extract water generation and water-resource helpers.
6. Extract capital placement and capital fallback helpers.
7. Extract neutral city and village placement helpers.
8. Extract land resource placement and home-zone guarantees.
9. Extract terrain modifiers, ruins, and remaining special-feature helpers.
10. Only after all behavior-preserving moves land, consider targeted gameplay tuning.

## Validation For Each Split PR

Run the focused map suite after every extraction:

```bash
npx vitest run test/MapGeneratorCharacterization.test.ts test/MapGenerationDeterminism.test.ts test/MapGenerationStats.test.ts test/MapGenerationWater.test.ts test/MapGenerationVillages.test.ts test/MapGenerationCapitals.test.ts test/MapGenerationNeutralCities.test.ts test/MapGenerationResourceControls.test.ts test/MapGenerationRuins.test.ts
```

Also run the repo hygiene gate:

```bash
npm run check
```

Run `npm run test:performance` when an extraction touches loops over all tiles, pathfinding-style reachability, candidate sorting, or repeated per-capital scans.

## Characterization Coverage

`test/MapGeneratorCharacterization.test.ts` intentionally uses compact golden digests instead of full tile snapshots. These digests cover representative generated summaries for:

- normal 4-player core faction maps
- normal 8-player full-faction maps
- small maps with water-faction pressure

When a digest changes, treat it as a review checkpoint. Update it only when the behavior change is intended and the reviewer understands which generated-map summary changed.

## Review Checklist

- Public imports still work from `@shared/utils/mapGenerator`.
- The worker still receives the same map, capital positions, and generation report shape.
- Seeded maps remain deterministic.
- Capital count, uniqueness, land access, and configured spacing remain covered.
- Water-faction starts still have meaningful coastal access.
- Village and neutral city spread tests still pass.
- Home resources and variety guarantees remain covered.
- Debug logging stays opt-in and production-safe.
- No extraction PR mixes behavior-preserving movement with balance tuning.
