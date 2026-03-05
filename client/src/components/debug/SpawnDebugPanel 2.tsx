import { useMemo } from "react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { CAPITAL_MIN_DISTANCE_BY_SIZE, MAP_GENERATION_CONSTANTS, MAP_SIZE_CONFIGS, MapSize } from "@shared/utils/mapGenerator";
import { hexDistance, hexNeighbors } from "@shared/utils/hex";
import type { HexCoordinate } from "@shared/types/coordinates";
import { getFaction } from "@shared/data/factions";
import type { Tile } from "@shared/types/game";

interface CapitalDebugInfo {
  playerId: string;
  playerName: string;
  factionId: string;
  factionName: string;
  color: string;
  coordinate: HexCoordinate;
  terrain: string;
  landNeighbors: number;
  nearestOtherDistance: number | null;
  nearestVillageDistance: number | null;
}

type CapitalDebugBase = Omit<CapitalDebugInfo, "nearestOtherDistance">;

export function SpawnDebugPanel() {
  const isDev = import.meta.env.DEV;
  const { gameState } = useLocalGame();
  const { showSpawnDebug, setShowSpawnDebug } = useGameState();

  const debugData = useMemo(() => {
    if (!gameState) return null;

    const tileIndex = new Map<string, Tile>();
    gameState.map.tiles.forEach((tile) => {
      tileIndex.set(`${tile.coordinate.q},${tile.coordinate.r}`, tile);
    });

    const mapSizeEntry = Object.entries(MAP_SIZE_CONFIGS).find(([, config]) => config.dimensions === gameState.map.width);
    const mapSize = mapSizeEntry?.[0] as MapSize | undefined;
    const targetMinDistance = mapSize ? CAPITAL_MIN_DISTANCE_BY_SIZE[mapSize] : null;

    const villages = gameState.map.tiles.filter((tile) => tile.feature === "village");

    const rawCapitals = gameState.players.map((player) => {
      const capitalCity = gameState.cities.find((city) => city.id === `city-${player.id}`)
        ?? gameState.cities.find((city) => city.ownerId === player.id);

      if (!capitalCity) return null;

      const coord = capitalCity.coordinate;
      const tile = tileIndex.get(`${coord.q},${coord.r}`);
      const landNeighbors = hexNeighbors(coord)
        .map((neighbor) => tileIndex.get(`${neighbor.q},${neighbor.r}`))
        .filter((neighborTile) => neighborTile && neighborTile.terrain !== "water").length;

      let nearestVillageDistance: number | null = null;
      for (const village of villages) {
        const dist = hexDistance(coord, village.coordinate);
        if (nearestVillageDistance === null || dist < nearestVillageDistance) {
          nearestVillageDistance = dist;
        }
      }

      const faction = getFaction(player.factionId as any);

      return {
        playerId: player.id,
        playerName: player.name,
        factionId: player.factionId,
        factionName: faction?.name ?? player.factionId,
        color: faction?.color ?? "#38bdf8",
        coordinate: coord,
        terrain: tile?.terrain ?? "unknown",
        landNeighbors,
        nearestVillageDistance,
      };
    }).filter((capital): capital is CapitalDebugBase => capital !== null);

    const capitals: CapitalDebugInfo[] = rawCapitals.map((capital, index) => {
      const otherDistances = rawCapitals
        .filter((_, otherIndex) => otherIndex !== index)
        .map((other) => hexDistance(capital.coordinate, other.coordinate));
      const nearestOtherDistance = otherDistances.length ? Math.min(...otherDistances) : null;
      return {
        ...capital,
        nearestOtherDistance,
      };
    });

    let minPairDistance: number | null = null;
    for (let i = 0; i < rawCapitals.length; i++) {
      for (let j = i + 1; j < rawCapitals.length; j++) {
        const dist = hexDistance(rawCapitals[i].coordinate, rawCapitals[j].coordinate);
        minPairDistance = minPairDistance === null ? dist : Math.min(minPairDistance, dist);
      }
    }

    const villageMinDistance = MAP_GENERATION_CONSTANTS.VILLAGE_MIN_DISTANCE_FROM_CITY;
    const villageMaxDistance = villageMinDistance + 2;

    return {
      mapSize,
      targetMinDistance,
      capitals,
      minPairDistance,
      villageCount: villages.length,
      villageMinDistance,
      villageMaxDistance,
    };
  }, [gameState]);

  if (!isDev || !showSpawnDebug || !gameState || !debugData) return null;

  const statusClass = (ok: boolean) => ok ? "text-emerald-200" : "text-rose-200";

  return (
    <div className="fixed bottom-3 right-3 z-[var(--z-toast)] w-[320px] rounded-lg border border-white/10 bg-black/70 p-3 text-[11px] text-white/80 shadow-xl backdrop-blur pointer-events-auto">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-white/90">Spawn Debug</div>
        <button
          onClick={() => setShowSpawnDebug(false)}
          className="rounded px-2 py-0.5 text-[10px] text-white/60 transition hover:text-white"
        >
          Close
        </button>
      </div>
      <div className="mt-1 text-[10px] text-white/60">
        Map: {debugData.mapSize ?? "custom"} ({gameState.map.width}x{gameState.map.height})
      </div>
      <div className="text-[10px] text-white/60">
        Target min capital distance: {debugData.targetMinDistance ?? "n/a"} | Min pair: {debugData.minPairDistance ?? "n/a"}
      </div>
      <div className="text-[10px] text-white/60">
        Villages: {debugData.villageCount} | Target distance: {debugData.villageMinDistance}-{debugData.villageMaxDistance}
      </div>

      <div className="mt-2 space-y-2">
        {debugData.capitals.map((capital) => {
          const distanceOk = debugData.targetMinDistance === null
            || capital.nearestOtherDistance === null
            || capital.nearestOtherDistance >= debugData.targetMinDistance;
          const villageOk = capital.nearestVillageDistance === null
            || (capital.nearestVillageDistance >= debugData.villageMinDistance
              && capital.nearestVillageDistance <= debugData.villageMaxDistance);
          const landOk = capital.landNeighbors >= 3;
          const terrainOk = capital.terrain !== "water";

          return (
            <div key={capital.playerId} className="rounded-md border border-white/10 bg-white/5 px-2 py-1">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: capital.color }} />
                <span className="font-semibold text-white/90">{capital.playerName}</span>
                <span className="text-white/60">{capital.factionName}</span>
              </div>
              <div className="text-[10px] text-white/70">
                Capital: q{capital.coordinate.q}, r{capital.coordinate.r}
              </div>
              <div className={`text-[10px] ${statusClass(distanceOk)}`}>
                Nearest capital: {capital.nearestOtherDistance ?? "n/a"}
              </div>
              <div className={`text-[10px] ${statusClass(villageOk)}`}>
                Nearest village: {capital.nearestVillageDistance ?? "none"}
              </div>
              <div className={`text-[10px] ${statusClass(landOk)}`}>
                Land neighbors: {capital.landNeighbors}
              </div>
              <div className={`text-[10px] ${statusClass(terrainOk)}`}>
                Terrain: {capital.terrain}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
