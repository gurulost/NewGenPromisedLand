import { describe, it, expect } from 'vitest';

import { executeElementHarvest } from '../../shared/logic/worldElementActions';
import { subscribeTelemetry, TelemetryEvent } from '../../shared/logic/telemetry';
import type { GameState } from '../../shared/types/game';
import { TECHNOLOGIES } from '../../shared/data/technologies';

const baseGameState: GameState = {
  id: 'world-element-test',
  players: [
    {
      id: 'player1',
      name: 'Explorer',
      factionId: 'NEPHITES',
      isAI: false,
      stars: 10,
      stats: { faith: 10, pride: 5, internalDissent: 2 },
      modifiers: [],
      abilityCooldowns: {},
      researchedTechs: [],
      researchInspiration: 0,
      citiesOwned: [],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0,
    },
  ],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 5,
    height: 5,
    tiles: [
      {
        coordinate: { q: 0, r: 0, s: 0 },
        terrain: 'plains',
        resources: [],
        hasCity: false,
        exploredBy: ['player1'],
        feature: 'village',
      },
    ],
  },
  units: [],
  cities: [],
  improvements: [],
  structures: [],
};

const ruinTile = {
  coordinate: { q: 0, r: 0, s: 0 },
  terrain: 'plains',
  resources: [],
  hasCity: false,
  exploredBy: ['player1'],
  feature: 'jaredite_ruins' as const,
};

describe('executeElementHarvest telemetry', () => {

  it('emits technology telemetry when a ruin grants a tech', () => {
    const gameState: GameState = {
      ...baseGameState,
      map: { ...baseGameState.map, tiles: [ruinTile] },
    };

    const events: TelemetryEvent[] = [];
    const unsubscribe = subscribeTelemetry(event => events.push(event));

    const rolls = [0, 0];
    const result = executeElementHarvest(
      gameState,
      'player1',
      'jaredite_ruins',
      { q: 0, r: 0, s: 0 },
      () => rolls.shift() ?? 0
    );

    unsubscribe();

    expect(result.success).toBe(true);
    const techEvent = events.find(evt => evt.channel === 'technology' && evt.reason === 'ruin_reward');
    expect(techEvent).toBeTruthy();
    expect(techEvent?.technologyId).toBeTruthy();
  });

  it('logs informational telemetry when no technologies remain', () => {
    const allTechIds = Object.keys(TECHNOLOGIES);
    const gameState: GameState = {
      ...baseGameState,
      players: [
        {
          ...baseGameState.players[0],
          researchedTechs: allTechIds,
        },
      ],
      map: { ...baseGameState.map, tiles: [ruinTile] },
    };

    const events: TelemetryEvent[] = [];
    const unsubscribe = subscribeTelemetry(event => events.push(event));

    const result = executeElementHarvest(
      gameState,
      'player1',
      'jaredite_ruins',
      { q: 0, r: 0, s: 0 },
      () => 0
    );

    unsubscribe();

    expect(result.success).toBe(true);
    const infoEvent = events.find(evt => evt.channel === 'technology' && evt.reason === 'ruin_reward_unavailable');
    expect(infoEvent).toBeTruthy();
  });
});
