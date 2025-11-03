import { describe, it, expect, beforeEach, vi } from 'vitest';

import { useGameState } from '../../client/src/lib/stores/useGameState';

const resetAbilityTargetMode = () => {
  useGameState.setState({
    abilityTargetMode: {
      isActive: false,
      abilityId: null,
      title: null,
      instructions: null,
      eligibleUnitIds: [],
      selectedUnitId: null,
      onSelectUnit: undefined,
    },
  });
};

describe('Ability targeting store flow', () => {
  beforeEach(() => {
    resetAbilityTargetMode();
  });

  it('activates targeting with clean state', () => {
    const { startAbilityTargeting, setAbilityTargetSelection } = useGameState.getState();
    setAbilityTargetSelection('stale-unit');

    const onSelect = vi.fn();
    startAbilityTargeting({
      abilityId: 'DIVINE_WARD',
      title: 'Divine Ward',
      instructions: 'Test instructions',
      eligibleUnitIds: ['unit-1', 'unit-2'],
      onSelectUnit: onSelect,
    });

    const state = useGameState.getState().abilityTargetMode;
    expect(state.isActive).toBe(true);
    expect(state.abilityId).toBe('DIVINE_WARD');
    expect(state.selectedUnitId).toBeNull();
    expect(state.eligibleUnitIds).toEqual(['unit-1', 'unit-2']);
    expect(state.onSelectUnit).toBe(onSelect);
  });

  it('records selected unit and honors callback', () => {
    const store = useGameState.getState();
    const picked: string[] = [];
    store.startAbilityTargeting({
      abilityId: 'RIGHTEOUS_FURY',
      title: 'Righteous Fury',
      instructions: 'Choose a warrior',
      eligibleUnitIds: ['alpha', 'beta'],
      onSelectUnit: (unitId) => {
        picked.push(unitId);
        store.setAbilityTargetSelection(unitId);
      },
    });

    const { abilityTargetMode } = useGameState.getState();
    expect(abilityTargetMode.selectedUnitId).toBeNull();

    abilityTargetMode.onSelectUnit?.('beta');

    const nextState = useGameState.getState().abilityTargetMode;
    expect(picked).toEqual(['beta']);
    expect(nextState.selectedUnitId).toBe('beta');
  });

  it('cancels targeting and clears selection', () => {
    const store = useGameState.getState();
    store.startAbilityTargeting({
      abilityId: 'DIVINE_WARD',
      title: 'Divine Ward',
      instructions: 'Test instructions',
      eligibleUnitIds: ['unit-1'],
      onSelectUnit: (unitId) => store.setAbilityTargetSelection(unitId),
    });
    store.setAbilityTargetSelection('unit-1');

    store.cancelAbilityTargeting();

    const resetState = useGameState.getState().abilityTargetMode;
    expect(resetState.isActive).toBe(false);
    expect(resetState.abilityId).toBeNull();
    expect(resetState.selectedUnitId).toBeNull();
    expect(resetState.onSelectUnit).toBeUndefined();
    expect(resetState.eligibleUnitIds).toEqual([]);
  });
});
