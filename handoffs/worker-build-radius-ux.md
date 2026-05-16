# Worker "Build Improvement" ability doesn't surface water-improvement targets

## TL;DR
Workers can now legitimately build improvements on any tile within 2 hexes (`BUILDER_WORK_RADIUS = 2`) — including water tiles for the `port` improvement — but the **worker's own "Build Improvement" ability button** still only looks at the tile the worker is currently standing on. So in practice, building a port still requires going through the city panel's "construct → click tile" flow, which is the *other* construction entry point and which currently bypasses worker gating entirely. Net result: an inconsistent UX where the radius fix isn't actually reachable from the worker-driven path it was designed for.

## Background

There are **two separate construction entry points** in the client today:

### Path A — Worker ability ("Build Improvement" button on the unit's abilities panel)
- File: `client/src/components/ui/AbilitiesPanel.tsx`
- The button is generated in `getUnitActions()` (around line 176, `case 'worker'`).
- It calls `getBestImprovementForCurrentTile()` (line 97) which **only looks at `currentTile`** — i.e. the hex the worker is standing on. It filters `IMPROVEMENT_DEFINITIONS` by `def.validTerrain.includes(currentTile.terrain)`.
- On click (line 582, `case 'build_improvement'`), it dispatches `START_CONSTRUCTION` with `coordinate: currentTile.coordinate` and `builderUnitId: unit.id`.
- Consequence: because a worker can't stand on water, `validTerrain: ['water']` improvements (currently just `port` — see `shared/types/city.ts` line 197) are *never* offered by this button, even when there's an adjacent water tile that would now be legal under the new 2-hex radius.

### Path B — City panel construction mode (click a building, then click a tile)
- File: `client/src/components/game/HexGridInstanced.tsx` (around line 494)
- The dispatch builds the `START_CONSTRUCTION` payload **without `builderUnitId`** (see line 494–506).
- Looking at `shared/logic/constructionValidation.ts` line 120: the `builderUnitId` block — worker existence check, ownership, type === 'worker', remaining-actions check, and the new `BUILDER_WORK_RADIUS` distance check — is entirely gated on `if (builderUnitId)`. So Path B bypasses all worker gating: any tile inside the city work radius is buildable with no worker required at all.
- This is the pre-existing inconsistency called out in `replit.md` under "Builder Range". Today it's the *only* way for a player to actually build a port.

## The recent change that exposes this

`shared/logic/constructionValidation.ts` recently introduced `BUILDER_WORK_RADIUS = 2`. When `builderUnitId` is present, the worker is no longer required to be on the exact build tile — it just needs to be within 2 hexes of it (line 125) and the tile still must be inside the city work radius (`isConstructionCoordinateLinkedToCity`, line 107). Test coverage lives in `test/unit/ConstructionCanonicalization.unit.test.ts`.

The validation layer is correct. The worker-driven *UI* never asks about any tile other than the worker's own, so the radius improvement is dead code from the player-facing worker flow.

## What the fix needs to do

Goal: from the worker's ability panel, a player should be able to build any improvement that is legal under `validateConstructionRequest` for that worker — including water-only improvements like `port` on a nearby water tile.

There are two reasonable shapes for this; the implementer should pick one with the broader team:

### Option 1 — "Build Improvement" enters a targeting mode (preferred, matches existing UX)
The "Build" button on the worker becomes a two-step action like the existing **Road Build** flow (see `isRoadBuildMode` / `roadBuildUnitId` in `HexGridInstanced.tsx` line 516, and `startRoadBuild(unit.id)` dispatch in `AbilitiesPanel.tsx` line 572):
1. Player clicks "Build Improvement" → client enters a "build target selection" mode keyed to that worker's id.
2. Client highlights every tile within `BUILDER_WORK_RADIUS` of the worker that would pass `validateConstructionRequest` for *some* improvement (intersected with city work radius and tech/cost/terrain filters).
3. Player clicks a highlighted tile → if multiple improvements are valid for that terrain (e.g. farm vs orchard on grass) show a small picker; otherwise build the unambiguous best one (same `getBest…` heuristic, just applied to the *target* tile, not the worker's tile).
4. Dispatch `START_CONSTRUCTION` with both `builderUnitId: unit.id` and `coordinate: targetTile.coordinate`.

Pros: consistent with existing road-build UX, gives the player explicit control, surfaces the radius improvement directly, naturally supports port. Reuses the `validateConstructionRequest` logic as the source of truth — no duplication.

### Option 2 — Auto-pick the best nearby tile
Keep the one-click ergonomics of today's button: scan the worker's neighborhood within `BUILDER_WORK_RADIUS`, pick the highest-value (improvement × tile) combination, dispatch.

Pros: zero extra clicks. Cons: surprising — player has no control over which water tile gets the port, can build something they didn't intend, makes the ability description harder to write.

Option 1 is recommended unless there's a strong product reason against it.

## While you're in there: thread `builderUnitId` through Path B

This is the second half of the inconsistency. The city-panel construction flow in `HexGridInstanced.tsx` line 494–506 dispatches `START_CONSTRUCTION` **without** `builderUnitId`. It should either:
- Pass a `builderUnitId` if a worker is selected / nearby, so the action consumes a worker's turn like the worker-driven path does, **or**
- At minimum, only allow improvements (the `'improvements'` category specifically) to be built when there's a worker within `BUILDER_WORK_RADIUS` — even if you don't pass the id, validate the precondition client-side.

Right now Path B lets a player build improvements with no worker at all, which the data model wasn't designed for and the AI doesn't do (see `shared/ai/aiEngine.ts` line 1160 — AI always passes `builderUnitId`). Resolving this makes the system honest: improvements always cost a worker turn regardless of which UI path the player used.

This is technically a separate bug from the worker-button issue, but they're entangled — fixing #1 in isolation leaves Path B as a "cheat path" that skips the new worker requirement. Worth tackling them together.

## Files in scope

| File | Why |
|---|---|
| `client/src/components/ui/AbilitiesPanel.tsx` | Worker "Build Improvement" button generation (~line 176) and dispatch (~line 582). `getBestImprovementForCurrentTile` (~line 97) needs to become tile-parameterized, not current-tile-only. |
| `client/src/components/game/HexGridInstanced.tsx` | City-panel construction click handler (~line 494). Also where the road-build targeting mode lives — good reference for Option 1. |
| `client/src/lib/stores/useLocalGame.ts` (and wherever `constructionMode` / `isRoadBuildMode` are defined) | Will likely need a new `buildTargetMode` (or similar) flag, mirroring `roadBuildUnitId`. |
| `shared/logic/constructionValidation.ts` | Reference only — already correct, do not modify the validation logic. `BUILDER_WORK_RADIUS = 2` and `CITY_WORK_RADIUS = 2` are the operative constants. |
| `shared/types/city.ts` | Reference for `IMPROVEMENT_DEFINITIONS`, including the `port` def with `validTerrain: ['water']`. |
| `replit.md` | Update the "Builder Range" paragraph once the Path B inconsistency is resolved. |

## Test coverage to add / extend

- `test/unit/ConstructionCanonicalization.unit.test.ts` already exercises `validateConstructionRequest` with `builderUnitId` — add a case that confirms a worker on land successfully validates a `port` on an adjacent water tile (distance 1) and fails at distance 3.
- New client-side test: worker selected adjacent to water with `seafaring` tech researched and `port` requirements met → "Build Improvement" ability should be `available: true` and selecting it should surface the water tile as a valid target.
- Regression test for Path B: improvement construction from the city panel either requires a nearby worker or consumes one — pick whichever behavior you implement.

## Acceptance criteria

1. With a worker standing on a coast tile, the worker's "Build Improvement" button is enabled and offers `port` on an adjacent water tile (assuming tech + stars + city radius requirements are met).
2. Building succeeds, consumes the worker's turn action, and respects all existing rules (city work radius, exploration, blocking units/improvements/structures, duplicate construction queue).
3. The radius fix is reachable from the worker-driven path for *every* `validTerrain` (not just water — confirm with e.g. mine on a mountain 2 hexes away).
4. Path B (city-panel construction) no longer lets players build improvements without a worker (or document explicitly why it still can).
5. AI behavior unchanged — `aiEngine.ts` already passes `builderUnitId`; AI tests still pass.
6. The "Builder Range" note in `replit.md` is updated to reflect the resolved state.

## Out of scope

- The validation logic itself (`shared/logic/constructionValidation.ts`) — already correct.
- Server-side multiplayer authoritative resolution (separate larger initiative noted in `replit.md` under "Multiplayer Operations").
- Anything about structures or unit recruitment — this is improvements-only.
