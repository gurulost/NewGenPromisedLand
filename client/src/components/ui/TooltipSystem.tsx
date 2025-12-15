import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { getWorldElement } from '@shared/data/worldElements';
import { GAME_RULES } from '@shared/data/gameRules';
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from '@shared/types/city';

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

interface TooltipPosition {
  x: number;
  y: number;
  placement: TooltipPlacement;
}

interface BaseTooltipProps {
  content: React.ReactNode;
  placement?: TooltipPlacement;
  disabled?: boolean;
  className?: string;
}

interface LegacyTooltipProps extends BaseTooltipProps {
  children: React.ReactElement;
  delay?: number;
}

interface InfoTooltipProps extends BaseTooltipProps {}

interface ActionTooltipProps {
  cost?: number | string;
  requirements?: string[];
  effects?: string[];
  title?: string;
  description?: string;
  hotkey?: string;
  placement?: TooltipPlacement;
  disabled?: boolean;
}

// Enhanced InfoTooltip component with premium visual design and modal awareness
export function InfoTooltip({ content, placement = 'top', disabled = false, className = '' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0, placement });
  const [isHovered, setIsHovered] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Check if any modals are open that should hide tooltips and info icons
  const shouldHideForModals = () => {
    // Check for any fixed positioned modals with high z-index
    const modalSelectors = [
      '[class*="fixed"][class*="z-50"]',
      '[class*="fixed"][class*="z-[50]"]', 
      '[class*="fixed"][class*="z-100"]',
      '[class*="fixed"][class*="z-[100]"]',
      '.fixed.z-50',
      '.fixed.z-100'
    ];
    
    for (const selector of modalSelectors) {
      const modals = document.querySelectorAll(selector);
      if (modals.length > 0) {
        return true;
      }
    }
    
    return false;
  };

  const showTooltip = (event: React.MouseEvent) => {
    if (disabled || shouldHideForModals()) return;
    
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const tooltipPosition = calculatePosition(rect, placement);
    setPosition(tooltipPosition);
    setIsVisible(true);
  };

  const hideTooltip = () => {
    setIsVisible(false);
  };

  // Hide tooltip and force re-render when modals open/close
  const [shouldHide, setShouldHide] = useState(false);
  
  useEffect(() => {
    const checkModalState = () => {
      const hideState = shouldHideForModals();
      setShouldHide(hideState);
      if (hideState && isVisible) {
        hideTooltip();
      }
    };

    // Initial check
    checkModalState();

    const observer = new MutationObserver(checkModalState);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        hideTooltip();
      }
    };

    if (isVisible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isVisible]);

  // Enhanced tooltip with premium styling - should hide behind modals
  const tooltipElement = isVisible && !shouldHideForModals() && (
    <div
      className="fixed z-[45] pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: getTransform(position.placement)
      }}
    >
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 text-white text-sm px-4 py-3 rounded-xl border border-slate-500/50 shadow-2xl max-w-sm backdrop-blur-md bg-opacity-95 animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="relative">
          {content}
          <div
            className={`absolute w-3 h-3 bg-gradient-to-br from-slate-800 to-slate-700 border-l border-t border-slate-500/50 transform rotate-45 ${getArrowClasses(position.placement)}`}
          />
        </div>
      </div>
    </div>
  );

  // Premium info icon with enhanced visual design
  const iconButton = (
    <button
      ref={buttonRef}
      type="button"
      className={`
        group relative inline-flex items-center justify-center 
        w-8 h-8 min-w-[32px] min-h-[32px]
        rounded-full 
        bg-gradient-to-br from-blue-500/90 via-blue-600/90 to-blue-700/90
        border-2 border-blue-400/60
        text-white
        shadow-lg shadow-blue-500/25
        transition-all duration-300 ease-out
        transform-gpu
        md:hover:scale-110 md:hover:rotate-12
        md:hover:shadow-xl md:hover:shadow-blue-400/40
        md:hover:from-blue-400 md:hover:via-blue-500 md:hover:to-blue-600
        md:hover:border-blue-300/80
        active:scale-95
        backdrop-blur-sm
        touch-manipulation
        ${isHovered ? 'ring-4 ring-blue-400/30' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onClick={showTooltip}
      onMouseEnter={(e) => {
        setIsHovered(true);
        showTooltip(e);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        hideTooltip();
      }}
      disabled={disabled}
      aria-label="More information"
    >
      {/* Subtle glow effect - no animation */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/30 to-blue-600/30" />
      
      {/* Info icon with enhanced styling */}
      <Info className="relative z-10 w-4 h-4 drop-shadow-sm transition-transform duration-300 group-hover:scale-110" />
      
      {/* Subtle inner glow */}
      <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
    </button>
  );

  // Don't render if disabled or modals are open
  if (disabled || shouldHide || shouldHideForModals()) {
    return null;
  }

  return (
    <>
      {iconButton}
      {tooltipElement && createPortal(tooltipElement, document.body)}
    </>
  );
}

// Legacy wrapper tooltip - only triggers on hover, doesn't block clicks
export function Tooltip({ 
  content, 
  children, 
  delay = 500, 
  placement = 'top',
  disabled = false 
}: LegacyTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0, placement });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const elementRef = useRef<HTMLElement>();

  const showTooltip = (event: MouseEvent) => {
    if (disabled) return;
    
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const tooltipPosition = calculatePosition(rect, placement);
    setPosition(tooltipPosition);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('mouseenter', showTooltip);
    element.addEventListener('mouseleave', hideTooltip);

    return () => {
      element.removeEventListener('mouseenter', showTooltip);
      element.removeEventListener('mouseleave', hideTooltip);
    };
  }, [disabled]);

  const clonedChild = React.cloneElement(children, {
    ref: (el: HTMLElement) => {
      elementRef.current = el;
      const originalRef = (children as any).ref;
      if (originalRef) {
        if (typeof originalRef === 'function') {
          originalRef(el);
        } else {
          originalRef.current = el;
        }
      }
    }
  });

  const tooltipElement = isVisible && (
    <div
      className="fixed z-[60] pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: getTransform(position.placement)
      }}
    >
      <div className="bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 shadow-xl max-w-xs backdrop-blur-sm bg-opacity-95">
        <div className="relative">
          {content}
          <div
            className={`absolute w-2 h-2 bg-slate-800 border-slate-600 transform rotate-45 ${getArrowClasses(position.placement)}`}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {clonedChild}
      {tooltipElement && createPortal(tooltipElement, document.body)}
    </>
  );
}

function calculatePosition(rect: DOMRect, preferredPlacement: string): TooltipPosition {
  const tooltipOffset = 8;
  const viewportPadding = 16;
  
  let x = 0;
  let y = 0;
  let finalPlacement = preferredPlacement;

  switch (preferredPlacement) {
    case 'top':
      x = rect.left + rect.width / 2;
      y = rect.top - tooltipOffset;
      if (y < viewportPadding) {
        finalPlacement = 'bottom';
        y = rect.bottom + tooltipOffset;
      }
      break;
    case 'bottom':
      x = rect.left + rect.width / 2;
      y = rect.bottom + tooltipOffset;
      if (y > window.innerHeight - viewportPadding) {
        finalPlacement = 'top';
        y = rect.top - tooltipOffset;
      }
      break;
    case 'left':
      x = rect.left - tooltipOffset;
      y = rect.top + rect.height / 2;
      if (x < viewportPadding) {
        finalPlacement = 'right';
        x = rect.right + tooltipOffset;
      }
      break;
    case 'right':
      x = rect.right + tooltipOffset;
      y = rect.top + rect.height / 2;
      if (x > window.innerWidth - viewportPadding) {
        finalPlacement = 'left';
        x = rect.left - tooltipOffset;
      }
      break;
  }

  return { x, y, placement: finalPlacement as TooltipPlacement };
}

function getTransform(placement: string): string {
  switch (placement) {
    case 'top': return 'translate(-50%, -100%)';
    case 'bottom': return 'translate(-50%, 0%)';
    case 'left': return 'translate(-100%, -50%)';
    case 'right': return 'translate(0%, -50%)';
    default: return 'translate(-50%, -100%)';
  }
}

function getArrowClasses(placement: string): string {
  switch (placement) {
    case 'top': return 'top-full left-1/2 -translate-x-1/2 border-t border-l';
    case 'bottom': return 'bottom-full left-1/2 -translate-x-1/2 border-b border-r';
    case 'left': return 'left-full top-1/2 -translate-y-1/2 border-t border-l';
    case 'right': return 'right-full top-1/2 -translate-y-1/2 border-b border-r';
    default: return 'top-full left-1/2 -translate-x-1/2 border-t border-l';
  }
}

// ActionTooltip component - Shows contextual information about actions
export function ActionTooltip({
  title,
  description,
  hotkey,
  cost,
  requirements = [],
  effects = [],
  placement = 'top',
  disabled = false,
}: ActionTooltipProps) {
  const formattedCost = (() => {
    if (cost === undefined) return undefined;
    if (typeof cost === 'number') return `${cost} Stars`;
    return cost;
  })();

  const tooltipContent = (
    <div className="space-y-2">
      {(title || description || hotkey) && (
        <div className="space-y-1">
          {title && <div className="font-semibold text-amber-200">{title}</div>}
          {description && <div className="text-xs text-slate-200/90">{description}</div>}
          {hotkey && (
            <div className="text-xs text-slate-300">
              Hotkey: <span className="font-mono text-slate-100">{hotkey}</span>
            </div>
          )}
        </div>
      )}

      {formattedCost !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-yellow-400">⭐</span>
          <span className="text-yellow-400 font-semibold">{formattedCost}</span>
        </div>
      )}
      
      {requirements.length > 0 && (
        <div>
          <div className="text-red-400 font-semibold mb-1">Requirements:</div>
          <ul className="text-xs space-y-1">
            {requirements.map((req, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-red-400 mt-0.5">•</span>
                <span className="text-red-300">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {effects.length > 0 && (
        <div>
          <div className="text-green-400 font-semibold mb-1">Effects:</div>
          <ul className="text-xs space-y-1">
            {effects.map((effect, index) => (
              <li key={index} className="flex items-start gap-1">
                <span className="text-green-400 mt-0.5">•</span>
                <span className="text-green-300">{effect}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return <InfoTooltip content={tooltipContent} placement={placement} disabled={disabled} />;
}

// Legacy specialized tooltip content components
export function UnitTooltip({ unit, unitDef }: { unit: any; unitDef: any }) {
  const passive = unitDef?.passiveEffects;
  const perTurnParts: string[] = [];
  if (passive?.perTurn?.stars) perTurnParts.push(`${passive.perTurn.stars > 0 ? '+' : ''}${passive.perTurn.stars}★/turn`);
  if (passive?.perTurn?.faith) perTurnParts.push(`${passive.perTurn.faith > 0 ? '+' : ''}${passive.perTurn.faith} Faith/turn`);
  if (passive?.perTurn?.pride) perTurnParts.push(`${passive.perTurn.pride > 0 ? '+' : ''}${passive.perTurn.pride} Pride/turn`);
  if (passive?.perTurn?.dissent) perTurnParts.push(`${passive.perTurn.dissent > 0 ? '+' : ''}${passive.perTurn.dissent} Dissent/turn`);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="font-semibold text-purple-300">{unitDef.name}</div>
        <div className="text-xs text-slate-400">Level {unit.level || 1}</div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-red-300">❤️ {unit.hp}/{unit.maxHp}</div>
          <div className="text-orange-300">⚔️ {unit.attack}</div>
          <div className="text-blue-300">🛡️ {unit.defense}</div>
        </div>
        <div>
          <div className="text-green-300">👁️ {unit.visionRadius}</div>
          <div className="text-yellow-300">🏃 {unit.remainingMovement}/{unit.movement}</div>
          <div className="text-purple-300">🎯 {unit.attackRange}</div>
        </div>
      </div>

      {unitDef.abilities?.length > 0 && (
        <div className="border-t border-slate-600 pt-2">
          <div className="text-xs text-slate-300 mb-1">Abilities:</div>
          <div className="text-xs text-blue-300">
            {unitDef.abilities.join(', ')}
          </div>
        </div>
      )}

      {(perTurnParts.length > 0 || passive?.perTurnWhen?.length || passive?.diplomacyCooldownDelta) && (
        <div className="border-t border-slate-600 pt-2">
          <div className="text-xs text-slate-300 mb-1">Per Turn:</div>
          {perTurnParts.length > 0 && (
            <div className="text-xs text-green-300">{perTurnParts.join(', ')}</div>
          )}
          {(passive?.perTurnWhen || []).map((cond: any, idx: number) => {
            const statLabel = cond.stat === 'internalDissent' ? 'Dissent' : String(cond.stat).charAt(0).toUpperCase() + String(cond.stat).slice(1);
            const condition =
              typeof cond.gte === 'number'
                ? `${statLabel} ≥ ${cond.gte}`
                : typeof cond.lte === 'number'
                  ? `${statLabel} ≤ ${cond.lte}`
                  : statLabel;
            const parts: string[] = [];
            if (cond.perTurn?.stars) parts.push(`${cond.perTurn.stars > 0 ? '+' : ''}${cond.perTurn.stars}★/turn`);
            if (cond.perTurn?.faith) parts.push(`${cond.perTurn.faith > 0 ? '+' : ''}${cond.perTurn.faith} Faith/turn`);
            if (cond.perTurn?.pride) parts.push(`${cond.perTurn.pride > 0 ? '+' : ''}${cond.perTurn.pride} Pride/turn`);
            if (cond.perTurn?.dissent) parts.push(`${cond.perTurn.dissent > 0 ? '+' : ''}${cond.perTurn.dissent} Dissent/turn`);
            if (parts.length === 0) return null;
            return (
              <div key={idx} className="text-xs text-green-300">
                When {condition}: {parts.join(', ')}
              </div>
            );
          })}
          {(() => {
            const cooldownDeltaPerTurn = passive?.diplomacyCooldownDelta?.perTurn;
            if (!cooldownDeltaPerTurn) return null;

            const entries = Object.entries(cooldownDeltaPerTurn).filter(
              (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] !== 0
            );
            if (entries.length === 0) return null;

            const formatCooldownName = (cooldownKey: string) =>
              cooldownKey
                .replace(/_/g, ' ')
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/^./, (c) => c.toUpperCase());

            return (
              <div className="text-xs text-green-300 space-y-0.5">
                {entries.map(([cooldownKey, delta]) => (
                  <div key={cooldownKey}>
                    {formatCooldownName(cooldownKey)} cooldown: {delta > 0 ? '+' : ''}{delta}/turn
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export function StarProductionTooltip({ totalIncome, breakdown }: { totalIncome: number; breakdown: Array<{source: string, amount: number}> }) {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-yellow-300">Star Income: {totalIncome}/turn</div>
      <div className="text-xs space-y-1">
        {breakdown.map((item, index) => (
          <div key={index}>
            {item.source}: +{item.amount}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FaithSystemTooltip() {
  const shrineFaith = IMPROVEMENT_DEFINITIONS.shrine.effects?.faithProduction ?? 0;
  const templeFaith = STRUCTURE_DEFINITIONS.temple.effects.faithProduction ?? 0;
  const cathedralFaith = STRUCTURE_DEFINITIONS.cathedral.effects.faithProduction ?? 0;
  const missionaryFaith = GAME_RULES.resources.faithPerMissionary;
  const maxMissionaryFaithBonus = GAME_RULES.resources.maxMissionaryFaithBonus;
  const { lowThreshold, highThreshold, lowDefenseBonus, highAttackBonus, highDefenseBonus } = GAME_RULES.faithBonuses;
  const testimonyPressure = GAME_RULES.influence.testimonyPressure;

  return (
    <div className="space-y-2">
      <div className="font-semibold text-blue-300">Faith System</div>
      <div className="text-xs text-slate-300">
        Faith represents your people's spiritual devotion and empowers conversion, blessings, and defensive strength.
      </div>
      <div className="text-xs">
        <div className="text-green-300 mb-1">How To Gain Faith:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li>Cities: +{GAME_RULES.resources.faithPerCity}/turn per city</li>
          <li>Shrines: +{shrineFaith}/turn</li>
          <li>Temples: +{templeFaith}/turn</li>
          <li>Cathedrals: +{cathedralFaith}/turn</li>
          <li>Missionaries: +{missionaryFaith}/turn each (max +{maxMissionaryFaithBonus})</li>
        </ul>
      </div>
      <div className="text-xs">
        <div className="text-blue-300 mb-1">Combat Bonuses:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li>{lowThreshold}+ Faith: Defender +{lowDefenseBonus} defense</li>
          <li>{highThreshold}+ Faith: Attacker +{highAttackBonus} attack, Defender +{highDefenseBonus} defense</li>
        </ul>
      </div>
      <div className="text-xs">
        <div className="text-blue-300 mb-1">Missionaries (Nephites / Anti-Nephi-Lehies):</div>
        <div className="text-slate-300">
          Enemy military units adjacent to missionaries suffer -{testimonyPressure.attackPenalty} Attack for {testimonyPressure.durationTurns} turn(s), and lose temporary rally/command buffs.
        </div>
      </div>
    </div>
  );
}

export function PrideSystemTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-red-300">Pride System</div>
      <div className="text-xs text-slate-300">
        Pride reflects worldly ambition and the “pride cycle” (riches → pride → contention → loss). In this game, Pride increases the chance of costly moral events.
      </div>
      <div className="text-xs">
        <div className="text-red-300 mb-1">Risks:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li>Raises the likelihood of Contention (star loss)</li>
          <li>Can trigger Rebellions (city unrest)</li>
          <li>At high Dissent, can trigger Desertion (lose a unit)</li>
        </ul>
      </div>
    </div>
  );
}

export function DissentSystemTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-purple-300">Dissent System</div>
      <div className="text-xs text-slate-300">
        Dissent measures internal conflict and civil unrest. Higher Dissent increases the chance of rebellion and desertion events.
      </div>
      <div className="text-xs">
        <div className="text-purple-300 mb-1">Effects:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li>Rebellions cause temporary city unrest (reduced star income)</li>
          <li>At high levels, desertion can remove a unit</li>
          <li>Low Pride + low Dissent can trigger Blessings (gain stars)</li>
        </ul>
      </div>
    </div>
  );
}

function formatSigned(value: number, suffix: string): string {
  if (!value) return '';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
}

function formatWorldElementDeltas(deltas: {
  starsDelta?: number;
  popDelta?: number;
  faithDelta?: number;
  prideDelta?: number;
  dissentDelta?: number;
}): string {
  const parts: string[] = [];
  if (deltas.starsDelta) parts.push(formatSigned(deltas.starsDelta, '★'));
  if (deltas.popDelta) parts.push(formatSigned(deltas.popDelta, ' Pop'));
  if (deltas.faithDelta) parts.push(formatSigned(deltas.faithDelta, ' Faith'));
  if (deltas.prideDelta) parts.push(formatSigned(deltas.prideDelta, ' Pride'));
  if (deltas.dissentDelta) parts.push(formatSigned(deltas.dissentDelta, ' Dissent'));
  return parts.join(', ');
}

export function WorldElementTooltip({ elementId }: { elementId: string }) {
  const element = getWorldElement(elementId);
  if (!element) {
    return (
      <div className="space-y-2">
        <div className="font-semibold text-slate-200">Unknown Resource</div>
        <div className="text-xs text-slate-300">No tooltip data found for: {elementId}</div>
      </div>
    );
  }

  const immediate = element.immediateAction;
  const build = element.longTermBuild;

  return (
    <div className="space-y-2">
      <div className="font-semibold text-amber-200">{element.displayName}</div>
      <div className="text-xs text-slate-300">{element.description}</div>
      {element.scriptureRef && (
        <div className="text-xs text-amber-200/70">{element.scriptureRef}</div>
      )}

      {immediate && (
        <div className="text-xs space-y-1">
          <div className="text-amber-300 font-semibold">Immediate</div>
          <div className="text-slate-300">{immediate.name}</div>
          <div className="text-slate-300">
            {immediate.summary ?? formatWorldElementDeltas(immediate)}
          </div>
        </div>
      )}

      {build && (
        <div className="text-xs space-y-1">
          <div className="text-amber-300 font-semibold">Build</div>
          <div className="text-slate-300">
            {build.name} ({build.costStars}★)
          </div>
          <div className="text-slate-300">
            {build.summary ??
              [
                formatWorldElementDeltas({
                  starsDelta: -build.costStars,
                  popDelta: build.effectPermanent?.popDelta || 0,
                  faithDelta: build.faithDelta || 0,
                  prideDelta: build.prideDelta || 0,
                  dissentDelta: build.dissentDelta || 0,
                }),
                build.effectPermanent?.starsPerTurn
                  ? `+${build.effectPermanent.starsPerTurn}★/turn`
                  : null,
              ]
                .filter(Boolean)
                .join(' • ')}
          </div>

          {build.upgrade && (
            <div className="text-slate-300">
              Upgrade: {build.upgrade.structure}
              {build.upgrade.costStars ? ` (${build.upgrade.costStars}★)` : ''}
              {build.upgrade.techRequired ? ` after ${build.upgrade.techRequired}` : ''}{' '}
              {build.upgrade.effectPermanent?.starsPerTurn
                ? `(+${build.upgrade.effectPermanent.starsPerTurn}★/turn)`
                : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Resource-specific tooltips
export function TimberGroveTooltip() {
  return <WorldElementTooltip elementId="timber_grove" />;
}

export function WildGoatsTooltip() {
  return <WorldElementTooltip elementId="wild_goats" />;
}

export function GrainPatchTooltip() {
  return <WorldElementTooltip elementId="grain_patch" />;
}

export function GameResourceTooltip() {
  return <WorldElementTooltip elementId="sea_beast" />;
}

export function MetalResourceTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-orange-300">Ore Veins</div>
      <div className="text-xs text-slate-300">
        Mineral deposits provide materials for tools, weapons, and construction.
      </div>
    </div>
  );
}

export function OreVeinTooltip() {
  return <WorldElementTooltip elementId="ore_vein" />;
}

export function FishingShoalTooltip() {
  return <WorldElementTooltip elementId="fishing_shoal" />;
}

export function JarediteRuinsTooltip() {
  return <WorldElementTooltip elementId="jaredite_ruins" />;
}

export function StoneResourceTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-gray-300">Stone Resource</div>
      <div className="text-xs text-slate-300">
        Stone deposits found in mountain terrain provide essential building materials.
      </div>
    </div>
  );
}

export function FruitResourceTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-green-300">Fruit Resource</div>
      <div className="text-xs text-slate-300">
        Wild fruit orchards provide abundant food for growing populations.
      </div>
    </div>
  );
}

export function TechnologyTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-green-300">Technology Research</div>
      <div className="text-xs text-slate-300">
        Research technologies to unlock new units, buildings, and abilities.
      </div>
      <div className="text-xs space-y-1">
        <div>• Costs increase with each tech</div>
        <div>• Some techs have prerequisites</div>
        <div>• Research one tech at a time</div>
        <div>• Essential for advanced strategy</div>
      </div>
    </div>
  );
}

export function DissentTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-orange-300">Internal Dissent</div>
      <div className="text-xs text-slate-300">
        Dissent represents internal conflicts and civil unrest in your civilization.
      </div>
      <div className="text-xs space-y-1">
        <div>• Increases with aggressive actions</div>
        <div>• Rebellions can cause city unrest (reduced income)</div>
        <div>• Can be reduced through faith</div>
        <div>• Very high dissent can trigger desertion</div>
      </div>
    </div>
  );
}

// Export the main components
export default InfoTooltip;
