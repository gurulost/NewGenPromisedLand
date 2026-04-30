import { describe, expect, it } from 'vitest';
import type { GameMap, GameState } from '@shared/types/game';
import {
  getExploredTileKeysForPlayer,
  isTileInspectableForRendering,
  resolveRenderingViewPlayer,
} from '../../client/src/components/game/HexGridInstanced';

const map = {
  width: 2,
  height: 1,
  tiles: [
    {
      coordinate: { q: 0, r: 0, s: 0 },
      terrain: 'plains',
      resources: [],
      hasCity: false,
      exploredBy: ['player1'],
    },
    {
      coordinate: { q: 1, r: 0, s: -1 },
      terrain: 'forest',
      resources: [],
      hasCity: false,
      exploredBy: ['player2'],
    },
  ],
} as GameMap;

const gameState = {
  id: 'visibility-test',
  players: [
    {
      id: 'player1',
      name: 'Active Player',
      factionId: 'NEPHITES',
      isAI: false,
      exploredTiles: ['0,0'],
      visibilityMask: [],
      citiesOwned: [],
    },
    {
      id: 'player2',
      name: 'Online Viewer',
      factionId: 'LAMANITES',
      isAI: false,
      exploredTiles: [],
      visibilityMask: [],
      citiesOwned: [],
    },
  ],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing',
  map,
  units: [],
  cities: [],
  improvements: [],
  structures: [],
} as unknown as GameState;

describe('rendering visibility helpers', () => {
  it('uses the online viewer player when the session exposes one', () => {
    expect(resolveRenderingViewPlayer(gameState, { myPlayerIds: ['player2'] })?.id).toBe('player2');
  });

  it('builds explored tile keys from tile.exploredBy', () => {
    const explored = getExploredTileKeysForPlayer(map, 'player2');

    expect(explored.has('1,0')).toBe(true);
    expect(explored.has('0,0')).toBe(false);
  });

  it('allows interaction with tiles that render as visible or explored', () => {
    expect(isTileInspectableForRendering('1,0', new Set(['1,0']), new Set())).toBe(true);
    expect(isTileInspectableForRendering('1,0', new Set(), new Set(['1,0']))).toBe(true);
    expect(isTileInspectableForRendering('1,0', new Set(), new Set())).toBe(false);
  });
});
