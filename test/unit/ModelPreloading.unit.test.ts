import { describe, expect, it, vi } from 'vitest';
import type { GameState } from '@shared/types/game';

vi.mock('@react-three/drei', () => {
  const preload = vi.fn();
  const useGLTF = Object.assign(vi.fn(), { preload });
  return { useGLTF };
});

const gameState = {
  id: 'preload-test',
  players: [
    {
      id: 'player1',
      name: 'Player 1',
      factionId: 'NEPHITES',
      stats: { faith: 0, pride: 0, internalDissent: 0 },
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0,
      stars: 0,
      researchedTechs: [],
      researchProgress: 0,
      citiesOwned: ['city1'],
    },
  ],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map: {
    width: 2,
    height: 1,
    tiles: [
      {
        coordinate: { q: 0, r: 0, s: 0 },
        terrain: 'plains',
        resources: ['timber_grove'],
        hasCity: true,
        exploredBy: ['player1'],
      },
      {
        coordinate: { q: 1, r: 0, s: -1 },
        terrain: 'forest',
        resources: [],
        hasCity: false,
        feature: 'village',
        exploredBy: ['player1'],
      },
    ],
  },
  units: [
    {
      id: 'unit1',
      type: 'warrior',
      playerId: 'player1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 10,
      maxHp: 10,
      movement: 1,
      remainingMovement: 1,
      attack: 5,
      defense: 3,
      visionRadius: 2,
      attackRange: 1,
      abilities: [],
      status: 'active',
      level: 1,
      experience: 0,
    },
  ],
  cities: [
    {
      id: 'city1',
      name: 'City 1',
      ownerId: 'player1',
      coordinate: { q: 0, r: 0, s: 0 },
      population: 1,
      level: 1,
      production: 1,
      buildings: [],
    },
  ],
  improvements: [],
  structures: [],
} as unknown as GameState;

describe('model preloading', () => {
  it('does not preload terrain GLBs for match rendering', async () => {
    const { collectMatchModelPaths } = await import('../../client/src/utils/modelManager');

    const paths = collectMatchModelPaths(gameState);

    expect([...paths].filter(path => path.includes('/terrain_'))).toEqual([]);
    expect(paths.has('/models/warrior.glb')).toBe(true);
    expect(paths.has('/models/village.glb')).toBe(true);
    expect(paths.has('/models/city_level1.glb')).toBe(true);
    expect(paths.has('/models/forest_canopy.glb')).toBe(true);
  });
});
