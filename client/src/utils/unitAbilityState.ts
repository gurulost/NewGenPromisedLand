import { useMemo } from "react";
import { ABILITIES } from "@shared/data/abilities";
import type { GameState, PlayerState } from "@shared/types/game";
import type { Unit } from "@shared/types/unit";
import { hexDistance } from "@shared/utils/hex";

export type UnitAbilityStatus = 'ready' | 'locked' | 'exhausted' | 'passive';

export interface UnitAbilityState {
  abilityId: string;
  name: string;
  description?: string;
  status: UnitAbilityStatus;
  reason?: string;
  isPassive: boolean;
  order: number;
}

type AbilityEvaluator = (params: {
  unit: Unit;
  player: PlayerState;
  gameState: GameState;
}) => { status: UnitAbilityStatus; reason?: string };

interface AbilityConfig {
  abilityId: string;
  unitTypes: Unit["type"][];
  displayName?: string;
  description?: string;
  evaluate: AbilityEvaluator;
  order?: number;
}

const abilityConfigs: AbilityConfig[] = [
  {
    abilityId: 'HEAL',
    unitTypes: ['missionary'],
    displayName: 'Heal Nearby Units',
    evaluate: ({ unit, player }) => {
      const hasHealingTech = player.researchedTechs.includes('spirituality');
      if (!hasHealingTech) {
        return { status: 'locked', reason: 'Requires Spirituality technology' };
      }
      if (player.stats.faith < 5) {
        return { status: 'locked', reason: 'Needs 5 Faith' };
      }
      if (unit.hasAttacked) {
        return { status: 'exhausted', reason: 'Unit already acted this turn' };
      }
      return { status: 'ready' };
    },
    order: 1,
  },
  {
    abilityId: 'CONVERT',
    unitTypes: ['missionary'],
    displayName: 'Convert Enemy',
    evaluate: ({ unit, player, gameState }) => {
      if (player.stats.faith < 10) {
        return { status: 'locked', reason: 'Needs 10 Faith' };
      }
      if (unit.hasAttacked) {
        return { status: 'exhausted', reason: 'Unit already acted this turn' };
      }
      const adjacentEnemies = gameState.units.some(candidate =>
        candidate.playerId !== unit.playerId &&
        candidate.playerId !== undefined &&
        hexDistance(candidate.coordinate, unit.coordinate) === 1
      );
      if (!adjacentEnemies) {
        return { status: 'locked', reason: 'No adjacent enemy to convert' };
      }
      return { status: 'ready' };
    },
    order: 2,
  },
  {
    abilityId: 'STEALTH',
    unitTypes: ['scout'],
    displayName: 'Stealth Mode',
    evaluate: ({ unit }) => {
      if (unit.status === 'stealthed') {
        return { status: 'locked', reason: 'Already stealthed' };
      }
      if (unit.hasAttacked) {
        return { status: 'exhausted', reason: 'Unit already acted this turn' };
      }
      return { status: 'ready' };
    },
    order: 1,
  },
  {
    abilityId: 'RECONNAISSANCE',
    unitTypes: ['scout'],
    displayName: 'Reconnaissance',
    evaluate: ({ unit }) => {
      if (unit.hasAttacked) {
        return { status: 'exhausted', reason: 'Unit already acted this turn' };
      }
      return { status: 'ready' };
    },
    order: 2,
  },
  {
    abilityId: 'RALLY_TROOPS',
    unitTypes: ['commander'],
    displayName: 'Rally Troops',
    evaluate: ({ unit, player }) => {
      if (player.stats.pride < 5) {
        return { status: 'locked', reason: 'Needs 5 Pride' };
      }
      if (unit.hasAttacked) {
        return { status: 'exhausted', reason: 'Unit already acted this turn' };
      }
      return { status: 'ready' };
    },
    order: 1,
  },
  {
    abilityId: 'BOMBARDMENT',
    unitTypes: ['catapult'],
    displayName: 'Artillery Bombardment',
    description: 'Long-range area attack when deployed in siege mode.',
    evaluate: ({ unit }) => {
      if (unit.status !== 'siege_mode') {
        return { status: 'locked', reason: 'Deploy siege mode first' };
      }
      if (unit.remainingMovement !== unit.movement) {
        return { status: 'locked', reason: 'Must be stationary this turn' };
      }
      if (unit.hasAttacked) {
        return { status: 'exhausted', reason: 'Unit already attacked this turn' };
      }
      return { status: 'ready' };
    },
    order: 1,
  },
];

const abilityOrderValue = (status: UnitAbilityStatus): number => {
  switch (status) {
    case 'ready':
      return 0;
    case 'exhausted':
      return 1;
    case 'locked':
      return 2;
    case 'passive':
    default:
      return 3;
  }
};

export function getUnitAbilityStates(
  unit: Unit,
  player: PlayerState,
  gameState: GameState
): UnitAbilityState[] {
  const unitDefAbilities = (unit as Unit).abilities || [];
  const normalizedAbilities = new Set(
    unitDefAbilities.map(ability => ability.toUpperCase())
  );

  const activeStates: UnitAbilityState[] = abilityConfigs
    .filter(config => config.unitTypes.includes(unit.type))
    .map(config => {
      const abilityDefinition = ABILITIES[config.abilityId] || null;
      const evaluation = config.evaluate({ unit, player, gameState });
      return {
        abilityId: config.abilityId,
        name: config.displayName || abilityDefinition?.name || config.abilityId.replace(/_/g, ' '),
        description: config.description || abilityDefinition?.description,
        status: evaluation.status,
        reason: evaluation.reason,
        isPassive: false,
        order: config.order ?? 0,
      };
    });

  const passiveStates: UnitAbilityState[] = Array.from(normalizedAbilities)
    .filter(abilityId => !activeStates.some(state => state.abilityId === abilityId))
    .map(abilityId => {
      const abilityDefinition = ABILITIES[abilityId];
      return {
        abilityId,
        name: abilityDefinition?.name || abilityId.replace(/_/g, ' '),
        description: abilityDefinition?.description,
        status: 'passive',
        reason: undefined,
        isPassive: true,
        order: 99,
      };
    });

  const merged = [...activeStates, ...passiveStates];
  return merged.sort((a, b) => {
    const statusOrder = abilityOrderValue(a.status) - abilityOrderValue(b.status);
    if (statusOrder !== 0) return statusOrder;
    if (a.order !== b.order) return a.order - b.order;
    return a.name.localeCompare(b.name);
  });
}

// Helper for other components that are using React but want memorised results
export function useUnitAbilityStates(
  unit: Unit | null,
  player: PlayerState | null,
  gameState: GameState | null
): UnitAbilityState[] {
  return useMemo(() => {
    if (!unit || !player || !gameState) return [];
    return getUnitAbilityStates(unit, player, gameState);
  }, [unit, player, gameState]);
}
