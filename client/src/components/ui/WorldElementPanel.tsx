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
import { useSfxEngine } from '../../hooks/useSfx';         // optional SFX hook
import { StaggeredContent, StaggeredContainer } from '../primitives/StaggeredContent';
import { RequirementBanner } from '../primitives/RequirementBanner';
import { getTechDisplayName, getWorldElementActionRequirements, WorldElementRequirement } from '../../utils/worldElementRequirements';
import { TutorialHelpIcon } from './TutorialHelpIcon';

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
  unitId?: string;
  onAction: (a: 'harvest' | 'build', unitId: string) => void; onClose: () => void;
}

export function WorldElementPanel(props: WorldElementPanelProps) {
  const { gameState, playerId, elementId, coordinate, unitId, onAction, onClose } = props;
  const element = getWorldElement(elementId);
  const player = gameState.players.find(p => p.id === playerId);

  useHotkeys('Escape', onClose);
  const playSfx = useSfxEngine();
  
  // Play panel open sound
  React.useEffect(() => {
    if (!element || !player) return;
    playSfx('panel-open');
  }, [element, player, playSfx]);

  const { harvestUnitId, buildUnitId } = useMemo(() => {
    if (!element || !player) {
      return { harvestUnitId: null, buildUnitId: null };
    }

    const unitsOnTile = gameState.units.filter(u =>
      u.playerId === playerId &&
      u.coordinate.q === coordinate.q &&
      u.coordinate.r === coordinate.r &&
      (u.actionsRemaining ?? u.maxActions ?? 1) > 0
    );

    const prefer = (candidateId?: string) => {
      if (!candidateId) return null;
      return unitsOnTile.some(u => u.id === candidateId) ? candidateId : null;
    };

    const preferred = prefer(unitId);

    const pickNavalCommander = () =>
      unitsOnTile.find(u => u.type === 'commander' && (u.abilities || []).some(a => String(a).toUpperCase() === 'NAVAL_COMMAND'))?.id ??
      null;
    const pickNavalTransport = () =>
      unitsOnTile.find(u => u.type === 'boat' || (u.abilities || []).some(a => String(a).toUpperCase() === 'NAVAL_TRANSPORT'))?.id ??
      null;

    const defaultHarvest = () => {
      if (preferred) return preferred;
      if (element?.immediateAction?.requiresUnitTag === 'naval_commander') return pickNavalCommander();
      if (element?.immediateAction?.requiresUnitTag === 'naval_transport') return pickNavalTransport();
      if (elementId === 'jaredite_ruins') return unitsOnTile[0]?.id ?? null;
      return unitsOnTile.find(u => u.type === 'worker')?.id ?? null;
    };

    const defaultBuild = () => {
      const buildTag = element?.longTermBuild?.requiresUnitTag;
      if (preferred) {
        const preferredUnit = unitsOnTile.find(u => u.id === preferred);
        if (!buildTag && preferredUnit?.type === 'worker') return preferred;
        if (buildTag === 'naval_commander' && preferredUnit?.type === 'commander') return preferred;
        if (buildTag === 'naval_transport' && preferredUnit && (preferredUnit.type === 'boat' || (preferredUnit.abilities || []).some(a => String(a).toUpperCase() === 'NAVAL_TRANSPORT'))) {
          return preferred;
        }
      }
      if (buildTag === 'naval_commander') return pickNavalCommander();
      if (buildTag === 'naval_transport') return pickNavalTransport();
      return unitsOnTile.find(u => u.type === 'worker')?.id ?? null;
    };

    return { harvestUnitId: defaultHarvest(), buildUnitId: defaultBuild() };
  }, [coordinate.q, coordinate.r, element, elementId, gameState.units, player, playerId, unitId]);

  const harvest = canExecuteElementAction(gameState, playerId, elementId, 'harvest', coordinate, harvestUnitId ?? undefined);
  const build = canExecuteElementAction(gameState, playerId, elementId, 'build', coordinate, buildUnitId ?? undefined);
  const displayedLongTermAction = useMemo(() => {
    if (!element || !player) return null;
    if (!element.longTermBuild) return null;

    const tile = gameState.map.tiles.find(t =>
      t.coordinate.q === coordinate.q && t.coordinate.r === coordinate.r
    );
    const markerPrefix = `we:${elementId}:`;
    const existingMarker = tile?.resources?.find(r => String(r).startsWith(markerPrefix));
    if (!existingMarker) return element.longTermBuild;

    const base = element.longTermBuild;
    const baseMarker = `${markerPrefix}${base.name}`;
    const upgrade = base.upgrade;
    if (
      upgrade &&
      existingMarker === baseMarker &&
      player.researchedTechs.includes(upgrade.techRequired)
    ) {
      const baseStars = base.effectPermanent?.starsPerTurn || 0;
      const basePop = base.effectPermanent?.popDelta || 0;
      const upgradedStars = upgrade.effectPermanent?.starsPerTurn || 0;
      const upgradedPop = upgrade.effectPermanent?.popDelta || 0;
      const deltaStars = upgradedStars - baseStars;
      const deltaPop = upgradedPop - basePop;

      return {
        ...base,
        name: `Upgrade to ${upgrade.structure}`,
        costStars: upgrade.costStars || 0,
        faithDelta: 0,
        prideDelta: 0,
        dissentDelta: 0,
        effectPermanent: {
          popDelta: deltaPop,
          starsPerTurn: deltaStars
        },
        uiTooltipBuild: `${upgrade.structure}: ${deltaStars > 0 ? `+${deltaStars}★/turn` : ''}${deltaPop > 0 ? `, +${deltaPop} Pop` : ''}`.trim(),
      };
    }

    return {
      ...base,
      name: `${base.name} (Built)`,
      costStars: 0,
      faithDelta: 0,
      prideDelta: 0,
      dissentDelta: 0,
      effectPermanent: { popDelta: 0, starsPerTurn: 0 },
      uiTooltipBuild: 'Already constructed',
    };
  }, [coordinate.q, coordinate.r, element, elementId, gameState.map.tiles, player]);

  const harvestRequirements = useMemo(
    () => getWorldElementActionRequirements(elementId, 'harvest'),
    [elementId]
  );
  const buildRequirements = useMemo(() => {
    const baseRequirements = getWorldElementActionRequirements(elementId, 'build', { includeUpgrade: true });
    const upgrade = element?.longTermBuild?.upgrade;

    if (!upgrade || !displayedLongTermAction) {
      return baseRequirements;
    }

    const isUpgrade = displayedLongTermAction.name === `Upgrade to ${upgrade.structure}`;
    if (!isUpgrade) {
      return baseRequirements;
    }

    const upgradeRequirements = getWorldElementActionRequirements(elementId, 'build', { includeUpgrade: false })
      .filter(req => req.id !== 'tech' && req.id !== 'cost');

    const upgradeTech = getTechDisplayName(upgrade.techRequired);
    if (upgradeTech) {
      upgradeRequirements.push({ id: 'tech', label: `Tech: ${upgradeTech}` });
    }

    if ((upgrade.costStars || 0) > 0) {
      upgradeRequirements.push({ id: 'cost', label: `Cost: ${upgrade.costStars}★` });
    }

    return upgradeRequirements;
  }, [displayedLongTermAction, element?.longTermBuild?.upgrade, elementId]);

  const moralMsg = useMemo(() => {
    if (!element) return '';
    const msgs: string[] = [];
    if (element.immediateAction?.prideDelta) msgs.push('⚔ Immediate exploitation increases Pride and Dissent.');
    if (element.longTermBuild?.faithDelta)   msgs.push('✠ Patient stewardship builds Faith and strengthens your covenant path.');
    return msgs.join(' ');
  }, [element]);

  if (!element || !player) return null;

  return (
    <Transition appear show as={Fragment}>
      <Dialog as="div" className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4"
              data-ui-layer="modal"
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
            data-ui-layer="modal-content"
            className="relative z-[var(--z-modal-content)] w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl
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
                  requirements={harvestRequirements}
                  onClick={() => harvestUnitId && onAction('harvest', harvestUnitId)}
                  theme="red"
                />
              </StaggeredContent>
            )}

            {element.immediateAction && element.longTermBuild && (
              <StaggeredContent>
                <Separator className="my-5 bg-amber-600/30" />
              </StaggeredContent>
            )}

            {/* LONG‑TERM ACTION */}
            {displayedLongTermAction && (
              <StaggeredContent>
                <ActionSection
                  label="Long‑term"
                  badgeColor="secondary"
                  action={displayedLongTermAction}
                  canExecute={build}
                  requirements={buildRequirements}
                  onClick={() => buildUnitId && onAction('build', buildUnitId)}
                  theme="blue"
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
      <div className="flex items-center gap-2">
        <TutorialHelpIcon cardId="world-elements" label="Open world elements tutorial" />
        <Button variant="ghost" size="icon" aria-label="Close panel"
                onClick={onClose}
                className="h-10 w-10 rounded-full bg-amber-600/10 p-0 text-amber-300
                           transition hover:scale-110 hover:bg-amber-600/20 hover:text-amber-100">
          ×
        </Button>
      </div>
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
  requirements: WorldElementRequirement[];
  onClick: () => void; 
  theme: 'red' | 'blue';
}

function ActionSection({ label, badgeColor, action, canExecute, requirements, onClick, theme }: ActionSectionProps) {
  const isImmediate = theme === 'red';
  const playSfx = useSfxEngine();
  
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
  const hasPopulationGain = [
    ...(actionData.immediateDeltas || []),
    ...(actionData.permanentDeltas || [])
  ].some(d => d.type === 'population' && d.value > 0);
  
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

      {requirements.length > 0 && (
        <div className="mb-4">
          <h4 className="mt-4 mb-2 font-semibold text-amber-200 text-sm uppercase tracking-wide">
            📜 Requirements:
          </h4>
          <div className="flex flex-wrap gap-2">
            {requirements.map((req, idx) => (
              <div
                key={`${req.id}-${idx}`}
                className="rounded-lg border border-amber-500/30 bg-stone-900/40 px-3 py-2 text-xs text-amber-100/90"
              >
                <span className="font-semibold">{req.label}</span>
                {req.detail && (
                  <span className="ml-2 text-amber-200/70">{req.detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
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

      {hasPopulationGain && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-900/10 px-3 py-2 text-xs text-amber-200/80">
          Population is added to your nearest owned city and can trigger a level-up.
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
