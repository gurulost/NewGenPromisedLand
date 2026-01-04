import { MapGenerator, MAP_SIZE_CONFIGS, type MapSize } from "@shared/utils/mapGenerator";
import type { GameMap } from "@shared/types/game";
import type { HexCoordinate } from "@shared/types/coordinates";

type MapGenerationRequest = {
  requestId: number;
  mapSize: MapSize;
  seed: number;
  playerCount: number;
  playerFactions: string[];
};

type MapGenerationResponse =
  | {
      requestId: number;
      status: "success";
      map: GameMap;
      capitalPositions: HexCoordinate[];
    }
  | {
      requestId: number;
      status: "error";
      message: string;
    };

const ctx = self as any;

ctx.onmessage = (event: MessageEvent<MapGenerationRequest>) => {
  const { requestId, mapSize, seed, playerCount, playerFactions } = event.data;

  try {
    const resolvedMapSize = MAP_SIZE_CONFIGS[mapSize] ? mapSize : "normal";
    const mapConfig = MAP_SIZE_CONFIGS[resolvedMapSize];

    const mapGenerator = new MapGenerator(
      {
        width: mapConfig.dimensions,
        height: mapConfig.dimensions,
        seed,
        playerCount,
        mapSize: resolvedMapSize,
        minResourceDistance: 2,
        maxResourcesPerPlayer: 3,
      },
      playerFactions
    );

    const map = mapGenerator.generateMap();
    const capitalPositions = mapGenerator.getCapitalPositions();

    const payload: MapGenerationResponse = {
      requestId,
      status: "success",
      map,
      capitalPositions,
    };
    ctx.postMessage(payload);
  } catch (error) {
    const payload: MapGenerationResponse = {
      requestId,
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
    ctx.postMessage(payload);
  }
};
