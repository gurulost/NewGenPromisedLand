import { z } from "zod";
import { HexCoordinateSchema } from "./coordinates";
import { UnitSchema } from "./unit";
import { CitySchema } from "./city";
import { ImprovementSchema, StructureSchema } from "./city";

// Core game stats
export const GameStatsSchema = z.object({
  faith: z.number().min(0).max(100),
  pride: z.number().min(0).max(100),
  internalDissent: z.number().min(0).max(100),
});

export type GameStats = z.infer<typeof GameStatsSchema>;

// Hex coordinate system (imported from coordinates.ts)

// Terrain types
export const TerrainTypeSchema = z.enum([
  'plains',
  'forest',
  'mountain',
  'water',
  'desert',
  'swamp'
]);

export type TerrainType = z.infer<typeof TerrainTypeSchema>;

// Tile definition
export const TileSchema = z.object({
  coordinate: HexCoordinateSchema,
  terrain: TerrainTypeSchema,
  resources: z.array(z.string()).default([]),
  hasCity: z.boolean().default(false),
  cityOwner: z.string().optional(),
  exploredBy: z.array(z.string()).default([]),
});

export type Tile = z.infer<typeof TileSchema>;

// Game map
export const GameMapSchema = z.object({
  tiles: z.array(TileSchema),
  width: z.number(),
  height: z.number(),
});

export type GameMap = z.infer<typeof GameMapSchema>;

// Player state
export const PlayerStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  factionId: z.string(),
  stats: GameStatsSchema,
  visibilityMask: z.array(z.string()).default([]), // Currently visible tiles
  exploredTiles: z.array(z.string()).default([]), // Previously explored tiles
  isEliminated: z.boolean().default(false),
  turnOrder: z.number(),
  stars: z.number().default(10), // Currency for building/recruiting
  researchedTechs: z.array(z.string()).default([]),
  currentResearch: z.string().optional(), // Tech being researched
  researchProgress: z.number().default(0), // Progress toward current tech
  citiesOwned: z.array(z.string()).default([]), // City IDs owned by player
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;

// Game state
export const GameStateSchema = z.object({
  id: z.string(),
  players: z.array(PlayerStateSchema),
  currentPlayerIndex: z.number(),
  turn: z.number(),
  phase: z.enum(['setup', 'playing', 'ended']),
  map: GameMapSchema,
  units: z.array(UnitSchema),
  cities: z.array(CitySchema).default([]),
  improvements: z.array(ImprovementSchema).default([]),
  structures: z.array(StructureSchema).default([]),
  lastAction: z.union([
    z.object({ type: z.literal('MOVE_UNIT'), payload: z.object({ unitId: z.string(), targetCoordinate: HexCoordinateSchema }) }),
    z.object({ type: z.literal('ATTACK_UNIT'), payload: z.object({ attackerId: z.string(), targetId: z.string() }) }),
    z.object({ type: z.literal('END_TURN'), payload: z.object({ playerId: z.string() }) }),
    z.object({ type: z.string(), payload: z.unknown() }) // Fallback for other actions
  ]).optional(),
  winner: z.string().optional(),
});

export type GameState = z.infer<typeof GameStateSchema>;

// Game actions
export const GameActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('MOVE_UNIT'),
    payload: z.object({
      unitId: z.string(),
      targetCoordinate: HexCoordinateSchema,
    }),
  }),
  z.object({
    type: z.literal('ATTACK_UNIT'),
    payload: z.object({
      attackerId: z.string(),
      targetId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('USE_ABILITY'),
    payload: z.object({
      playerId: z.string(),
      abilityId: z.string(),
      target: z.union([
        HexCoordinateSchema,
        z.string(), // Unit ID or City ID
        z.object({ unitId: z.string() }),
        z.object({ cityId: z.string() }),
      ]).optional(),
    }),
  }),
  z.object({
    type: z.literal('END_TURN'),
    payload: z.object({
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('BUILD_UNIT'),
    payload: z.object({
      unitType: z.string(),
      coordinate: HexCoordinateSchema,
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('RESEARCH_TECH'),
    payload: z.object({
      playerId: z.string(),
      techId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('BUILD_IMPROVEMENT'),
    payload: z.object({
      playerId: z.string(),
      coordinate: HexCoordinateSchema,
      improvementType: z.string(),
      cityId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('BUILD_STRUCTURE'),
    payload: z.object({
      playerId: z.string(),
      cityId: z.string(),
      structureType: z.string(),
    }),
  }),
  z.object({
    type: z.literal('CAPTURE_CITY'),
    payload: z.object({
      playerId: z.string(),
      cityId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('RECRUIT_UNIT'),
    payload: z.object({
      playerId: z.string(),
      cityId: z.string(),
      unitType: z.string(),
    }),
  }),
  z.object({
    type: z.literal('ESTABLISH_TRADE_ROUTE'),
    payload: z.object({
      playerId: z.string(),
      fromCityId: z.string(),
      toCityId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('DECLARE_WAR'),
    payload: z.object({
      playerId: z.string(),
      targetPlayerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('FORM_ALLIANCE'),
    payload: z.object({
      playerId: z.string(),
      targetPlayerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('CONVERT_CITY'),
    payload: z.object({
      playerId: z.string(),
      cityId: z.string(),
      conversionType: z.enum(['faith', 'pride', 'peace']),
    }),
  }),
  z.object({
    type: z.literal('UPGRADE_UNIT'),
    payload: z.object({
      playerId: z.string(),
      unitId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('UNIT_ACTION'),
    payload: z.object({
      unitId: z.string(),
      actionType: z.string(),
      target: z.union([
        HexCoordinateSchema,
        z.string(),
        z.object({ unitId: z.string() }),
        z.object({ coordinate: HexCoordinateSchema }),
      ]).optional(),
    }),
  }),
]);

export type GameAction = z.infer<typeof GameActionSchema>;

// Victory conditions
export const VictoryTypeSchema = z.enum([
  'domination',
  'cultural',
  'faith',
  'economic',
  'elimination'
]);

export type VictoryType = z.infer<typeof VictoryTypeSchema>;
