import { simulateAITurns } from '../shared/ai/aiHarness';
import { GameState, PlayerState } from '../shared/types/game';
import { MapGenerator } from '../shared/utils/mapGenerator';
import { randomUUID } from 'node:crypto';

type SimOptions = {
  turns: number;
  mapSize: 'tiny' | 'small' | 'normal' | 'large';
  seed: number;
  aiCount: number;
};

const MAP_DIMENSIONS: Record<SimOptions['mapSize'], number> = {
  tiny: 10,
  small: 15,
  normal: 20,
  large: 30,
};

function createPlayers(count: number): PlayerState[] {
  const players: PlayerState[] = [];
  for (let i = 0; i < count; i++) {
    players.push({
      id: `ai_${i}`,
      name: `AI ${i + 1}`,
      factionId: 'NEPHITES',
      isAI: true,
      aiDifficulty: 'normal',
      stars: 10,
      stats: { faith: 50, pride: 30, internalDissent: 10 },
      modifiers: [],
      researchedTechs: [],
      researchProgress: 0,
      researchInspiration: 0,
      citiesOwned: [],
      exploredTiles: [],
      visibilityMask: [],
      isEliminated: false,
      turnOrder: i,
      abilityCooldowns: {},
      constructionQueue: [],
      atWarWith: [],
      alliedWith: [],
      tradeRoutes: [],
      diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    });
  }
  return players;
}

function createInitialState(options: SimOptions): GameState {
  const generator = new MapGenerator(
    {
      width: MAP_DIMENSIONS[options.mapSize],
      height: MAP_DIMENSIONS[options.mapSize],
      seed: options.seed,
      playerCount: options.aiCount,
      mapSize: options.mapSize,
      minResourceDistance: 2,
      maxResourcesPerPlayer: 3,
    },
    new Array(options.aiCount).fill('NEPHITES')
  );

  const map = generator.generateMap();

  const players = createPlayers(options.aiCount);

  // Assign starting cities
  const initialCityTiles = map.tiles.filter(t => t.hasCity);
  const tileKey = (q: number, r: number, s: number) => `${q},${r},${s}`;
  const usedTiles = new Set<string>();
  const cities = players.map((player, idx) => {
    const fallbackTile = map.tiles.find(
      tile => !usedTiles.has(tileKey(tile.coordinate.q, tile.coordinate.r, tile.coordinate.s))
    );
    const startTile = initialCityTiles[idx] || fallbackTile || map.tiles[0];
    usedTiles.add(tileKey(startTile.coordinate.q, startTile.coordinate.r, startTile.coordinate.s));
    startTile.hasCity = true;
    startTile.cityOwner = player.id;
    return {
      id: `city_${player.id}`,
      name: `${player.name} Capital`,
      coordinate: startTile.coordinate,
      ownerId: player.id,
      population: 1,
      maxPopulation: 4,
      level: 1,
      starProduction: 2,
      improvements: [],
      structures: [],
      harvestedResources: [],
    };
  });

  // Mark explored tiles around starting cities
  cities.forEach((city, idx) => {
    const playerId = players[idx]?.id;
    if (!playerId) return;
    map.tiles.forEach(tile => {
      const dist =
        Math.abs(tile.coordinate.q - city.coordinate.q) +
        Math.abs(tile.coordinate.r - city.coordinate.r) +
        Math.abs(tile.coordinate.s - city.coordinate.s);
      if (dist <= 2) {
        tile.exploredBy = [...(tile.exploredBy || []), playerId];
      }
    });
    players[idx].citiesOwned = [city.id];
  });

  const initialState: GameState = {
    id: randomUUID(),
    rngSeed: options.seed,
    players,
    currentPlayerIndex: 0,
    turn: 1,
    phase: 'playing',
    map,
    visibility: {},
    units: [],
    cities,
    improvements: [],
    structures: [],
    lastAction: undefined,
    winner: undefined,
  };

  return initialState;
}

function parseArgs(): SimOptions {
  const args = process.argv.slice(2);
  const options: SimOptions = {
    turns: 10,
    mapSize: 'normal',
    seed: Date.now(),
    aiCount: 2,
  };

  args.forEach(arg => {
    const [key, value] = arg.split('=');
    if (key === '--turns') options.turns = Number(value) || options.turns;
    if (key === '--map') options.mapSize = (value as SimOptions['mapSize']) || options.mapSize;
    if (key === '--seed') options.seed = Number(value) || options.seed;
    if (key === '--ai') options.aiCount = Number(value) || options.aiCount;
  });

  return options;
}

async function main() {
  const options = parseArgs();
  const initialState = createInitialState(options);
  const result = simulateAITurns(initialState, options.turns);

  const currentPlayer = result.finalState.players[result.finalState.currentPlayerIndex];
  const standings = result.finalState.players.map(p => ({
    id: p.id,
    stars: p.stars,
    cities: p.citiesOwned.length,
    techs: p.researchedTechs.length,
  }));

  console.log(`AI simulation complete`);
  console.log(`Turns simulated: ${result.turnsSimulated}`);
  console.log(`Actions applied: ${result.actionsApplied}`);
  console.log(`Errors: ${result.errors.length}`);
  if (result.errors.length) {
    result.errors.slice(0, 5).forEach(e => console.log(`  Turn ${e.turn} ${e.playerId}: ${e.error}`));
  }
  console.log(`Current player: ${currentPlayer?.id || 'n/a'}`);
  console.log(`Standings:`, standings);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
