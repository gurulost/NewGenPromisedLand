import type { AbilityDefinition } from '@shared/data/abilities';
import type { PlayerState } from '@shared/types/game';

export type AbilityValidationReason =
  | 'missing'
  | 'cooldown'
  | 'requirements';

export interface AbilityValidationResult {
  ok: boolean;
  reason?: AbilityValidationReason;
  unmetRequirements?: string[];
  cooldownRemaining?: number;
  ability?: AbilityDefinition;
}

export const validateAbilityForPlayer = (
  ability: AbilityDefinition | undefined,
  abilityId: string,
  player: PlayerState
): AbilityValidationResult => {
  if (!ability) {
    return {
      ok: false,
      reason: 'missing',
    };
  }

  const cooldownRemaining = player.abilityCooldowns?.[abilityId] ?? 0;
  if (cooldownRemaining > 0) {
    return {
      ok: false,
      reason: 'cooldown',
      cooldownRemaining,
      ability,
    };
  }

  const unmet: string[] = [];
  const reqs = ability.requirements;

  if (reqs?.faith && player.stats.faith < reqs.faith) {
    unmet.push(`Faith ${player.stats.faith}/${reqs.faith}`);
  }
  if (reqs?.pride && player.stats.pride < reqs.pride) {
    unmet.push(`Pride ${player.stats.pride}/${reqs.pride}`);
  }
  if (reqs?.dissent && player.stats.internalDissent < reqs.dissent) {
    unmet.push(`Dissent ${player.stats.internalDissent}/${reqs.dissent}`);
  }

  if (unmet.length > 0) {
    return {
      ok: false,
      reason: 'requirements',
      unmetRequirements: unmet,
      ability,
    };
  }

  return {
    ok: true,
    ability,
  };
};
