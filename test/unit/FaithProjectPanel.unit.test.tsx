import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FaithProjectPanel } from '../../client/src/components/hud/FaithProjectPanel';
import { GAME_RULES } from '../../shared/data/gameRules';
import { validateFaithProjectStart } from '../../shared/logic/faithProject';
import type { City, Structure } from '../../shared/types/city';
import type { GameState, PlayerState } from '../../shared/types/game';
import type { HexCoordinate } from '../../shared/types/coordinates';

const faithRules = GAME_RULES.victory.faithVictory;
const holyCityTuple: [string, string, string] = ['city-1', 'city-2', 'city-3'];

function coord(q: number, r: number): HexCoordinate {
  return { q, r, s: -q - r };
}

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'player-1',
    name: 'Nephi',
    factionId: 'NEPHITES',
    isAI: false,
    stars: 100,
    stats: { faith: 100, pride: 0, internalDissent: 0 },
    modifiers: [],
    researchedTechs: [],
    researchProgress: 0,
    researchInspiration: 0,
    abilityCooldowns: {},
    citiesOwned: [...holyCityTuple],
    constructionQueue: [],
    visibilityMask: [],
    exploredTiles: [],
    isEliminated: false,
    turnOrder: 0,
    atWarWith: [],
    alliedWith: [],
    tradeRoutes: [],
    diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    faithProject: null,
    ...overrides,
  };
}

function makeCity(id: string, name: string, coordinate: HexCoordinate): City {
  return {
    id,
    name,
    coordinate,
    ownerId: 'player-1',
    population: 3,
    maxPopulation: 4,
    level: 1,
    starProduction: 2,
    unrestTurns: 0,
    improvements: [],
    structures: [],
    harvestedResources: [],
  };
}

function makeStructure(id: string, type: Structure['type'], cityId: string): Structure {
  return {
    id,
    type,
    cityId,
    ownerId: 'player-1',
    constructionTurns: 0,
    effects: {
      starProduction: 0,
      unitProduction: 0,
      defenseBonus: 0,
      populationGrowth: 0,
      faithProduction: 0,
    },
  };
}

function makeGameState({
  player = makePlayer(),
  turn = faithRules.minTurnToStart,
  includeCathedral = true,
}: {
  player?: PlayerState;
  turn?: number;
  includeCathedral?: boolean;
} = {}): GameState {
  const cities = [
    makeCity('city-1', 'Zarahemla', coord(0, 0)),
    makeCity('city-2', 'Bountiful', coord(1, 0)),
    makeCity('city-3', 'Manti', coord(0, 1)),
  ];
  const structures = [
    makeStructure('temple-1', 'temple', 'city-1'),
    makeStructure('temple-2', 'temple', 'city-2'),
    makeStructure('temple-3', 'temple', 'city-3'),
    ...(includeCathedral ? [makeStructure('cathedral-1', 'cathedral', 'city-1')] : []),
  ];

  return {
    id: 'faith-project-panel-test',
    rngSeed: 1,
    players: [player, makePlayer({
      id: 'player-2',
      name: 'Laman',
      factionId: 'LAMANITES',
      citiesOwned: [],
      turnOrder: 1,
    })],
    currentPlayerIndex: 0,
    turn,
    phase: 'playing',
    map: {
      width: 8,
      height: 8,
      tiles: cities.map(city => ({
        coordinate: city.coordinate,
        terrain: 'plains',
        resources: [],
        hasCity: true,
        cityOwner: city.ownerId,
        exploredBy: ['player-1'],
      })),
    },
    units: [],
    cities,
    improvements: [],
    structures,
    activeEffects: [],
  };
}

function renderFaithProjectPanel(gameState: GameState, player = gameState.players[0], onStartFaithProject = vi.fn()) {
  render(
    <FaithProjectPanel
      player={player}
      gameState={gameState}
      onStartFaithProject={onStartFaithProject}
    />,
  );

  return { onStartFaithProject };
}

describe('FaithProjectPanel', () => {
  it('shows every shared blocked reason and canonical costs before commitment', async () => {
    const player = makePlayer({
      stars: faithRules.startStarsCost - 1,
      stats: {
        faith: faithRules.minFaithToStart - 1,
        pride: 0,
        internalDissent: faithRules.maxDissentToStart + 1,
      },
    });
    const gameState = makeGameState({ player, turn: faithRules.minTurnToStart - 1 });
    const validation = validateFaithProjectStart(gameState, player.id, holyCityTuple);

    expect(validation.ok).toBe(false);
    renderFaithProjectPanel(gameState, player);

    expect(await screen.findByText(`Start: ${faithRules.startFaithCost} Faith + ${faithRules.startStarsCost} Stars.`)).toBeInTheDocument();
    expect(screen.getByText(`Sustain ${faithRules.progressToWin} turn ends: ${faithRules.faithCostPerProgress} Faith + ${faithRules.starsCostPerProgress} Stars each progress tick.`)).toBeInTheDocument();
    for (const reason of validation.reasons) {
      expect(await screen.findByText(reason)).toBeInTheDocument();
    }
    expect(screen.getByTestId('start-faith-project-button')).toBeDisabled();
  });

  it('explains that three Temple cities still need a Cathedral', async () => {
    const player = makePlayer();
    const gameState = makeGameState({ player, includeCathedral: false });
    const validation = validateFaithProjectStart(gameState, player.id, holyCityTuple);
    const cathedralReason = validation.reasons.find(reason => reason.includes('Cathedral'));

    expect(validation.ok).toBe(false);
    expect(cathedralReason).toBeTruthy();
    renderFaithProjectPanel(gameState, player);

    expect(await screen.findByText(cathedralReason!)).toBeInTheDocument();
    expect(screen.getByTestId('start-faith-project-button')).toBeDisabled();
  });

  it('starts Consecration with the selected canonical holy-city tuple when legal', async () => {
    const user = userEvent.setup();
    const player = makePlayer();
    const gameState = makeGameState({ player });
    const { onStartFaithProject } = renderFaithProjectPanel(gameState, player);
    const startButton = await screen.findByTestId('start-faith-project-button');

    expect(screen.getByText(`Start: ${faithRules.startFaithCost} Faith + ${faithRules.startStarsCost} Stars.`)).toBeInTheDocument();
    expect(screen.getByText(`Sustain ${faithRules.progressToWin} turn ends: ${faithRules.faithCostPerProgress} Faith + ${faithRules.starsCostPerProgress} Stars each progress tick.`)).toBeInTheDocument();
    await waitFor(() => expect(startButton).toBeEnabled());

    await user.click(startButton);

    expect(onStartFaithProject).toHaveBeenCalledWith(holyCityTuple);
  });

  it('shows active progress, holy cities, next upkeep, and pause warning', () => {
    const player = makePlayer({
      atWarWith: ['player-2'],
      faithProject: {
        active: true,
        progress: 1,
        holyCityIds: holyCityTuple,
        startedTurn: faithRules.minTurnToStart,
        pausedReason: null,
      },
    });
    const gameState = makeGameState({ player });

    renderFaithProjectPanel(gameState, player);

    expect(screen.getByText(/Progress 1\/3; holy cities:/)).toHaveTextContent('Zarahemla, Bountiful, Manti');
    expect(screen.getByText(`Next upkeep: pay ${faithRules.faithCostPerProgress} Faith and ${faithRules.starsCostPerProgress} Stars at your turn end.`)).toBeInTheDocument();
    expect(screen.getByText('Will pause: At war.')).toBeInTheDocument();
  });
});
