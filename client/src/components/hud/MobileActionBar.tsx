import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Move, Swords, Sparkles, Hammer, XCircle } from 'lucide-react';

import { useGameState } from '../../lib/stores/useGameState';
import { getActionAvailability } from '../../lib/helpers/actionAvailabilityHelpers';
import { useMobileUI } from '../../hooks/useMobileUI';
import UnitActionsPanel from '../ui/AbilitiesPanel';
import type { GameState } from '@shared/types/game';
import type { Unit } from '@shared/types/unit';

interface MobileActionBarProps {
  unit: Unit | null;
  gameState: GameState;
}

export function MobileActionBar({ unit, gameState }: MobileActionBarProps) {
  const { isPortrait } = useMobileUI();
  const [showActionsPanel, setShowActionsPanel] = useState(false);
  const {
    setMovementMode,
    setAttackMode,
    setReachableCoordinates,
    setReachableTiles,
    isMovementMode,
    isAttackMode,
  } = useGameState();

  const availability = useMemo(() => {
    if (!unit) return null;
    return getActionAvailability(unit, gameState);
  }, [unit, gameState]);

  if (!unit || !availability) return null;

  const handleMove = () => {
    if (!availability.canMove) return;
    setAttackMode(false);
    setMovementMode(true);
  };

  const handleAttack = () => {
    if (!availability.canAttack) return;
    setMovementMode(false);
    setAttackMode(true);
  };

  const handleCancel = () => {
    setMovementMode(false);
    setAttackMode(false);
    setReachableTiles([]);
    setReachableCoordinates([]);
  };

  const showInteract = availability.canBuild || availability.canHarvest;
  const actionButtonLabel = availability.hasAbilities ? 'Abilities' : showInteract ? 'Interact' : 'Actions';
  const ActionIcon = availability.hasAbilities ? Sparkles : showInteract ? Hammer : Sparkles;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-auto">
        <div className="mobile-safe-bottom bg-slate-950/85 border-t border-amber-500/20 backdrop-blur-md px-3 py-3">
          <div className={clsx(
            "mobile-action-grid grid gap-2",
            isPortrait ? "grid-cols-2" : "grid-cols-4"
          )}>
            <button
              onClick={handleMove}
              disabled={!availability.canMove}
              className={clsx(
                "min-h-[52px] rounded-lg border text-sm font-semibold flex items-center justify-center gap-2",
                availability.canMove
                  ? "border-emerald-500/40 bg-emerald-900/30 text-emerald-100"
                  : "border-slate-700/40 bg-slate-900/40 text-slate-500"
              )}
            >
              <Move className="h-4 w-4" />
              Move
            </button>

            <button
              onClick={handleAttack}
              disabled={!availability.canAttack}
              className={clsx(
                "min-h-[52px] rounded-lg border text-sm font-semibold flex items-center justify-center gap-2",
                availability.canAttack
                  ? "border-red-500/40 bg-red-900/30 text-red-100"
                  : "border-slate-700/40 bg-slate-900/40 text-slate-500"
              )}
            >
              <Swords className="h-4 w-4" />
              Attack
            </button>

            <button
              onClick={() => setShowActionsPanel(true)}
              className={`min-h-[52px] rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 ${availability.hasAbilities
                ? 'border-purple-500/40 bg-purple-900/30 text-purple-100'
                : showInteract
                  ? 'border-amber-500/40 bg-amber-900/30 text-amber-100'
                  : 'border-slate-600/40 bg-slate-800/40 text-slate-100'
              }`}
            >
              <ActionIcon className="h-4 w-4" />
              {actionButtonLabel}
            </button>

            {(isMovementMode || isAttackMode) && (
              <button
                onClick={handleCancel}
                className="min-h-[52px] rounded-lg border border-slate-500/40 bg-slate-800/40 text-slate-100 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {showActionsPanel && (
        <UnitActionsPanel
          unit={unit}
          onClose={() => setShowActionsPanel(false)}
        />
      )}
    </>
  );
}
