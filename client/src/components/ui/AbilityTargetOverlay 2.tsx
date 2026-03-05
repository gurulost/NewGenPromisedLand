import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Shield, Sparkles, X } from 'lucide-react';
import type { Unit } from '@shared/types/unit';
import type { AbilityDefinition } from '@shared/data/abilities';

interface AbilityTargetOverlayProps {
  isOpen: boolean;
  title: string;
  instructions: string;
  units: Unit[];
  selectedUnitId?: string | null;
  abilityDefinition?: AbilityDefinition;
  abilityMeta?: {
    cooldown?: number;
    cooldownRemaining?: number;
    cost?: number;
    requirements?: {
      faith?: number;
      pride?: number;
      dissent?: number;
    };
    target?: string;
    isToggle?: boolean;
  };
  onSelectUnit: (unitId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AbilityTargetOverlay({
  isOpen,
  title,
  instructions,
  units,
  selectedUnitId,
  abilityDefinition,
  abilityMeta,
  onSelectUnit,
  onConfirm,
  onCancel,
}: AbilityTargetOverlayProps) {
  const selectedUnit = selectedUnitId
    ? units.find((unit) => unit.id === selectedUnitId) ?? null
    : null;

  const requirementEntries = abilityMeta?.requirements
    ? Object.entries(abilityMeta.requirements).filter(([, value]) => typeof value === 'number')
    : [];

  const formatRequirement = (label: string) =>
    label.charAt(0).toUpperCase() + label.slice(1);

  const formatAbilityTarget = (target?: string) => {
    switch (target) {
      case 'ally':
        return 'Allies';
      case 'enemy':
        return 'Enemies';
      case 'tile':
        return 'Tile';
      case 'area':
        return 'Area';
      case 'global':
        return 'World';
      default:
        return 'Self';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-end md:items-center justify-center pointer-events-auto bg-black/50 backdrop-blur-sm"
          data-ui-layer="modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onCancel();
            }
          }}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            data-ui-layer="modal-content"
            className="z-[var(--z-modal-content)] w-full max-w-xl bg-slate-900/95 border border-amber-500/30 rounded-t-3xl md:rounded-2xl shadow-2xl shadow-amber-500/20 overflow-hidden"
            style={{ touchAction: 'manipulation' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between px-6 pt-5 pb-3 bg-gradient-to-r from-amber-900/40 to-purple-900/30">
              <div>
                <div className="flex items-center gap-2 text-amber-200 font-cinzel text-lg">
                  <Shield className="w-5 h-5 text-amber-300" />
                  {title}
                </div>
                <p className="text-sm text-amber-100/70 mt-1 max-w-md">
                  {instructions}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cancel targeting"
                className="p-2 text-amber-200/80 hover:text-white transition-colors"
                onClick={onCancel}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {abilityDefinition && (
                <div className="bg-slate-800/60 border border-amber-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-amber-100 font-semibold font-cinzel">
                      {abilityDefinition.name}
                    </div>
                    {abilityMeta?.cooldownRemaining && abilityMeta.cooldownRemaining > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-200/80 px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10">
                        Cooldown • {abilityMeta.cooldownRemaining} turn{abilityMeta.cooldownRemaining > 1 ? 's' : ''}
                      </span>
                    ) : abilityMeta?.cooldown ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-200 px-2 py-1 rounded-full border border-emerald-400/30 bg-emerald-500/10">
                        Ready • {abilityMeta.cooldown}-turn
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-200 px-2 py-1 rounded-full border border-emerald-400/30 bg-emerald-500/10">
                        Ready
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-100/70 leading-relaxed">
                    {abilityDefinition.description}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wide">
                    {typeof abilityMeta?.cost === 'number' && abilityMeta.cost > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200">
                        Cost {abilityMeta.cost}
                      </span>
                    )}
                    {abilityMeta?.target && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-200">
                        Target: {formatAbilityTarget(abilityMeta.target)}
                      </span>
                    )}
                    {abilityMeta?.isToggle && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-200">
                        Toggle
                      </span>
                    )}
                    {requirementEntries.map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200"
                      >
                        {formatRequirement(key)} ≥ {value}
                      </span>
                    ))}
                  </div>
                  {selectedUnit && (
                    <div className="text-xs text-emerald-200/80 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                      Targeting <span className="font-semibold text-emerald-200">{selectedUnit.type.replace(/_/g, ' ')}</span> at ({selectedUnit.coordinate.q}, {selectedUnit.coordinate.r})
                    </div>
                  )}
                </div>
              )}

              <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Tap a highlighted unit on the map or choose one below.</span>
              </div>

              <div className="max-h-[45vh] overflow-y-auto pr-1 space-y-3">
                {units.map((unit) => (
                  <button
                    key={unit.id}
                    type="button"
                    className={`w-full text-left rounded-2xl px-4 py-3 flex items-center justify-between gap-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                      selectedUnitId === unit.id
                        ? 'bg-amber-900/30 border border-amber-400/70 text-amber-100 shadow-inner shadow-amber-500/30'
                        : 'bg-slate-800/80 border border-amber-500/30 hover:border-amber-400 text-slate-100'
                    }`}
                    onClick={() => onSelectUnit(unit.id)}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-amber-100 font-semibold text-base font-cinzel">
                        {unit.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-300">
                        HP {unit.hp}/{unit.maxHp} · Movement {unit.remainingMovement}/{unit.movement}
                      </span>
                      <span className="text-xs text-slate-400">
                        Coordinates ({unit.coordinate.q}, {unit.coordinate.r})
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm text-amber-200 uppercase tracking-wide">
                        Select
                      </span>
                      <div className="text-xs text-slate-400">
                        #{unit.id.slice(-4)}
                      </div>
                    </div>
                  </button>
                ))}

                {units.length === 0 && (
                  <div className="text-center text-slate-300 py-6">
                    No eligible units available.
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`w-full rounded-xl py-3 font-semibold transition-colors ${
                  selectedUnitId
                    ? 'bg-gradient-to-r from-emerald-500/80 to-emerald-600/80 border border-emerald-400/40 text-emerald-50 hover:from-emerald-500 hover:to-emerald-600'
                    : 'bg-slate-800/70 border border-slate-600 text-slate-400 cursor-not-allowed'
                }`}
                onClick={onConfirm}
                disabled={!selectedUnitId}
              >
                {selectedUnitId ? 'Confirm Target' : 'Select a Unit'}
              </button>

              <button
                type="button"
                className="w-full bg-slate-800/60 border border-slate-600 text-slate-200 rounded-xl py-3 font-medium hover:bg-slate-700/70 transition-colors"
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
