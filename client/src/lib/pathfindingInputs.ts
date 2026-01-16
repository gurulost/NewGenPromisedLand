import type { GameState } from "@shared/types/game";
import type { Unit } from "@shared/types/unit";
import { getMovementCostForCoordinate, isPassableForUnit } from "@shared/logic/unitLogic";

export function buildPathfindingInputs(gameState: GameState, unit: Unit) {
  const passableTileList = gameState.map.tiles.filter((tile) =>
    isPassableForUnit(tile.coordinate, gameState, unit)
  );
  const passableTiles = passableTileList.map(
    (tile) => `${tile.coordinate.q},${tile.coordinate.r}`
  );
  const tileCosts = passableTileList.reduce<Record<string, number>>((acc, tile) => {
    const key = `${tile.coordinate.q},${tile.coordinate.r}`;
    acc[key] = getMovementCostForCoordinate(tile.coordinate, gameState, unit);
    return acc;
  }, {});

  return { passableTiles, tileCosts };
}
