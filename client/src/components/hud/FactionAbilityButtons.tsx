import clsx from 'clsx';
import { Sparkles } from 'lucide-react';

import { ABILITIES } from '@shared/data/abilities';
import { getFaction } from '@shared/data/factions';
import { explainFactionAbilityAction, type FactionAbilityAvailability } from '@shared/logic/ruleQueries';
import { coerceFactionId } from '@shared/types/factionId';
import type { GameState, PlayerState } from '@shared/types/game';

interface FactionAbilityButtonsProps {
  player: PlayerState;
  gameState: GameState;
  onUseFactionAbility?: (abilityId: string) => void;
  variant?: 'hud' | 'mobile-menu';
  compact?: boolean;
}

function formatBlockedReason(availability: FactionAbilityAvailability): string {
  if (availability.available) return 'Ready';

  switch (availability.reason) {
    case 'requirements':
      return availability.unmetRequirements?.map(requirement => {
        const [resource, progress] = requirement.split(':');
        return `${resource.charAt(0).toUpperCase()}${resource.slice(1)} ${progress}`;
      }).join(', ') ?? 'Requirements';
    case 'cooldown':
      return `${availability.cooldownRemaining ?? 0} turn${availability.cooldownRemaining === 1 ? '' : 's'}`;
    case 'design_pending':
      return 'Pending';
    case 'disabled':
      return 'Unavailable';
    case 'no_valid_source':
      return 'Need missionary';
    case 'no_valid_targets':
      return 'No targets';
    case 'not_current_turn':
      return 'Waiting';
    default:
      return 'Blocked';
  }
}

function getAbilityCostLabel(availability: FactionAbilityAvailability): string | null {
  const cost = availability.spec?.cost;
  if (!cost) return null;

  const entries = Object.entries(cost).filter(([, value]) => typeof value === 'number' && value > 0);
  if (entries.length === 0) return null;

  return entries.map(([resource, value]) => `${value} ${resource}`).join(', ');
}

export function FactionAbilityButtons({
  player,
  gameState,
  onUseFactionAbility,
  variant = 'hud',
  compact = false,
}: FactionAbilityButtonsProps) {
  const factionId = coerceFactionId(player.factionId);
  const faction = factionId ? getFaction(factionId) : undefined;
  const activeAbilities = faction?.abilities.filter(ability => ability.type === 'active') ?? [];

  if (activeAbilities.length === 0) return null;

  const isMobileMenu = variant === 'mobile-menu';

  return (
    <div
      className={clsx(
        isMobileMenu ? 'col-span-2 grid grid-cols-1 gap-2' : 'space-y-2',
        compact && !isMobileMenu && 'rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-3',
      )}
    >
      {!isMobileMenu && (
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-sky-200/75">
          <Sparkles className="h-3.5 w-3.5 text-sky-300" />
          <span>Faction Tools</span>
        </div>
      )}

      <div className={clsx(isMobileMenu ? 'grid grid-cols-1 gap-2' : 'space-y-2')}>
        {activeAbilities.map(factionAbility => {
          const ability = ABILITIES[factionAbility.id];
          const { availability, check } = explainFactionAbilityAction(gameState, player.id, factionAbility.id);
          const available = availability.available && check.legal;
          const reason = availability.available && !check.legal
            ? check.reason.replace(/_/g, ' ')
            : formatBlockedReason(availability);
          const costLabel = getAbilityCostLabel(availability);
          const abilityName = ability?.name ?? factionAbility.name;
          const helperText = available
            ? availability.spec.ui.ready
            : check.message ?? availability.spec?.ui.blocked ?? reason;

          return (
            <button
              key={factionAbility.id}
              type="button"
              disabled={!available || !onUseFactionAbility}
              data-testid={`hud-faction-ability-${factionAbility.id}`}
              aria-label={`${abilityName}: ${available ? 'ready' : reason}. ${helperText}`}
              title={helperText}
              onClick={() => {
                if (available) onUseFactionAbility?.(factionAbility.id);
              }}
              className={clsx(
                'group flex min-h-[46px] w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                available
                  ? 'border-sky-400/45 bg-sky-900/25 text-sky-50 hover:border-sky-300/70 hover:bg-sky-800/35'
                  : 'cursor-not-allowed border-slate-600/45 bg-slate-900/50 text-slate-300/70',
                isMobileMenu && 'min-h-[52px]',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Sparkles className={clsx('h-4 w-4 shrink-0', available ? 'text-sky-300' : 'text-slate-500')} />
                <span className="min-w-0">
                  <span className={clsx('block truncate font-cinzel font-semibold', compact ? 'text-xs' : 'text-sm')}>
                    {abilityName}
                  </span>
                  {costLabel && (
                    <span className="block text-[11px] leading-tight text-sky-100/65">{costLabel}</span>
                  )}
                </span>
              </span>

              <span
                className={clsx(
                  'shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.16em]',
                  available
                    ? 'border-sky-300/25 bg-sky-300/10 text-sky-100'
                    : 'border-slate-500/25 bg-slate-700/25 text-slate-300/75',
                )}
              >
                {reason}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
