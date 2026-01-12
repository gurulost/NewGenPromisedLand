import { hexDistance, coordToKey } from "../utils/hex";
import { GameState } from "../types/game";
import { HexCoordinate } from "../types/coordinates";

export const STRUCTURE_BUILD_RADIUS = 3;

export function isTileExploredByPlayer(
  state: GameState,
  playerId: string,
  coordinate: HexCoordinate
): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  const explored = player.exploredTiles ?? [];
  if (explored.includes(coordToKey(coordinate))) return true;

  const tile = state.map.tiles.find(t => t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r);
  if (!tile) return false;
  return tile.exploredBy?.includes(playerId) ?? false;
}

export function getFriendlyBuildAnchors(state: GameState, playerId: string): HexCoordinate[] {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return [];

  const explored = new Set(player.exploredTiles ?? []);
  const anchors = new Map<string, HexCoordinate>();

  const addAnchor = (coord?: HexCoordinate) => {
    if (!coord) return;
    const key = coordToKey(coord);
    if (explored.size > 0 && !explored.has(key)) return;
    if (!anchors.has(key)) {
      anchors.set(key, coord);
    }
  };

  state.cities
    ?.filter(city => city.ownerId === playerId)
    .forEach(city => addAnchor(city.coordinate));

  (state.improvements || [])
    .filter(imp => imp.ownerId === playerId)
    .forEach(imp => addAnchor(imp.coordinate));

  (state.structures || [])
    .filter(structure => structure.ownerId === playerId)
    .forEach(structure => {
      if (structure.coordinate) {
        addAnchor(structure.coordinate);
        return;
      }
      const city = state.cities?.find(c => c.id === structure.cityId);
      if (city) {
        addAnchor(city.coordinate);
      }
    });

  state.map.tiles
    .filter(tile => tile.feature === "village" && tile.cityOwner === playerId)
    .forEach(tile => addAnchor(tile.coordinate));

  return Array.from(anchors.values());
}

export function isWithinFriendlyBuildRadius(
  anchors: HexCoordinate[],
  coordinate: HexCoordinate,
  radius: number = STRUCTURE_BUILD_RADIUS
): boolean {
  return anchors.some(anchor => hexDistance(anchor, coordinate) <= radius);
}
