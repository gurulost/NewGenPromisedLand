import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

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
  title?: string;
  description?: string;
  cost?: number | string;
  faith?: number | string;
  pride?: number | string;
  requirements?: string[];
  effects?: string[];
  hotkey?: string;
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
      {/* Animated glow effect */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/40 to-blue-600/40 animate-pulse group-hover:animate-none" />
      
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

// Enhanced ActionTooltip component - renders rich contextual content for tooltips or inline descriptions
export function ActionTooltip({ 
  title, 
  description, 
  cost, 
  faith, 
  pride, 
  requirements = [], 
  effects = [], 
  hotkey
}: ActionTooltipProps) {
  const formatResource = (value: number | string | undefined, suffix: string) => {
    if (value === undefined) return null;
    if (typeof value === 'string') return value;
    return `${value} ${suffix}`;
  };

  const costLabel = formatResource(cost, 'stars');
  const faithLabel = formatResource(faith, 'faith');
  const prideLabel = formatResource(pride, 'pride');

  return (
    <div className="space-y-3 text-left">
      {(title || description) && (
        <div>
          {title && <div className="font-semibold text-sm text-white">{title}</div>}
          {description && <p className="text-xs text-slate-300 mt-1 leading-relaxed">{description}</p>}
        </div>
      )}

      {(costLabel || faithLabel || prideLabel) && (
        <div className="space-y-1 text-xs">
          {costLabel && (
            <div className="flex items-center gap-2">
              <span className="text-yellow-300 font-semibold">Cost:</span>
              <span className="text-slate-100">{costLabel}</span>
            </div>
          )}
          {faithLabel && (
            <div className="flex items-center gap-2">
              <span className="text-blue-300 font-semibold">Faith:</span>
              <span className="text-slate-100">{faithLabel}</span>
            </div>
          )}
          {prideLabel && (
            <div className="flex items-center gap-2">
              <span className="text-red-300 font-semibold">Pride:</span>
              <span className="text-slate-100">{prideLabel}</span>
            </div>
          )}
        </div>
      )}

      {requirements.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-red-300 uppercase tracking-wide">Requirements</div>
          <ul className="mt-1 text-xs text-slate-200 space-y-1">
            {requirements.map((req, index) => (
              <li key={`${req}-${index}`}>{req}</li>
            ))}
          </ul>
        </div>
      )}

      {effects.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-green-300 uppercase tracking-wide">Effects</div>
          <ul className="mt-1 text-xs text-slate-200 space-y-1">
            {effects.map((effect, index) => (
              <li key={`${effect}-${index}`}>{effect}</li>
            ))}
          </ul>
        </div>
      )}

      {hotkey && (
        <div className="border-t border-slate-700 pt-2">
          <span className="text-xs text-slate-300">Hotkey: </span>
          <kbd className="bg-slate-700 px-2 py-0.5 rounded text-xs font-mono text-slate-100">{hotkey}</kbd>
        </div>
      )}
    </div>
  );
}

// Enhanced specialized tooltip content components with proper types
interface UnitTooltipProps {
  unit: {
    id: string;
    hp: number;
    maxHp: number;
    level?: number;
    experience?: number;
    remainingMovement: number;
    movement?: number;
    attack?: number;
    defense?: number;
    visionRadius?: number;
    attackRange?: number;
    status?: string;
    hasAttacked?: boolean;
  };
  unitDef: {
    name: string;
    description?: string;
    baseStats: {
      attack: number;
      defense: number;
      movement: number;
      visionRadius: number;
      attackRange: number;
    };
    abilities?: string[];
  };
}

export function UnitTooltip({ unit, unitDef }: UnitTooltipProps) {
  const isWounded = unit.hp < unit.maxHp;
  const canMove = unit.remainingMovement > 0;
  const hasAttacked = unit.hasAttacked;
  
  return (
    <div className="space-y-3">
      {/* Unit Header */}
      <div className="border-b border-slate-600 pb-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-purple-300 text-sm">{unitDef.name}</div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-slate-400">Lv.{unit.level || 1}</div>
            {unit.experience && (
              <div className="text-xs text-yellow-400">★{unit.experience}</div>
            )}
          </div>
        </div>
        {unitDef.description && (
          <div className="text-xs text-slate-400 mt-1">{unitDef.description}</div>
        )}
      </div>
      
      {/* Core Stats */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-2">
          <div className={`flex items-center gap-2 ${isWounded ? 'text-red-300' : 'text-green-300'}`}>
            <span>❤️</span>
            <span className="font-semibold">{unit.hp}/{unit.maxHp}</span>
            {isWounded && <span className="text-red-400 text-xs">(Wounded)</span>}
          </div>
          <div className="flex items-center gap-2 text-orange-300">
            <span>⚔️</span>
            <span className="font-semibold">{unit.attack || unitDef.baseStats.attack}</span>
          </div>
          <div className="flex items-center gap-2 text-blue-300">
            <span>🛡️</span>
            <span className="font-semibold">{unit.defense || unitDef.baseStats.defense}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-300">
            <span>👁️</span>
            <span className="font-semibold">{unit.visionRadius || unitDef.baseStats.visionRadius}</span>
          </div>
          <div className={`flex items-center gap-2 ${canMove ? 'text-yellow-300' : 'text-slate-400'}`}>
            <span>🏃</span>
            <span className="font-semibold">{unit.remainingMovement}/{unit.movement || unitDef.baseStats.movement}</span>
          </div>
          <div className="flex items-center gap-2 text-purple-300">
            <span>🎯</span>
            <span className="font-semibold">{unit.attackRange || unitDef.baseStats.attackRange}</span>
          </div>
        </div>
      </div>

      {/* Status Effects */}
      {unit.status && unit.status !== 'active' && (
        <div className="bg-slate-700/50 rounded px-2 py-1">
          <div className="text-xs text-amber-300 font-semibold">Status: {unit.status}</div>
        </div>
      )}

      {/* Abilities */}
      {unitDef.abilities && unitDef.abilities.length > 0 && (
        <div className="border-t border-slate-600 pt-2">
          <div className="text-xs text-slate-300 mb-2 font-semibold">Abilities:</div>
          <div className="space-y-1">
            {unitDef.abilities.map((ability: string, index: number) => (
              <div key={index} className="text-xs text-blue-300 flex items-center gap-1">
                <span className="text-blue-400">•</span>
                <span>{ability}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Action Status */}
      <div className="border-t border-slate-600 pt-2">
        <div className="flex justify-between text-xs">
          <span className={hasAttacked ? 'text-red-400' : 'text-green-400'}>
            {hasAttacked ? '⚔️ Attacked' : '⚔️ Can Attack'}
          </span>
          <span className={canMove ? 'text-green-400' : 'text-slate-400'}>
            {canMove ? '🏃 Can Move' : '🏃 No Movement'}
          </span>
        </div>
      </div>
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
  return (
    <div className="space-y-2">
      <div className="font-semibold text-blue-300">Faith System</div>
      <div className="text-xs text-slate-300">
        Faith represents your people's spiritual devotion and guides moral choices throughout your civilization's growth.
      </div>
      <div className="text-xs">
        <div className="text-green-300 mb-1">Benefits:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li>Unlocks divine abilities and blessings</li>
          <li>Strengthens resistance to conversion</li>
          <li>Enables righteous governance options</li>
        </ul>
      </div>
    </div>
  );
}

export function PrideSystemTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-red-300">Pride System</div>
      <div className="text-xs text-slate-300">
        Pride reflects your civilization's worldly ambition and military prowess, but can corrupt righteous intentions.
      </div>
      <div className="text-xs">
        <div className="text-red-300 mb-1">Benefits:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li>Boosts combat effectiveness</li>
          <li>Accelerates military production</li>
          <li>Unlocks aggressive expansion options</li>
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
        Dissent measures internal conflict and opposition within your civilization from moral choices.
      </div>
      <div className="text-xs">
        <div className="text-purple-300 mb-1">Effects:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li>Reduces city loyalty and stability</li>
          <li>Increases risk of rebellion</li>
          <li>Weakens diplomatic relations</li>
        </ul>
      </div>
    </div>
  );
}

// Resource-specific tooltips
// Technology Tooltip with proper types
interface TechnologyTooltipProps {
  tech: {
    id: string;
    name: string;
    description: string;
    category: string;
    cost: number;
    prerequisites?: string[];
    unlocks?: {
      units?: string[];
      structures?: string[];
      improvements?: string[];
      abilities?: string[];
    };
  };
  player: {
    researchedTechs: string[];
    stars: number;
  };
}

export function TechnologyTooltip({ tech, player }: TechnologyTooltipProps) {
  const isResearched = player?.researchedTechs?.includes(tech.id);
  const canResearch = tech.prerequisites?.every((prereq: string) => player?.researchedTechs?.includes(prereq));
  const hasResources = player?.stars >= tech.cost;
  
  return (
    <div className="space-y-3">
      {/* Tech Header */}
      <div className="border-b border-slate-600 pb-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-blue-300 text-sm">{tech.name}</div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400">⭐{tech.cost}</span>
            {isResearched && <span className="text-green-400 text-xs">✓ Researched</span>}
          </div>
        </div>
        <div className="text-xs text-blue-200 mt-1">{tech.category}</div>
      </div>
      
      {/* Description */}
      <div className="text-xs text-slate-300">{tech.description}</div>
      
      {/* Prerequisites */}
      {tech.prerequisites && tech.prerequisites.length > 0 && (
        <div>
          <div className="text-red-400 font-semibold mb-1 text-sm">Prerequisites:</div>
          <div className="space-y-1">
            {tech.prerequisites.map((prereq: string, index: number) => {
              const hasPrereq = player?.researchedTechs?.includes(prereq);
              return (
                <div key={index} className={`text-xs flex items-center gap-1 ${
                  hasPrereq ? 'text-green-300' : 'text-red-300'
                }`}>
                  <span>{hasPrereq ? '✓' : '✗'}</span>
                  <span>{prereq}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Unlocks */}
      {tech.unlocks && (
        <div>
          <div className="text-green-400 font-semibold mb-2 text-sm">Unlocks:</div>
          <div className="space-y-2">
            {tech.unlocks.units && tech.unlocks.units.length > 0 && (
              <div>
                <div className="text-purple-300 text-xs mb-1">Units:</div>
                <div className="text-xs text-purple-200">
                  {tech.unlocks.units.join(', ')}
                </div>
              </div>
            )}
            {tech.unlocks.structures && tech.unlocks.structures.length > 0 && (
              <div>
                <div className="text-amber-300 text-xs mb-1">Structures:</div>
                <div className="text-xs text-amber-200">
                  {tech.unlocks.structures.join(', ')}
                </div>
              </div>
            )}
            {tech.unlocks.improvements && tech.unlocks.improvements.length > 0 && (
              <div>
                <div className="text-green-300 text-xs mb-1">Improvements:</div>
                <div className="text-xs text-green-200">
                  {tech.unlocks.improvements.join(', ')}
                </div>
              </div>
            )}
            {tech.unlocks.abilities && tech.unlocks.abilities.length > 0 && (
              <div>
                <div className="text-blue-300 text-xs mb-1">Abilities:</div>
                <div className="text-xs text-blue-200">
                  {tech.unlocks.abilities.join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Research Status */}
      {!isResearched && (
        <div className="border-t border-slate-600 pt-2">
          <div className="text-xs">
            {!canResearch && (
              <div className="text-red-400">Missing prerequisites</div>
            )}
            {canResearch && !hasResources && (
              <div className="text-yellow-400">Need {tech.cost - player.stars} more stars</div>
            )}
            {canResearch && hasResources && (
              <div className="text-green-400">Ready to research!</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Building/Structure Tooltip
export function BuildingTooltip({ building, city }: { building: any; city?: any }) {
  return (
    <div className="space-y-3">
      {/* Building Header */}
      <div className="border-b border-slate-600 pb-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-amber-300 text-sm">{building.name}</div>
          <div className="text-yellow-400 text-sm">⭐{building.cost}</div>
        </div>
        <div className="text-xs text-amber-200 mt-1">{building.type}</div>
      </div>
      
      {/* Description */}
      <div className="text-xs text-slate-300">{building.description}</div>
      
      {/* Effects */}
      {building.effects && (
        <div>
          <div className="text-green-400 font-semibold mb-2 text-sm">Effects:</div>
          <div className="space-y-1 text-xs">
            {building.effects.starProduction && (
              <div className="text-yellow-300">⭐ +{building.effects.starProduction} per turn</div>
            )}
            {building.effects.populationGrowth && (
              <div className="text-green-300">👥 +{building.effects.populationGrowth} population growth</div>
            )}
            {building.effects.defenseBonus && (
              <div className="text-blue-300">🛡️ +{building.effects.defenseBonus} city defense</div>
            )}
          </div>
        </div>
      )}
      
      {/* Requirements */}
      {building.requiredTech && (
        <div className="border-t border-slate-600 pt-2">
          <div className="text-xs text-red-300">Requires: {building.requiredTech}</div>
        </div>
      )}
    </div>
  );
}

// Combat Tooltip with proper types
interface CombatTooltipProps {
  attacker: {
    name: string;
    attack: number;
    defense: number;
    hp: number;
  };
  defender: {
    name: string;
    attack: number;
    defense: number;
    hp: number;
  };
  odds: {
    attackerWinChance: number;
    defenderWinChance: number;
    expectedAttackerDamage: number;
    expectedDefenderDamage: number;
    attackerSurvival: number;
    defenderSurvival: number;
    attackerModifiers?: string[];
    defenderModifiers?: string[];
  };
}

export function CombatTooltip({ attacker, defender, odds }: CombatTooltipProps) {
  return (
    <div className="space-y-3">
      {/* Combat Header */}
      <div className="border-b border-slate-600 pb-2">
        <div className="font-semibold text-red-300 text-sm">Combat Preview</div>
        <div className="text-xs text-slate-400 mt-1">
          {attacker.name} vs {defender.name}
        </div>
      </div>
      
      {/* Win Chance */}
      <div className="text-center">
        <div className={`text-lg font-bold ${
          odds.attackerWinChance >= 75 ? 'text-green-400' :
          odds.attackerWinChance >= 50 ? 'text-yellow-400' :
          odds.attackerWinChance >= 25 ? 'text-orange-400' : 'text-red-400'
        }`}>
          {Math.round(odds.attackerWinChance)}%
        </div>
        <div className="text-xs text-slate-400">Win Chance</div>
      </div>
      
      {/* Damage Preview */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="text-center">
          <div className="text-blue-300 font-semibold">Your Damage</div>
          <div className="text-white font-bold">{odds.expectedAttackerDamage}</div>
          <div className="text-blue-200">Survival: {Math.round(odds.attackerSurvival)}%</div>
        </div>
        <div className="text-center">
          <div className="text-red-300 font-semibold">Enemy Damage</div>
          <div className="text-white font-bold">{odds.expectedDefenderDamage}</div>
          <div className="text-red-200">Survival: {Math.round(odds.defenderSurvival)}%</div>
        </div>
      </div>
      
      {/* Combat Modifiers */}
      {((odds.attackerModifiers && odds.attackerModifiers.length > 0) || (odds.defenderModifiers && odds.defenderModifiers.length > 0)) && (
        <div className="border-t border-slate-600 pt-2">
          <div className="text-xs text-slate-300 font-semibold mb-1">Modifiers:</div>
          <div className="space-y-1 text-xs">
            {odds.attackerModifiers?.map((mod: string, index: number) => (
              <div key={index} className="text-blue-300">⚔️ {mod}</div>
            ))}
            {odds.defenderModifiers?.map((mod: string, index: number) => (
              <div key={index} className="text-red-300">🛡️ {mod}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TimberGroveTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-green-300">Timber Grove</div>
      <div className="text-xs text-slate-300">
        Sacred forests provide both immediate resources and long-term spiritual growth opportunities.
      </div>
      <div className="text-xs">
        <div className="text-green-300 mb-1">Harvest Options:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li><span className="text-blue-300">Faithful Stewardship:</span> +2 Faith, sustainable growth</li>
          <li><span className="text-red-300">Prideful Exploitation:</span> +3 Stars, +1 Pride, -1 Faith</li>
        </ul>
      </div>
    </div>
  );
}

export function WildGoatsTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-brown-300">Wild Goats</div>
      <div className="text-xs text-slate-300">
        Wild herds offer protein and materials, but your approach affects your people's relationship with nature.
      </div>
      <div className="text-xs">
        <div className="text-brown-300 mb-1">Harvest Options:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li><span className="text-blue-300">Respectful Hunting:</span> +1 Population, +1 Faith</li>
          <li><span className="text-red-300">Aggressive Hunting:</span> +2 Population, +1 Pride, +1 Dissent</li>
        </ul>
      </div>
    </div>
  );
}

export function GrainPatchTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-yellow-300">Grain Patch</div>
      <div className="text-xs text-slate-300">
        Wild grains provide sustenance and can be cultivated, representing humanity's relationship with the land.
      </div>
      <div className="text-xs">
        <div className="text-yellow-300 mb-1">Harvest Options:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li><span className="text-blue-300">Patient Cultivation:</span> +1 Population, +1 Faith, long-term growth</li>
          <li><span className="text-red-300">Quick Harvesting:</span> +2 Population, +1 Pride</li>
        </ul>
      </div>
    </div>
  );
}

export function GameResourceTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-purple-300">Game Animals</div>
      <div className="text-xs text-slate-300">
        Wild game provides protein and materials for your growing civilization.
      </div>
    </div>
  );
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
  return (
    <div className="space-y-2">
      <div className="font-semibold text-orange-300">Ore Vein</div>
      <div className="text-xs text-slate-300">
        Sacred mineral veins represent the earth's hidden treasures and test stewardship values.
      </div>
      <div className="text-xs">
        <div className="text-orange-300 mb-1">Harvest Options:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li><span className="text-blue-300">Careful Mining:</span> +2 Stars, +1 Faith, sustainable extraction</li>
          <li><span className="text-red-300">Strip Mining:</span> +4 Stars, +1 Pride, +1 Dissent</li>
        </ul>
      </div>
    </div>
  );
}

export function FishingShoalTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-blue-300">Fishing Shoal</div>
      <div className="text-xs text-slate-300">
        Rich fishing grounds provide abundant protein and materials from the sea's bounty.
      </div>
      <div className="text-xs">
        <div className="text-blue-300 mb-1">Harvest Options:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li><span className="text-blue-300">Sustainable Fishing:</span> +2 Population, +1 Faith</li>
          <li><span className="text-red-300">Overfishing:</span> +3 Population, +1 Pride, +1 Dissent</li>
        </ul>
      </div>
    </div>
  );
}

export function JarediteRuinsTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-purple-300">Jaredite Ruins</div>
      <div className="text-xs text-slate-300">
        Ancient ruins from the fallen Jaredite civilization offer both knowledge and moral tests.
      </div>
      <div className="text-xs">
        <div className="text-purple-300 mb-1">Exploration Options:</div>
        <ul className="list-disc list-inside text-slate-300 space-y-1">
          <li><span className="text-blue-300">Reverent Study:</span> +1 Tech Progress, +1 Faith</li>
          <li><span className="text-red-300">Treasure Hunting:</span> +3 Stars, +1 Pride, +1 Dissent</li>
        </ul>
      </div>
    </div>
  );
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


export function DissentTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-orange-300">Internal Dissent</div>
      <div className="text-xs text-slate-300">
        Dissent represents internal conflicts and civil unrest in your civilization.
      </div>
      <div className="text-xs space-y-1">
        <div>• Increases with aggressive actions</div>
        <div>• Reduces efficiency and growth</div>
        <div>• Can be reduced through faith</div>
        <div>• High dissent causes rebellions</div>
      </div>
    </div>
  );
}

// Export the main components
export default InfoTooltip;
