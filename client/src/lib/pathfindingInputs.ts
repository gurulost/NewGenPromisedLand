import type { GameState } from "@shared/types/game";
import type { Unit } from "@shared/types/unit";
import { getRuleMovementCostForCoordinate, isRulePassableForUnit } from "@shared/logic/ruleQueries";

export function buildPathfindingInputs(gameState: GameState, unit: Unit) {
  const passableTileList = gameState.map.tiles.filter((tile) =>
    isRulePassableForUnit(tile.coordinate, gameState, unit)
  );
  const passableTiles = passableTileList.map(
    (tile) => `${tile.coordinate.q},${tile.coordinate.r}`
  );
  const tileCosts = passableTileList.reduce<Record<string, number>>((acc, tile) => {
    const key = `${tile.coordinate.q},${tile.coordinate.r}`;
    acc[key] = getRuleMovementCostForCoordinate(tile.coordinate, gameState, unit);
    return acc;
  }, {});

  return { passableTiles, tileCosts };
}
