import { GameState } from "../../types/game";
import { UnitType } from "../../types/unit";
import { HexCoordinate } from "../../types/coordinates";
import { GAME_RULES } from "../../data/gameRules";
import { getUnitDefinition } from "../../data/units";
import { hexDistance, hexNeighbors } from "../../utils/hex";
import { isTileExploredByPlayer } from "../constructionRules";

const isNavalSpawnUnitType = (unitType: UnitType) => {
  const def = getUnitDefinition(unitType);
  return unitType === "boat" || (def.abilities || []).some(a => String(a).toUpperCase() === "NAVAL_TRANSPORT");
};

export function getUnitSpawnCoordinate(
  state: GameState,
  unitType: UnitType,
  cityCoordinate: HexCoordinate,
  playerId: string,
  preferredCoordinate?: HexCoordinate
): HexCoordinate | null {
  const SPAWN_RADIUS = 2;
  const MAX_UNITS_PER_TILE = GAME_RULES.units.maxUnitsPerCity;
  const queuedKeys = new Set(
    state.players.flatMap(player =>
      (player.constructionQueue || [])
        .filter(item => item.category === "units" && item.coordinate)
        .map(item => `${item.coordinate!.q},${item.coordinate!.r}`)
    )
  );

  const getUnitsOnTile = (coord: HexCoordinate) =>
    state.units.filter(u =>
      u.coordinate.q === coord.q && u.coordinate.r === coord.r
    );

  const isValidSpawnTile = (coord: HexCoordinate) => {
    const unitsOnTile = getUnitsOnTile(coord);
    const hasEnemy = unitsOnTile.some(u => u.playerId !== playerId);
    if (hasEnemy) return false;
    if (unitsOnTile.length >= MAX_UNITS_PER_TILE) return false;
    if (queuedKeys.has(`${coord.q},${coord.r}`)) return false;
    return true;
  };

  if (isNavalSpawnUnitType(unitType)) {
    const adjacentTiles = hexNeighbors(cityCoordinate);
    const validBoatTiles = adjacentTiles
      .map(neighbor => state.map.tiles.find(t =>
        t.coordinate.q === neighbor.q && t.coordinate.r === neighbor.r
      ))
      .filter((tile): tile is NonNullable<typeof tile> =>
        !!tile && tile.terrain === "water" && isValidSpawnTile(tile.coordinate)
      );

    if (validBoatTiles.length === 0) return null;

    if (preferredCoordinate) {
      const preferred = validBoatTiles.find(tile =>
        tile.coordinate.q === preferredCoordinate.q &&
        tile.coordinate.r === preferredCoordinate.r
      );
      if (preferred) return preferred.coordinate;
    }

    return validBoatTiles[0].coordinate;
  }

  const tilesInRange = state.map.tiles.filter(tile =>
    hexDistance(cityCoordinate, tile.coordinate) <= SPAWN_RADIUS
  );

  const validSpawnTiles = tilesInRange.filter(tile => {
    if (tile.terrain === "water") return false;
    return isValidSpawnTile(tile.coordinate);
  });

  if (validSpawnTiles.length === 0) return null;

  if (preferredCoordinate) {
    const preferred = validSpawnTiles.find(tile =>
      tile.coordinate.q === preferredCoordinate.q &&
      tile.coordinate.r === preferredCoordinate.r
    );
    if (preferred) return preferred.coordinate;
  }

  validSpawnTiles.sort((a, b) => {
    const unitsOnA = getUnitsOnTile(a.coordinate).length;
    const unitsOnB = getUnitsOnTile(b.coordinate).length;

    if (unitsOnA !== unitsOnB) return unitsOnA - unitsOnB;

    return hexDistance(cityCoordinate, a.coordinate) - hexDistance(cityCoordinate, b.coordinate);
  });

  return validSpawnTiles[0].coordinate;
}

export function getValidSpawnTiles(
  state: GameState,
  cityCoordinate: HexCoordinate,
  unitType: UnitType,
  playerId: string
): HexCoordinate[] {
  const SPAWN_RADIUS = 2;
  const MAX_UNITS_PER_TILE = GAME_RULES.units.maxUnitsPerCity;
  const queuedKeys = new Set(
    state.players.flatMap(player =>
      (player.constructionQueue || [])
        .filter(item => item.category === "units" && item.coordinate)
        .map(item => `${item.coordinate!.q},${item.coordinate!.r}`)
    )
  );

  const getUnitsOnTile = (coord: HexCoordinate) =>
    state.units.filter(u =>
      u.coordinate.q === coord.q && u.coordinate.r === coord.r
    );

  const isValidSpawnTile = (coord: HexCoordinate) => {
    const unitsOnTile = getUnitsOnTile(coord);
    const hasEnemy = unitsOnTile.some(u => u.playerId !== playerId);
    return !hasEnemy && unitsOnTile.length < MAX_UNITS_PER_TILE;
  };

  if (isNavalSpawnUnitType(unitType)) {
    const adjacentTiles = hexNeighbors(cityCoordinate);
    return adjacentTiles
      .map(neighbor => state.map.tiles.find(t =>
        t.coordinate.q === neighbor.q && t.coordinate.r === neighbor.r
      ))
      .filter((tile): tile is NonNullable<typeof tile> =>
        !!tile &&
        tile.terrain === "water" &&
        isTileExploredByPlayer(state, playerId, tile.coordinate) &&
        isValidSpawnTile(tile.coordinate) &&
        !queuedKeys.has(`${tile.coordinate.q},${tile.coordinate.r}`)
      )
      .map(tile => tile.coordinate);
  }

  const tilesInRange = state.map.tiles.filter(tile =>
    hexDistance(cityCoordinate, tile.coordinate) <= SPAWN_RADIUS
  );

  return tilesInRange
    .filter(tile =>
      tile.terrain !== "water" &&
      isTileExploredByPlayer(state, playerId, tile.coordinate) &&
      isValidSpawnTile(tile.coordinate) &&
      !queuedKeys.has(`${tile.coordinate.q},${tile.coordinate.r}`)
    )
    .map(tile => tile.coordinate);
}
