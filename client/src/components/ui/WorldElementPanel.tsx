// app/components/world/WorldElementPanel.tsx
import React, { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { Button } from './button';
import { Badge } from './badge';
import { Separator } from './separator';
import { HexCoordinate } from '@shared/types/coordinates';
import { getWorldElement } from '@shared/data/worldElements';
import { canExecuteElementAction } from '@shared/logic/worldElementActions';
import { GameState } from '@shared/types/game';

import { TOKENS } from '../../theme/tokens';          // central colour tokens
import { useHotkeys } from '../../hooks/useHotkeys'; // tiny custom hook
import { useSfxEngine, type SfxType } from '../../hooks/useSfx';         // optional SFX hook
import { StaggeredContent, StaggeredContainer } from '../primitives/StaggeredContent';
import { RequirementBanner } from '../primitives/RequirementBanner';

/** ───────────────────────────────────────────────────────────────────────────
 *  Resource‑delta pill (memoised to avoid re‑render churn)                  */
interface DeltaProps { 
  value: number; 
  type: DeltaType;
  label?: string; // Custom label override
}
type DeltaType = 'stars' | 'faith' | 'pride' | 'dissent' | 'population' | 'costStars';
const ResourceDeltaBadge = React.memo(({ value, type, label }: DeltaProps) => {
  if (value === 0 && type !== 'costStars') return null;
  const t = TOKENS[type];
  if (!t) return null; // Handle missing token types gracefully
  const isCost = type === 'costStars';
  const sign = !isCost && value > 0 ? '+' : '';
  const displayLabel = label || t.name;
  
  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      className={clsx(
        'inline-flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm',
        t.bg, t.border, t.glow,
      )}
      title={`${isCost ? '' : sign}${value} ${displayLabel}`}
      aria-label={`${isCost ? 'Cost of' : value > 0 ? 'Gain' : 'Loss'} ${Math.abs(value)} ${displayLabel}`}
    >
      <span className={clsx('w-6 h-6 rounded-full flex items-center justify-center font-bold', t.color, 'bg-black/20', t.border)}>
        {t.icon}
      </span>
      <span className={clsx(t.color, 'font-bold text-sm leading-none')}>{sign}{value}</span>
      {label && <span className={clsx(t.color, 'text-xs opacity-80')}>{label}</span>}
    </motion.div>
  );
});
ResourceDeltaBadge.displayName = 'ResourceDeltaBadge';

// Export the ResourceDeltaBadge for use in other components
export { ResourceDeltaBadge };

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
  const playSfx = useSfxEngine();
  
  // Play panel open sound
  React.useEffect(() => {
    playSfx('panel-open');
  }, [playSfx]);

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
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl
                       bg-gradient-to-br from-stone-900/95 to-stone-800/90 border border-amber-600/40
                       text-amber-100 shadow-2xl shadow-black/60 p-6"
          >
          {/* Particle sparkle overlay (pure CSS, disabled for reduced‑motion) */}
          <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,white,transparent)]">
            <div className="absolute inset-0 animate-sparkle-slow" />
          </div>

          <StaggeredContainer>
            {/* HEADER */}
            <StaggeredContent>
              <PanelHeader title={element.displayName}
                           scripture={element.scriptureRef}
                           description={element.description}
                           onClose={onClose} />
            </StaggeredContent>

            {/* IMMEDIATE ACTION */}
            {element.immediateAction && (
              <StaggeredContent>
                <ActionSection
                  label="Immediate"
                  badgeColor="destructive"
                  action={element.immediateAction}
                  canExecute={harvest}
                  onClick={() => onAction('harvest')}
                  theme="red"
                  playSfx={playSfx}
                />
              </StaggeredContent>
            )}

            {element.immediateAction && element.longTermBuild && (
              <StaggeredContent>
                <Separator className="my-5 bg-amber-600/30" />
              </StaggeredContent>
            )}

            {/* LONG‑TERM ACTION */}
            {element.longTermBuild && (
              <StaggeredContent>
                <ActionSection
                  label="Long‑term"
                  badgeColor="secondary"
                  action={element.longTermBuild}
                  canExecute={build}
                  onClick={() => onAction('build')}
                  theme="blue"
                  playSfx={playSfx}
                />
              </StaggeredContent>
            )}

            {/* MORAL CONSEQUENCE - Enhanced formatting with icons as bullet points */}
            <StaggeredContent>
              <div className="mt-6 rounded-lg border border-amber-500/40 bg-amber-800/20 p-4">
                <h3 className="mb-3 font-cinzel text-sm font-semibold text-amber-200">
                  Moral Consequences
                </h3>
                <div className="space-y-2 text-sm text-amber-100/90">
                  {element.immediateAction?.prideDelta && (
                    <div className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">⚔</span>
                      <span>Immediate exploitation increases Pride and Dissent.</span>
                    </div>
                  )}
                  {element.longTermBuild?.faithDelta && (
                    <div className="flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">✠</span>
                      <span>Patient stewardship builds Faith and strengthens your covenant path.</span>
                    </div>
                  )}
                  {(!element.immediateAction?.prideDelta && !element.longTermBuild?.faithDelta) && (
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400 mt-0.5">⚖</span>
                      <span>Your choices shape the moral compass of your civilization.</span>
                    </div>
                  )}
                </div>
              </div>
            </StaggeredContent>
          </StaggeredContainer>
          </motion.div>
        </Transition.Child>
      </Dialog>
    </Transition>
  );
}

/** ───────────────────────────────────────────────────────────────────────────
 *  Sub‑components                                                            */
interface PanelHeaderProps { title: string; scripture: string; description?: string; onClose: () => void }
function PanelHeader({ title, scripture, description, onClose }: PanelHeaderProps) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="flex-1">
        <h2 id="world-element-title" className="font-cinzel text-lg text-amber-200">{title}</h2>
        <p className="text-amber-300/80 text-sm">{scripture}</p>
        {description && <p className="mt-2 text-amber-300/80 text-sm">{description}</p>}
      </div>
      <Button variant="ghost" size="icon" aria-label="Close panel"
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-amber-600/10 p-0 text-amber-300
                         transition hover:scale-110 hover:bg-amber-600/20 hover:text-amber-100">
        ×
      </Button>
    </header>
  );
}

// Define ActionData interface for structured data
interface ActionData {
  name: string;
  summary?: string; // "Free +1 Pop now (Pride +1, Dissent +1)"
  starCost?: number;
  immediateDeltas?: Array<{ value: number; type: DeltaType }>;
  permanentDeltas?: Array<{ value: number; type: DeltaType }>;
  techRequired?: string;
}

interface ActionSectionProps {
  label: string; 
  badgeColor: 'destructive' | 'secondary';
  action: any; // Will be transformed to ActionData
  canExecute: { canExecute: boolean; reason?: string };
  onClick: () => void; 
  theme: 'red' | 'blue';
  playSfx: (type: SfxType) => void;
}

function ActionSection({ label, badgeColor, action, canExecute, onClick, theme, playSfx }: ActionSectionProps) {
  const isImmediate = theme === 'red';
  
  // Transform legacy action data to structured format
  const actionData: ActionData = {
    name: action.name,
    summary: action.uiTooltipHarvest ?? action.uiTooltipBuild,
    starCost: action.costStars,
    immediateDeltas: [
      ...(action.starsDelta ? [{ value: action.starsDelta, type: 'stars' as DeltaType }] : []),
      ...(action.popDelta ? [{ value: action.popDelta, type: 'population' as DeltaType }] : []),
      ...(action.faithDelta ? [{ value: action.faithDelta, type: 'faith' as DeltaType }] : []),
      ...(action.prideDelta ? [{ value: action.prideDelta, type: 'pride' as DeltaType }] : []),
      ...(action.dissentDelta ? [{ value: action.dissentDelta, type: 'dissent' as DeltaType }] : []),
    ].filter(d => d.value !== 0),
    permanentDeltas: action.effectPermanent ? [
      ...(action.effectPermanent.popDelta ? [{ value: action.effectPermanent.popDelta, type: 'population' as DeltaType }] : []),
      ...(action.effectPermanent.starsPerTurn ? [{ value: action.effectPermanent.starsPerTurn, type: 'stars' as DeltaType }] : []),
      // Add construction faith bonus to permanent effects for long-term builds
      ...(action.faithDelta && !isImmediate ? [{ value: action.faithDelta, type: 'faith' as DeltaType }] : []),
    ].filter(d => d.value !== 0) : undefined,
  };
  
  return (
    <section className="space-y-4">
      {/* Header with Badge and Action Name */}
      <div className="flex items-center gap-3">
        <Badge 
          variant={badgeColor}
          className={`px-3 py-1 font-semibold ${
            isImmediate ? 'bg-red-900/60 text-red-200 border border-red-600/50' : 
            'bg-blue-900/60 text-blue-200 border border-blue-600/50'
          }`}
        >
          {isImmediate ? '⚡' : '🏗'} {label}
        </Badge>
        <h3 className="font-cinzel text-lg font-bold text-amber-200 tracking-wide uppercase">
          {actionData.name}
        </h3>
      </div>

      {/* Action summary line */}
      {actionData.summary && (
        <p className="mb-3 text-sm text-amber-100/90 p-3 bg-stone-900/40 rounded-lg border border-amber-600/20">
          {actionData.summary}
        </p>
      )}

      {/* Construction cost */}
      {actionData.starCost && (
        <div className="mb-4">
          <ResourceDeltaBadge 
            value={actionData.starCost} 
            type="costStars" 
            label="Construction Cost" 
          />
        </div>
      )}

      {/* Immediate effects */}
      {actionData.immediateDeltas && actionData.immediateDeltas.length > 0 && (
        <div className="mb-4">
          <h4 className="mt-5 mb-2 font-semibold text-amber-200 text-sm uppercase tracking-wide">
            ❄ Immediate Effects:
          </h4>
          <div className="flex flex-wrap gap-3">
            {actionData.immediateDeltas.map((d, idx) => (
              <ResourceDeltaBadge key={`${d.type}-${idx}`} value={d.value} type={d.type} />
            ))}
          </div>
        </div>
      )}

      {/* Permanent benefits */}
      {actionData.permanentDeltas && actionData.permanentDeltas.length > 0 && (
        <div className="mb-4">
          <h4 className="mt-5 mb-2 font-semibold text-amber-200 text-sm uppercase tracking-wide">
            🏛 Permanent Benefits:
          </h4>
          <div className="flex flex-wrap gap-3">
            {actionData.permanentDeltas.map((d, idx) => (
              <ResourceDeltaBadge key={`${d.type}-${idx}`} value={d.value} type={d.type} />
            ))}
          </div>
        </div>
      )}

      {/* Requirement banner for unavailable actions */}
      {!canExecute.canExecute && (
        <RequirementBanner
          type="insufficient-stars"
          message={canExecute.reason || 'Action not available'}
        />
      )}

      {/* Action Button with enhanced AAA quality */}
      <motion.div
        whileHover={canExecute.canExecute ? { scale: 1.02 } : {}}
        whileTap={canExecute.canExecute ? { scale: 0.98 } : {}}
      >
        <Button
          onClick={() => {
            if (canExecute.canExecute) {
              playSfx('cta-click');
              onClick();
            }
          }}
          disabled={!canExecute.canExecute}
          size="lg"
          className={clsx(
            'w-full font-semibold shadow-xl transition-all duration-200 min-h-[48px] touch-manipulation',
            isImmediate 
              ? 'bg-gradient-to-r from-red-800 to-red-700 md:hover:from-red-700 md:hover:to-red-600 border border-red-600/50 shadow-red-500/25'
              : 'bg-gradient-to-r from-blue-800 to-blue-700 md:hover:from-blue-700 md:hover:to-blue-600 border border-blue-600/50 shadow-blue-500/25',
            !canExecute.canExecute && 'cursor-not-allowed opacity-50 grayscale'
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <motion.span 
              className="text-lg"
              animate={canExecute.canExecute ? { rotate: [0, 5, -5, 0] } : {}}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              {isImmediate ? '⚡' : '🏗'}
            </motion.span>
            <span>{actionData.name}</span>
          </div>
        </Button>
      </motion.div>
    </section>
  );
}