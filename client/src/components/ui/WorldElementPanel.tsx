// app/components/world/WorldElementPanel.tsx
import React, { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { Button } from './button';
import { Badge } from './badge';
import { Separator } from './separator';
import { HexCoordinate } from '../../../../shared/types/coordinates';
import { getWorldElement } from '../../../../shared/data/worldElements';
import { canExecuteElementAction } from '../../../../shared/logic/worldElementActions';
import { GameState } from '../../../../shared/types/game';

import { TOKENS } from '../../theme/tokens';          // central colour tokens
import { useHotkeys } from '../../hooks/useHotkeys'; // tiny custom hook
import { useSfx } from '../../hooks/useSfx';         // optional SFX hook

/** ───────────────────────────────────────────────────────────────────────────
 *  Resource‑delta pill (memoised to avoid re‑render churn)                  */
interface DeltaProps { value: number; type: DeltaType }
type DeltaType = 'stars' | 'faith' | 'pride' | 'dissent';
const ResourceDeltaBadge = React.memo(({ value, type }: DeltaProps) => {
  if (value === 0) return null;
  const t = TOKENS[type];
  const sign = value > 0 ? '+' : '';
  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm',
        t.bg, t.border, t.glow,
      )}
      title={`${sign}${value} ${t.name}`}
      aria-label={`${value > 0 ? 'Gain' : 'Loss'} of ${Math.abs(value)} ${t.name}`}
    >
      <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center font-bold', t.color, 'bg-black/20', t.border)}>
        {t.icon}
      </span>
      <span className={clsx(t.color, 'font-bold text-sm leading-none')}>{sign}{value}</span>
    </motion.div>
  );
});
ResourceDeltaBadge.displayName = 'ResourceDeltaBadge';

/** ───────────────────────────────────────────────────────────────────────────
 *  Main Panel                                                                */
export interface WorldElementPanelProps {
  gameState: GameState; playerId: string; elementId: string;
  coordinate: HexCoordinate;
  onAction: (a: 'harvest' | 'build') => void; onClose: () => void;
}

export function WorldElementPanel(props: WorldElementPanelProps) {
  const { gameState, playerId, elementId, onAction, onClose } = props;
  const element = getWorldElement(elementId);
  const player = gameState.players.find(p => p.id === playerId);

  useHotkeys('Escape', onClose);
  useSfx('ui/panel-open.mp3'); // plays once on mount; noop if hook returns void

  if (!element || !player) return null;

  const harvest = canExecuteElementAction(gameState, playerId, elementId, 'harvest');
  const build   = canExecuteElementAction(gameState, playerId, elementId, 'build');

  const moralMsg = useMemo(() => {
    const msgs: string[] = [];
    if (element.immediateAction?.prideDelta) msgs.push('⚔ Immediate exploitation increases Pride and Dissent.');
    if (element.longTermBuild?.faithDelta)   msgs.push('✠ Patient stewardship builds Faith and strengthens your covenant path.');
    return msgs.join(' ');
  }, [element]);

  return (
    <Transition appear show as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-50 flex items-center justify-center p-4"
              onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={motion.div}
          initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black backdrop-blur-md"
        />

        {/* Panel */}
        <Transition.Child
          as={motion.div}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1,    opacity: 1 }}
          exit={{   scale: 0.9,   opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl
                     bg-gradient-to-br from-stone-900/95 to-stone-800/90 border border-amber-600/40
                     text-amber-100 shadow-2xl shadow-black/60 p-6"
        >
          {/* Particle sparkle overlay (pure CSS, disabled for reduced‑motion) */}
          <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,white,transparent)]">
            <div className="absolute inset-0 animate-sparkle-slow" />
          </div>

          {/* HEADER */}
          <PanelHeader title={element.displayName}
                       scripture={element.scriptureRef}
                       description={element.description}
                       onClose={onClose} />

          {/* IMMEDIATE ACTION */}
          {element.immediateAction && (
            <ActionSection
              label="Immediate"
              badgeColor="destructive"
              action={element.immediateAction}
              canExecute={harvest}
              onClick={() => onAction('harvest')}
              theme="red"
            />
          )}

          {element.immediateAction && element.longTermBuild && <Separator className="my-5 bg-amber-600/30" />}

          {/* LONG‑TERM ACTION */}
          {element.longTermBuild && (
            <ActionSection
              label="Long‑term"
              badgeColor="secondary"
              action={element.longTermBuild}
              canExecute={build}
              onClick={() => onAction('build')}
              theme="blue"
            />
          )}

          {/* MORAL CONSEQUENCE */}
          <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-800/20 p-4">
            <h4 className="mb-2 flex items-center gap-2 font-semibold text-amber-200 text-sm">
              <span className="inline-block h-5 w-5 rounded-full bg-amber-500/30 text-center">⚖</span>
              Moral Consequence
            </h4>
            <p className="text-amber-100/90 text-xs leading-relaxed">{moralMsg}</p>
          </div>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Sub‑components                                                            */
interface PanelHeaderProps { title: string; scripture: string; description: string; onClose: () => void }
function PanelHeader({ title, scripture, description, onClose }: PanelHeaderProps) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 id="world-element-title" className="font-cinzel text-lg text-amber-200">{title}</h2>
        <p className="text-amber-300/80 text-sm">{scripture}</p>
      </div>
      <Button variant="ghost" size="icon" aria-label="Close panel"
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-amber-600/10 p-0 text-amber-300
                         transition hover:scale-110 hover:bg-amber-600/20 hover:text-amber-100">
        ×
      </Button>
      <p className="sr-only">{description}</p>
    </header>
  );
}

interface ActionSectionProps {
  label: string; badgeColor: 'destructive' | 'secondary';
  action: any; // conforms to immediateAction or longTermBuild shape
  canExecute: { canExecute: boolean; reason?: string };
  onClick: () => void; theme: 'red' | 'blue';
}
function ActionSection({ label, badgeColor, action, canExecute, onClick, theme }: ActionSectionProps) {
  const color = theme === 'red' ? 'red' : 'blue';
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={badgeColor}>{label}</Badge>
        <h3 className="font-semibold text-amber-200">{action.name}</h3>
      </div>

      <div className="rounded-lg border border-stone-700/50 bg-stone-800/50 p-4">
        {/* Tooltip */}
        <p className="mb-3 text-sm text-amber-100/80">{action.uiTooltipHarvest ?? action.uiTooltipBuild}</p>

        {/* Resource Deltas */}
        <div className="mb-4 flex flex-wrap gap-3">
          <ResourceDeltaBadge value={action.starsDelta ?? 0}   type="stars" />
          <ResourceDeltaBadge value={action.faithDelta ?? 0}   type="faith" />
          <ResourceDeltaBadge value={action.prideDelta ?? 0}   type="pride" />
          <ResourceDeltaBadge value={action.dissentDelta ?? 0} type="dissent" />
        </div>

        {/* CTA */}
        <Button
          onClick={onClick}
          disabled={!canExecute.canExecute}
          size="lg"
          className={clsx(
            'w-full font-semibold shadow-lg active:scale-95',
            `bg-${color}-800 hover:bg-${color}-700 border border-${color}-600/30`,
            !canExecute.canExecute && 'cursor-not-allowed opacity-50',
          )}
        >
          {canExecute.canExecute ? action.name : canExecute.reason}
        </Button>
      </div>
    </section>
  );
}