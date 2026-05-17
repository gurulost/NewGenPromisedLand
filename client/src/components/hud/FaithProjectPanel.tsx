import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, Landmark } from 'lucide-react';

import type { City } from '@shared/types/city';
import type { GameState, PlayerState } from '@shared/types/game';
import {
  cityHasCompletedStructure,
  getActiveFaithProject,
  getFaithProjectPauseReasons,
  getFaithProjectResetReasons,
  getFaithProjectStartOptions,
  getHolyCityContestState,
  validateFaithProjectStart,
} from '@shared/logic/faithProject';
import { GAME_RULES } from '@shared/data/gameRules';

interface FaithProjectPanelProps {
  player: PlayerState;
  gameState: GameState;
  onStartFaithProject: (holyCityIds: [string, string, string]) => void;
}

export function FaithProjectPanel({
  player,
  gameState,
  onStartFaithProject,
}: FaithProjectPanelProps) {
  const faithVictory = GAME_RULES.victory.faithVictory;
  const activeFaithProject = getActiveFaithProject(player);
  const holyCandidateCities = useMemo(() => {
    const candidates = getFaithProjectStartOptions(gameState, player.id);
    return [...candidates].sort((a, b) => {
      const aCathedral = cityHasCompletedStructure(gameState, player.id, a.id, 'cathedral') ? 1 : 0;
      const bCathedral = cityHasCompletedStructure(gameState, player.id, b.id, 'cathedral') ? 1 : 0;
      if (aCathedral !== bCathedral) return bCathedral - aCathedral;
      return (b.population || 0) - (a.population || 0);
    });
  }, [gameState, player.id]);

  const [selectedHolyCityIds, setSelectedHolyCityIds] = useState<string[]>([]);
  const holyCandidateCityIds = useMemo(() => holyCandidateCities.map(city => city.id), [holyCandidateCities]);

  useEffect(() => {
    setSelectedHolyCityIds(current => {
      const stillValid = current.filter(cityId => holyCandidateCityIds.includes(cityId));
      const next = stillValid.length > 0
        ? stillValid.slice(0, faithVictory.holyCitiesRequired)
        : holyCandidateCityIds.slice(0, faithVictory.holyCitiesRequired);
      return next.length === current.length && next.every((cityId, index) => cityId === current[index])
        ? current
        : next;
    });
  }, [holyCandidateCityIds, faithVictory.holyCitiesRequired]);

  const selectedHolyCityTuple = selectedHolyCityIds.length === faithVictory.holyCitiesRequired
    ? [selectedHolyCityIds[0], selectedHolyCityIds[1], selectedHolyCityIds[2]] as [string, string, string]
    : null;
  const faithStartValidation = selectedHolyCityTuple
    ? validateFaithProjectStart(gameState, player.id, selectedHolyCityTuple)
    : {
        ok: false,
        reasons: [`Choose exactly ${faithVictory.holyCitiesRequired} holy cities.`],
        holyCityIds: null,
      };
  const projectResetReasons = activeFaithProject
    ? getFaithProjectResetReasons(gameState, player.id, activeFaithProject)
    : [];
  const projectPauseReasons = activeFaithProject
    ? getFaithProjectPauseReasons(gameState, player.id, activeFaithProject)
    : [];
  const contestedHolyCities = activeFaithProject
    ? getHolyCityContestState(gameState, player.id, activeFaithProject.holyCityIds).contestedCityIds.length
    : 0;

  if (!faithVictory.enabled) return null;

  return (
    <div className="mt-2 rounded-lg border border-sky-400/20 bg-sky-950/20 px-3 py-2 text-xs font-body text-sky-50/90">
      <div className="flex items-center gap-2 font-cinzel text-[11px] uppercase tracking-[0.2em] text-sky-200/80">
        <Landmark className="h-3.5 w-3.5 text-sky-300" />
        Faith Project
      </div>

      {activeFaithProject ? (
        <div className="mt-2 space-y-1 leading-relaxed">
          <div>
            Progress {activeFaithProject.progress}/{faithVictory.progressToWin}; holy cities:{' '}
            {activeFaithProject.holyCityIds
              .map(cityId => gameState.cities.find(city => city.id === cityId)?.name ?? cityId)
              .join(', ')}
          </div>
          {contestedHolyCities > 0 && (
            <div className="flex items-center gap-1 text-red-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              {contestedHolyCities} holy city tile is contested by enemy military.
            </div>
          )}
          {projectPauseReasons.length > 0 && (
            <div className="text-amber-200">Will pause: {projectPauseReasons[0]}</div>
          )}
          {projectResetReasons.length > 0 && (
            <div className="text-red-200">Will fail: {projectResetReasons[0]}</div>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="leading-relaxed text-sky-100/75">
            Choose 3 owned Temple cities, including at least one Cathedral city. Starting costs {faithVictory.startFaithCost} Faith and {faithVictory.startStarsCost} Stars.
          </div>
          <div className="grid gap-1.5">
            {holyCandidateCities.length === 0 ? (
              <div className="text-amber-200/85">No completed Temple cities available.</div>
            ) : (
              holyCandidateCities.map((city: City) => {
                const selected = selectedHolyCityIds.includes(city.id);
                const hasCathedral = cityHasCompletedStructure(gameState, player.id, city.id, 'cathedral');
                return (
                  <label
                    key={city.id}
                    className={clsx(
                      'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5',
                      selected ? 'border-sky-300/40 bg-sky-400/10' : 'border-white/10 bg-black/15',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-sky-300"
                        checked={selected}
                        onChange={() => {
                          setSelectedHolyCityIds(current => {
                            if (current.includes(city.id)) return current.filter(id => id !== city.id);
                            if (current.length >= faithVictory.holyCitiesRequired) {
                              return [...current.slice(1), city.id];
                            }
                            return [...current, city.id];
                          });
                        }}
                      />
                      <span>{city.name}</span>
                    </span>
                    {hasCathedral && <span className="text-[10px] uppercase tracking-[0.16em] text-sky-200">Cathedral</span>}
                  </label>
                );
              })
            )}
          </div>

          {faithStartValidation.reasons.length > 0 && (
            <div className="text-amber-200/85">{faithStartValidation.reasons[0]}</div>
          )}

          <button
            type="button"
            data-testid="start-faith-project-button"
            disabled={!faithStartValidation.ok || !selectedHolyCityTuple}
            onClick={() => {
              if (faithStartValidation.ok && faithStartValidation.holyCityIds) {
                onStartFaithProject(faithStartValidation.holyCityIds);
              }
            }}
            className={clsx(
              'w-full rounded-md border px-3 py-2 font-cinzel text-[11px] uppercase tracking-[0.18em] transition-colors',
              faithStartValidation.ok
                ? 'border-sky-300/45 bg-sky-400/20 text-sky-50 hover:bg-sky-400/30'
                : 'cursor-not-allowed border-white/10 bg-white/5 text-white/35',
            )}
          >
            Start Consecration
          </button>
        </div>
      )}
    </div>
  );
}
