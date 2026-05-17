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

export const ActiveEffectSourceSchema = z.object({
  playerId: z.string(),
  abilityId: z.string(),
  unitId: z.string().optional(),
  coordinate: HexCoordinateSchema.optional(),
});

export type ActiveEffectSource = z.infer<typeof ActiveEffectSourceSchema>;

export const ActiveEffectTargetSchema = z.object({
  kind: z.enum(['player', 'all_units', 'units_in_radius', 'specific_units']),
  playerId: z.string(),
  unitIds: z.array(z.string()).optional(),
  radius: z.number().int().positive().optional(),
});

export type ActiveEffectTarget = z.infer<typeof ActiveEffectTargetSchema>;

export const ActiveEffectStatModifierSchema = z.object({
  stat: z.enum(['attack', 'defense']),
  mode: z.enum(['flat', 'percent']).default('flat'),
  value: z.number(),
});

export type ActiveEffectStatModifier = z.infer<typeof ActiveEffectStatModifierSchema>;

export const ActiveEffectYieldModifierSchema = z.object({
  resource: z.enum(['stars', 'faith']),
  multiplier: z.number().default(0),
  flat: z.number().default(0),
});

export type ActiveEffectYieldModifier = z.infer<typeof ActiveEffectYieldModifierSchema>;

export const ActiveEffectFlagsSchema = z.object({
  immuneToNegativeStatus: z.boolean().optional(),
}).default({});

export type ActiveEffectFlags = z.infer<typeof ActiveEffectFlagsSchema>;

export const ActiveEffectSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: ActiveEffectSourceSchema,
  target: ActiveEffectTargetSchema,
  durationTurns: z.number().int().positive(),
  turnsRemaining: z.number().int().nonnegative(),
  tickOn: z.enum(['source_turn_end', 'target_turn_end']).default('source_turn_end'),
  stackRule: z.enum(['refresh', 'replace', 'stack']).default('refresh'),
  unitStatModifiers: z.array(ActiveEffectStatModifierSchema).default([]),
  yieldModifiers: z.array(ActiveEffectYieldModifierSchema).default([]),
  flags: ActiveEffectFlagsSchema,
  metadata: z.record(z.unknown()).optional(),
});

export type ActiveEffect = z.infer<typeof ActiveEffectSchema>;

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

// Map features for neutral locations
export const MapFeatureSchema = z.enum([
  'village',
  'ruin',
  'shrine'
]);

export type MapFeature = z.infer<typeof MapFeatureSchema>;

// Tile definition
export const TileSchema = z.object({
  coordinate: HexCoordinateSchema,
  terrain: TerrainTypeSchema,
  resources: z.array(z.string()).default([]),
  hasCity: z.boolean().default(false),
  cityOwner: z.string().optional(),
  exploredBy: z.array(z.string()).default([]),
  feature: MapFeatureSchema.optional(), // New feature property for villages, ruins, etc.
  captureType: z.enum(['conquered', 'converted']).optional(), // How village was captured
  starBonus: z.number().optional(), // Ongoing star bonus for converted villages
});

export type Tile = z.infer<typeof TileSchema>;

// Game map
export const GameMapSchema = z.object({
  tiles: z.array(TileSchema),
  width: z.number(),
  height: z.number(),
});

export type GameMap = z.infer<typeof GameMapSchema>;

// Construction item for building queue
export const ConstructionItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  category: z.enum(['improvements', 'structures', 'units']),
  coordinate: HexCoordinateSchema.optional(),
  cityId: z.string(),
  playerId: z.string(),
  turnsRemaining: z.number(),
  totalTurns: z.number(),
  cost: z.object({
    stars: z.number(),
    faith: z.number(),
    pride: z.number(),
  }),
});

export type ConstructionItem = z.infer<typeof ConstructionItemSchema>;

export const FaithProjectStateSchema = z.object({
  active: z.boolean(),
  progress: z.number().int().nonnegative(),
  holyCityIds: z.tuple([z.string(), z.string(), z.string()]),
  startedTurn: z.number().int().nonnegative(),
  pausedReason: z.string().nullable().optional(),
});

export type FaithProjectState = z.infer<typeof FaithProjectStateSchema>;

// Player state with faction, stats, and actions
export const PlayerStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  factionId: z.string(),
  isAI: z.boolean().optional(),
  aiDifficulty: z.string().optional(),
  stars: z.number().default(10), // Currency for building/recruiting (starting stars)
  stats: GameStatsSchema,
  modifiers: z.array(z.any()).default([]),
  researchedTechs: z.array(z.string()).default([]),
  currentResearch: z.string().optional(), // Tech being researched
  researchProgress: z.number().default(0), // Progress toward current tech
  researchInspiration: z.number().optional(),
  abilityCooldowns: z.record(z.number()).optional(),
  citiesOwned: z.array(z.string()).default([]), // City IDs owned by player
  constructionQueue: z.array(ConstructionItemSchema).default([]), // Buildings under construction
  visibilityMask: z.array(z.string()).default([]), // Currently visible tiles
  exploredTiles: z.array(z.string()).default([]), // Previously explored tiles
  isEliminated: z.boolean().default(false),
  turnOrder: z.number(),
  faithProject: FaithProjectStateSchema.nullable().optional(),
  // Diplomatic relations
  atWarWith: z.array(z.string()).default([]), // Player IDs currently at war with
  alliedWith: z.array(z.string()).default([]), // Player IDs allied with
  tradeRoutes: z.array(z.object({
    fromCityId: z.string(),
    toCityId: z.string(),
    starsPerTurn: z.number(),
  })).default([]),
  // Cooldowns for diplomacy actions (turns remaining)
  diplomaticCooldowns: z.object({
    declareWar: z.number().default(0), // Turns until can declare war again
    formAlliance: z.number().default(0), // Turns until can form alliance again
    breakAlliance: z.number().default(0), // Turns until can break alliance
    requestTrade: z.number().default(0), // Turns until can request trade
  }).default({ declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 }),
});

export type PlayerState = z.infer<typeof PlayerStateSchema>;

const LastActionEventSchema = z.object({
  type: z.string(),
  payload: z.unknown().optional(),
});

const LastActionSourceActionSchema = z.object({
  type: z.string(),
  payload: z.unknown().optional(),
});

// Game state
export const GameStateSchema = z.object({
  id: z.string(),
  // Seed for deterministic-but-random-feeling systems (morale events, etc.)
  rngSeed: z.number().int().optional(),
  players: z.array(PlayerStateSchema),
  currentPlayerIndex: z.number(),
  turn: z.number(),
  phase: z.enum(['setup', 'playing', 'ended']),
  map: GameMapSchema,
  visibility: z.record(z.any()).optional(),
  units: z.array(UnitSchema),
  cities: z.array(CitySchema).default([]),
  improvements: z.array(ImprovementSchema).default([]),
  structures: z.array(StructureSchema).default([]),
  activeEffects: z.array(ActiveEffectSchema).default([]),
  lastAction: z.union([
    z.object({ type: z.literal('MOVE_UNIT'), payload: z.object({ unitId: z.string(), targetCoordinate: HexCoordinateSchema }) }),
    z.object({ type: z.literal('ATTACK_UNIT'), payload: z.object({ attackerId: z.string(), targetId: z.string() }) }),
    z.object({ type: z.literal('END_TURN'), payload: z.object({ playerId: z.string() }) }),
    z.object({
      type: z.literal('END_TURN_RESOLUTION'),
      payload: z.object({
        endingPlayerId: z.string(),
        nextPlayerId: z.string(),
        events: z.array(z.object({ type: z.string(), payload: z.unknown() })),
      })
    }),
    z.object({
      type: z.literal('ACTION_RESOLUTION'),
      payload: z.object({
        action: LastActionSourceActionSchema,
        events: z.array(LastActionEventSchema),
      }),
    }),
    z.object({ type: z.literal('CONVERT_UNIT'), payload: z.object({ playerId: z.string(), unitId: z.string(), targetUnitId: z.string() }) }),
    z.object({
      type: z.literal('TESTIMONY_PRESSURE'),
      payload: z.object({
        sourcePlayerId: z.string(),
        attackPenalty: z.number(),
        durationTurns: z.number(),
        affected: z.array(z.object({ playerId: z.string(), unitIds: z.array(z.string()) })),
      })
    }),
    z.object({
      type: z.literal('INTIMIDATION_AURA'),
      payload: z.object({
        sourcePlayerId: z.string(),
        attackPenalty: z.number(),
        durationTurns: z.number(),
        affected: z.array(z.object({ playerId: z.string(), unitIds: z.array(z.string()) })),
      })
    }),
    z.object({
      type: z.literal('MORALE_EVENT'),
      payload: z.object({
        playerId: z.string(),
        kind: z.string(),
        starsDelta: z.number().optional(),
        cityId: z.string().optional(),
        unitId: z.string().optional(),
      })
    }),
    z.object({ type: z.literal('HARVEST_RESOURCE'), payload: z.object({ unitId: z.string(), resourceCoordinate: HexCoordinateSchema, cityId: z.string() }) }),
    z.object({ type: z.literal('HEAL_UNIT'), payload: z.object({ unitId: z.string(), playerId: z.string() }) }),
    z.object({ type: z.literal('APPLY_STEALTH'), payload: z.object({ unitId: z.string(), playerId: z.string() }) }),
    z.object({ type: z.literal('RECONNAISSANCE'), payload: z.object({ unitId: z.string(), playerId: z.string() }) }),
    z.object({ type: z.literal('FORMATION_FIGHTING'), payload: z.object({ unitId: z.string(), playerId: z.string() }) }),
    z.object({ type: z.literal('SIEGE_MODE'), payload: z.object({ unitId: z.string(), playerId: z.string() }) }),
    z.object({ type: z.literal('RALLY_TROOPS'), payload: z.object({ unitId: z.string(), playerId: z.string() }) }),
    z.object({ type: z.literal('RESEARCH_TECHNOLOGY'), payload: z.object({ playerId: z.string(), technologyId: z.string() }) }),
    z.object({ type: z.literal('START_FAITH_PROJECT'), payload: z.object({ playerId: z.string(), holyCityIds: z.tuple([z.string(), z.string(), z.string()]) }) }),
    z.object({ type: z.literal('CLEAR_FOREST'), payload: z.object({ unitId: z.string(), targetCoordinate: HexCoordinateSchema, playerId: z.string() }) }),
    z.object({ type: z.literal('BUILD_ROAD'), payload: z.object({ unitId: z.string(), targetCoordinate: HexCoordinateSchema, playerId: z.string() }) }),
    z.object({ type: z.string(), payload: z.unknown() }) // Fallback for other actions
  ]).optional(),
  winner: z.string().optional(),
  victoryType: z.enum(['faith', 'territorial', 'elimination', 'economic', 'cultural', 'domination']).optional(),
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
    type: z.literal('CONVERT_UNIT'),
    payload: z.object({
      playerId: z.string(),
      unitId: z.string(),
      targetUnitId: z.string(),
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
    type: z.literal('CLEAR_FOREST'),
    payload: z.object({
      unitId: z.string(),
      targetCoordinate: HexCoordinateSchema,
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('BUILD_ROAD'),
    payload: z.object({
      unitId: z.string(),
      targetCoordinate: HexCoordinateSchema,
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('WORLD_ELEMENT_HARVEST'),
    payload: z.object({
      playerId: z.string(),
      unitId: z.string(),
      elementId: z.string(),
      coordinate: HexCoordinateSchema,
    }),
  }),
  z.object({
    type: z.literal('WORLD_ELEMENT_BUILD'),
    payload: z.object({
      playerId: z.string(),
      unitId: z.string(),
      elementId: z.string(),
      coordinate: HexCoordinateSchema,
    }),
  }),
  z.object({
    type: z.literal('HEAL_UNIT'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('APPLY_STEALTH'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('RECONNAISSANCE'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('FORMATION_FIGHTING'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('SIEGE_MODE'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('RALLY_TROOPS'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('RESEARCH_TECHNOLOGY'),
    payload: z.object({
      playerId: z.string(),
      technologyId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('ACTIVATE_FACTION_ABILITY'),
    payload: z.object({
      playerId: z.string(),
      abilityId: z.string(),
      targetId: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('HARVEST_RESOURCE'),
    payload: z.object({
      unitId: z.string(),
      resourceCoordinate: HexCoordinateSchema,
      cityId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('START_CONSTRUCTION'),
    payload: z.object({
      playerId: z.string(),
      buildingType: z.string(),
      category: z.enum(['improvements', 'structures', 'units']),
      coordinate: HexCoordinateSchema.optional(),
      cityId: z.string(),
      builderUnitId: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('START_FAITH_PROJECT'),
    payload: z.object({
      playerId: z.string(),
      holyCityIds: z.tuple([z.string(), z.string(), z.string()]),
    }),
  }),
  z.object({
    type: z.literal('CAPTURE_CITY'),
    payload: z.object({
      playerId: z.string(),
      unitId: z.string(),
      cityId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('CONQUER_VILLAGE'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('CONVERT_VILLAGE'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('EXPLORE_RUINS'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
      coordinate: HexCoordinateSchema,
      randomSeed: z.number().optional(), // For deterministic rewards
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
    type: z.literal('BREAK_ALLIANCE'),
    payload: z.object({
      playerId: z.string(),
      targetPlayerId: z.string(),
    }),
  }),
  z.object({
    type: z.literal('CONVERT_CITY'),
    payload: z.object({
      playerId: z.string(),
      unitId: z.string().optional(),
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
    type: z.literal('RENAME_CITY'),
    payload: z.object({
      playerId: z.string(),
      cityId: z.string(),
      newName: z.string(),
    }),
  }),
  z.object({
    type: z.literal('COASTAL_EXPLORE'),
    payload: z.object({
      unitId: z.string(),
      playerId: z.string(),
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
  'elimination',
  'territorial'
]);

export type VictoryType = z.infer<typeof VictoryTypeSchema>;
