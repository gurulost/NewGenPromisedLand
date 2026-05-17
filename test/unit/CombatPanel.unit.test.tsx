import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CombatPanel from '../../client/src/components/ui/CombatPanel';

vi.mock('@shared/logic/ruleQueries', () => ({
  getLegalUnitActions: vi.fn(() => [
    {
      id: 'attack:enemy1',
      label: 'Attack',
      kind: 'unit',
      sourceId: 'unit1',
      target: { kind: 'unit', id: 'enemy1' },
      action: { type: 'ATTACK_UNIT', payload: { attackerId: 'unit1', targetId: 'enemy1' } },
      check: { legal: true, reason: 'ok' },
    },
  ]),
  getCombatRulePreview: vi.fn(() => ({
    preview: {
      attackerDamage: 3,
      defenderDamage: 1,
      attackerHealthAfter: 10,
      defenderHealthAfter: 4,
      odds: 'Favorable',
      modifiers: { attacker: [], defender: [] },
      canAttack: true,
    },
  })),
}));

// Avoid portal/modal behavior in unit tests
vi.mock('../../client/src/components/ui/TooltipSystem', () => ({
  InfoTooltip: ({ children }: any) => children ?? null,
}));

describe('CombatPanel', () => {
  it('renders enemy HP using hp/maxHp (not legacy currentHp)', () => {
    const selectedUnit: any = {
      id: 'unit1',
      type: 'warrior',
      playerId: 'player1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 10,
      maxHp: 10,
      attack: 5,
      defense: 3,
      movement: 2,
      remainingMovement: 2,
      visionRadius: 2,
      attackRange: 1,
      hasAttacked: false,
      status: 'active',
      abilities: [],
      level: 1,
      experience: 0,
    };
    const enemyUnit: any = {
      id: 'enemy1',
      type: 'warrior',
      playerId: 'player2',
      coordinate: { q: 1, r: 0, s: -1 },
      hp: 7,
      maxHp: 12,
      attack: 5,
      defense: 3,
      movement: 2,
      remainingMovement: 2,
      visionRadius: 2,
      attackRange: 1,
      hasAttacked: false,
      status: 'active',
      abilities: [],
      level: 1,
      experience: 0,
    };

    const gameState: any = {
      id: 'g',
      players: [
        { id: 'player1', citiesOwned: ['city1'], isEliminated: false, turnOrder: 0 },
        { id: 'player2', citiesOwned: ['city2'], isEliminated: false, turnOrder: 1 },
      ],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { tiles: [], width: 3, height: 3 },
      units: [selectedUnit, enemyUnit],
      cities: [],
      improvements: [],
      structures: [],
    };

    render(
      <CombatPanel
        selectedUnit={selectedUnit}
        gameState={gameState}
        onAttackUnit={vi.fn()}
      />
    );

    expect(screen.getByText('7/12 HP')).toBeInTheDocument();
  });

  it('calls onAttackUnit when clicking an enemy', () => {
    const onAttackUnit = vi.fn();

    const selectedUnit: any = {
      id: 'unit1',
      type: 'warrior',
      playerId: 'player1',
      coordinate: { q: 0, r: 0, s: 0 },
      hp: 10,
      maxHp: 10,
      attack: 5,
      defense: 3,
      movement: 2,
      remainingMovement: 2,
      visionRadius: 2,
      attackRange: 1,
      hasAttacked: false,
      status: 'active',
      abilities: [],
      level: 1,
      experience: 0,
    };
    const enemyUnit: any = {
      id: 'enemy1',
      type: 'warrior',
      playerId: 'player2',
      coordinate: { q: 1, r: 0, s: -1 },
      hp: 7,
      maxHp: 12,
      attack: 5,
      defense: 3,
      movement: 2,
      remainingMovement: 2,
      visionRadius: 2,
      attackRange: 1,
      hasAttacked: false,
      status: 'active',
      abilities: [],
      level: 1,
      experience: 0,
    };

    const gameState: any = {
      id: 'g',
      players: [
        { id: 'player1', citiesOwned: ['city1'], isEliminated: false, turnOrder: 0 },
        { id: 'player2', citiesOwned: ['city2'], isEliminated: false, turnOrder: 1 },
      ],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { tiles: [], width: 3, height: 3 },
      units: [selectedUnit, enemyUnit],
      cities: [],
      improvements: [],
      structures: [],
    };

    render(
      <CombatPanel
        selectedUnit={selectedUnit}
        gameState={gameState}
        onAttackUnit={onAttackUnit}
      />
    );

    const label = screen.getByText('Warrior');
    const button = label.closest('button');
    expect(button).toBeTruthy();
    fireEvent.click(button!);

    expect(onAttackUnit).toHaveBeenCalledWith('unit1', 'enemy1');
  });
});
