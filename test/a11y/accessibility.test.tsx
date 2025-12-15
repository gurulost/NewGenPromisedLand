import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { PlayerHUD } from '../../client/src/components/hud/PlayerHUD';
import { BuildingMenu } from '../../client/src/components/ui/BuildingMenu';

describe('Accessibility smoke tests', () => {
  it('PlayerHUD renders with accessible buttons/labels', () => {
    const player: any = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'NEPHITES',
      stars: 25,
      stats: { faith: 8, pride: 3, internalDissent: 2 },
      modifiers: [],
      researchedTechs: ['organization'],
      citiesOwned: [],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0,
      atWarWith: [],
      alliedWith: [],
      tradeRoutes: [],
      diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    };

    const gameState: any = {
      players: [player],
      currentPlayerId: 'player1',
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { tiles: [], width: 10, height: 10 },
      units: [],
      cities: [],
      improvements: [],
      structures: [],
    };

    render(
      <PlayerHUD
        player={player}
        gameState={gameState}
        onShowTechPanel={() => {}}
        onShowConstructionHall={() => {}}
        onShowDiplomacy={() => {}}
        onEndTurn={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /knowledge/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /build/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /diplomacy/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /end turn/i })).toBeTruthy();
    expect(screen.getByLabelText(/faction/i)).toBeTruthy();
  });

  it('BuildingMenu exposes resource counters via aria-labels', () => {
    const player: any = {
      id: 'player1',
      name: 'Test Player',
      factionId: 'NEPHITES',
      stars: 25,
      stats: { faith: 8, pride: 3, internalDissent: 2 },
      modifiers: [],
      researchedTechs: ['organization'],
      citiesOwned: ['city1'],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0,
      atWarWith: [],
      alliedWith: [],
      tradeRoutes: [],
      diplomaticCooldowns: { declareWar: 0, formAlliance: 0, breakAlliance: 0, requestTrade: 0 },
    };

    const city: any = {
      id: 'city1',
      name: 'Test City',
      coordinate: { q: 0, r: 0, s: 0 },
      ownerId: 'player1',
      population: 3,
      maxPopulation: 4,
      level: 1,
      starProduction: 2,
      unrestTurns: 0,
      improvements: [],
      structures: [],
      harvestedResources: [],
    };

    const gameState: any = {
      players: [player],
      currentPlayerId: 'player1',
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { tiles: [], width: 10, height: 10 },
      units: [],
      cities: [city],
      improvements: [],
      structures: [],
    };

    render(
      <BuildingMenu
        city={city}
        player={player}
        gameState={gameState}
        onBuild={() => {}}
        onClose={() => {}}
      />
    );

    expect(screen.getByLabelText('Stars')).toBeTruthy();
    expect(screen.getByLabelText('Faith')).toBeTruthy();
    expect(screen.getByLabelText('Pride')).toBeTruthy();
    expect(screen.getByLabelText('Dissent')).toBeTruthy();
  });
});

