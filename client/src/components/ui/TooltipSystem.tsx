import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface TooltipPosition {
  x: number;
  y: number;
  placement: string;
}

interface InfoTooltipProps {
  content: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

interface LegacyTooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  delay?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}

// Main standalone info button tooltip that doesn't interfere with clicks
export function InfoTooltip({ 
  content, 
  placement = 'top',
  className = ""
}: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0, placement });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const showTooltip = (event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const tooltipPosition = calculatePosition(rect, placement);
    setPosition(tooltipPosition);
    setIsVisible(true);
  };

  const hideTooltip = () => {
    setIsVisible(false);
  };

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

  const tooltipElement = isVisible && (
    <div
      className="fixed z-[9999] pointer-events-none"
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
      <button
        ref={buttonRef}
        type="button"
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors duration-200 ${className}`}
        onClick={showTooltip}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        aria-label="More information"
      >
        <Info className="w-3 h-3" />
      </button>
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
      if (children.ref) {
        if (typeof children.ref === 'function') {
          children.ref(el);
        } else {
          (children.ref as any).current = el;
        }
      }
    }
  });

  const tooltipElement = isVisible && (
    <div
      className="fixed z-[9999] pointer-events-none"
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

  return { x, y, placement: finalPlacement };
}

function getTransform(placement: string): string {
  switch (placement) {
    case 'top':
      return 'translate(-50%, -100%)';
    case 'bottom':
      return 'translate(-50%, 0%)';
    case 'left':
      return 'translate(-100%, -50%)';
    case 'right':
      return 'translate(0%, -50%)';
    default:
      return 'translate(-50%, -100%)';
  }
}

function getArrowClasses(placement: string): string {
  switch (placement) {
    case 'top':
      return 'top-full left-1/2 -translate-x-1/2 border-t border-l';
    case 'bottom':
      return 'bottom-full left-1/2 -translate-x-1/2 border-b border-r';
    case 'left':
      return 'left-full top-1/2 -translate-y-1/2 border-l border-b';
    case 'right':
      return 'right-full top-1/2 -translate-y-1/2 border-r border-t';
    default:
      return 'top-full left-1/2 -translate-x-1/2 border-t border-l';
  }
}

// Specialized tooltip content components
export function ActionTooltip({ 
  title, 
  description, 
  cost, 
  requirements, 
  effects, 
  hotkey 
}: {
  title: string;
  description: string;
  cost?: string;
  requirements?: string[];
  effects?: string[];
  hotkey?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-blue-300">{title}</div>
      <div className="text-xs text-slate-300">{description}</div>
      
      {cost && (
        <div className="text-xs">
          <span className="text-yellow-300">Cost: </span>
          <span className="text-white">{cost}</span>
        </div>
      )}
      
      {requirements && requirements.length > 0 && (
        <div className="text-xs">
          <div className="text-red-300 mb-1">Requirements:</div>
          <ul className="list-disc list-inside text-slate-300">
            {requirements.map((req, index) => (
              <li key={index}>{req}</li>
            ))}
          </ul>
        </div>
      )}
      
      {effects && effects.length > 0 && (
        <div className="text-xs">
          <div className="text-green-300 mb-1">Effects:</div>
          <ul className="list-disc list-inside text-slate-300">
            {effects.map((effect, index) => (
              <li key={index}>{effect}</li>
            ))}
          </ul>
        </div>
      )}
      
      {hotkey && (
        <div className="text-xs">
          <span className="text-purple-300">Hotkey: </span>
          <kbd className="bg-slate-600 px-1 rounded text-white">{hotkey}</kbd>
        </div>
      )}
    </div>
  );
}

export function UnitTooltip({ unit, unitDef }: { unit: any; unitDef: any }) {
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
        Faith represents your civilization's spiritual strength and unity.
      </div>
      <div className="text-xs space-y-1">
        <div>• Gained from temples and cities</div>
        <div>• Used for special abilities</div>
        <div>• Enables conversion and healing</div>
        <div>• Required for faith victory</div>
      </div>
    </div>
  );
}

export function PrideSystemTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-red-300">Pride System</div>
      <div className="text-xs text-slate-300">
        Pride represents your civilization's military strength and ambition.
      </div>
      <div className="text-xs space-y-1">
        <div>• Gained from victories and conquests</div>
        <div>• Enables aggressive abilities</div>
        <div>• Boosts combat effectiveness</div>
        <div>• Can lead to internal conflicts</div>
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
        <div>• Reduces efficiency and growth</div>
        <div>• Can be reduced through faith</div>
        <div>• High dissent causes rebellions</div>
      </div>
    </div>
  );
}

// Resource-specific tooltips
export function StoneResourceTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-gray-300">Stone Resource</div>
      <div className="text-xs text-slate-300">
        Stone deposits found in mountain terrain provide essential building materials.
      </div>
      <div className="text-xs space-y-1">
        <div className="text-yellow-300">• Worker Action: Harvest Stone</div>
        <div>• Requires Mining technology</div>
        <div>• Gives +1 population to nearest city</div>
        <div>• Worker must be within 2 tiles of friendly city</div>
        <div>• Consumes worker's movement for the turn</div>
        <div>• Tile becomes empty plains after harvest</div>
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
      <div className="text-xs space-y-1">
        <div className="text-yellow-300">• Worker Action: Harvest Fruit</div>
        <div>• No technology requirement</div>
        <div>• Gives +3 population to nearest city</div>
        <div>• Worker must be within 2 tiles of friendly city</div>
        <div>• Consumes worker's movement for the turn</div>
        <div>• Tile becomes empty plains after harvest</div>
      </div>
    </div>
  );
}

export function GameResourceTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-amber-300">Animal Resource</div>
      <div className="text-xs text-slate-300">
        Wild animals provide meat and materials for expanding settlements.
      </div>
      <div className="text-xs space-y-1">
        <div className="text-yellow-300">• Worker Action: Hunt Animals</div>
        <div>• Requires Hunting technology</div>
        <div>• Gives +2 population to nearest city</div>
        <div>• Worker must be within 2 tiles of friendly city</div>
        <div>• Consumes worker's movement for the turn</div>
        <div>• Tile becomes empty plains after harvest</div>
      </div>
    </div>
  );
}

export function MetalResourceTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-blue-300">Metal Resource</div>
      <div className="text-xs text-slate-300">
        Precious metal deposits provide valuable materials for tools and trade.
      </div>
      <div className="text-xs space-y-1">
        <div className="text-yellow-300">• Worker Action: Mine Metal</div>
        <div>• Requires Mining technology</div>
        <div>• Gives +1 population to nearest city</div>
        <div>• Worker must be within 2 tiles of friendly city</div>
        <div>• Consumes worker's movement for the turn</div>
        <div>• Tile becomes empty plains after harvest</div>
      </div>
    </div>
  );
}

export function TimberGroveTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-green-400">Timber Grove</div>
      <div className="text-xs text-slate-300">
        Sacred groves offer a moral choice between quick profit and sustainable growth.
      </div>
      <div className="text-xs space-y-1">
        <div className="text-red-300">• Quick Option: Harvest Lumber</div>
        <div>  - Gain 2 stars immediately</div>
        <div>  - +1 Pride, +1 Dissent (moral cost)</div>
        <div>  - Tile becomes empty plains</div>
        <div className="text-green-300">• Sustainable Option: Build Sawmill</div>
        <div>  - Costs 5 stars, requires Woodcraft tech</div>
        <div>  - +1 Population, +1 star per turn</div>
        <div>  - +1 Faith (spiritual benefit)</div>
        <div>  - Permanent improvement</div>
      </div>
    </div>
  );
}

export function WildGoatsTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-amber-400">Wild Goats</div>
      <div className="text-xs text-slate-300">
        Herds of goats present a choice between immediate sustenance and long-term husbandry.
      </div>
      <div className="text-xs space-y-1">
        <div className="text-red-300">• Quick Option: Slaughter for Meat</div>
        <div>  - Gain 2 stars immediately</div>
        <div>  - +1 Pride, +1 Dissent (moral cost)</div>
        <div>  - Tile becomes empty plains</div>
        <div className="text-green-300">• Sustainable Option: Build Corral</div>
        <div>  - Costs 5 stars, requires Husbandry tech</div>
        <div>  - +1 Population, +1 star per turn</div>
        <div>  - +1 Faith (stewardship benefit)</div>
        <div>  - Permanent improvement</div>
      </div>
    </div>
  );
}

export function GrainPatchTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-yellow-400">Grain Patch</div>
      <div className="text-xs text-slate-300">
        Wild grains offer choices between immediate harvest and agricultural development.
      </div>
      <div className="text-xs space-y-1">
        <div className="text-red-300">• Quick Option: Gather Harvest</div>
        <div>  - Gain 1 population immediately</div>
        <div>  - +1 Pride, +1 Dissent (exploitation)</div>
        <div>  - Tile becomes empty plains</div>
        <div className="text-green-300">• Sustainable Option: Build Field</div>
        <div>  - Costs 5 stars, requires Agriculture tech</div>
        <div>  - +2 Population permanently</div>
        <div>  - +1 Faith (cultivation blessing)</div>
        <div>  - Can upgrade to Granary (+1 star/turn)</div>
      </div>
    </div>
  );
}

export function FishingShoalTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-blue-400">Fishing Shoal</div>
      <div className="text-xs text-slate-300">
        Rich fishing grounds that require technology and infrastructure to utilize.
      </div>
      <div className="text-xs space-y-1">
        <div className="text-yellow-300">• No immediate harvest option</div>
        <div className="text-green-300">• Build Option: Fishing Jetty</div>
        <div>  - Costs 2 stars, requires Seafaring tech</div>
        <div>  - +1 Population boost</div>
        <div>  - No ongoing star production</div>
        <div className="text-purple-300">• Upgrade: Harbor (with Trade tech)</div>
        <div>  - No additional cost</div>
        <div>  - +2 stars per turn permanently</div>
        <div>• Spawns on 50% of water tiles</div>
        <div>• Mulekites get enhanced spawn rates (1.5x-2.0x)</div>
      </div>
    </div>
  );
}

export function JarediteRuinsTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-purple-400">Jaredite Ruins</div>
      <div className="text-xs text-slate-300">
        Ancient ruins left by the Jaredite civilization, full of mysteries and treasures.
      </div>
      <div className="text-xs space-y-1">
        <div className="text-yellow-300">• Exploration Action: Investigate Ruins</div>
        <div>• Random rewards when explored:</div>
        <div>  - Ancient technology knowledge</div>
        <div>  - Population refugees joining your city</div>
        <div>  - Star treasure caches</div>
        <div>  - Elite warrior units</div>
        <div>  - Map vision revealing nearby areas</div>
        <div>• Ruins disappear after exploration</div>
        <div>• Higher spawn rates near Jaredite tribal lands</div>
      </div>
    </div>
  );
}

export function OreVeinTooltip() {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-blue-400">Ore Vein</div>
      <div className="text-xs text-slate-300">
        Precious metals and ores present a choice between immediate extraction and sustainable mining.
      </div>
      <div className="text-xs space-y-1">
        <div className="text-red-300">• Quick Option: Tap the Vein</div>
        <div>  - Gain +1 population, +2 stars</div>
        <div>  - +1 Pride, +1 Dissent (moral cost)</div>
        <div>  - No technology requirement</div>
        <div>  - Tile becomes empty mountain</div>
        <div className="text-green-300">• Sustainable Option: Build Mine</div>
        <div>  - Costs 5 stars, requires Mining tech</div>
        <div>  - +1 Population, +1 star per turn</div>
        <div>  - +1 Faith (spiritual benefit)</div>
        <div>  - Permanent improvement</div>
      </div>
    </div>
  );
}