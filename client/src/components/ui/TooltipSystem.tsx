import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  delay?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  disabled?: boolean;
}

interface TooltipPosition {
  x: number;
  y: number;
  placement: string;
}

export function Tooltip({ 
  content, 
  children, 
  delay = 500, 
  placement = 'top',
  disabled = false 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0, placement });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const elementRef = useRef<HTMLElement>();

  const showTooltip = (event: MouseEvent) => {
    if (disabled) return;
    
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      const tooltipPosition = calculatePosition(rect, placement);
      setPosition(tooltipPosition);
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };

  const calculatePosition = (rect: DOMRect, preferredPlacement: string): TooltipPosition => {
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
  };

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('mouseenter', showTooltip);
    element.addEventListener('mouseleave', hideTooltip);
    element.addEventListener('focus', showTooltip);
    element.addEventListener('blur', hideTooltip);

    return () => {
      element.removeEventListener('mouseenter', showTooltip);
      element.removeEventListener('mouseleave', hideTooltip);
      element.removeEventListener('focus', showTooltip);
      element.removeEventListener('blur', hideTooltip);
      clearTimeout(timeoutRef.current);
    };
  }, [delay, disabled]);

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

// Advanced tooltip content components
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

export function TileTooltip({ tile, resources }: { tile: any; resources?: any[] }) {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-green-300 capitalize">{tile.terrain}</div>
      
      {resources && resources.length > 0 && (
        <div className="text-xs">
          <div className="text-slate-300 mb-1">Resources:</div>
          <div className="text-yellow-300">
            {resources.map(r => r.type).join(', ')}
          </div>
        </div>
      )}
      
      <div className="text-xs text-slate-400">
        Coordinate: ({tile.coordinate.q}, {tile.coordinate.r})
      </div>
    </div>
  );
}

export function ActionTooltip({ 
  title, 
  description, 
  cost, 
  requirements, 
  hotkey 
}: { 
  title: string; 
  description: string; 
  cost?: string; 
  requirements?: string[]; 
  hotkey?: string; 
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-blue-300">{title}</div>
        {hotkey && (
          <div className="text-xs bg-slate-700 px-1.5 py-0.5 rounded border border-slate-500">
            {hotkey}
          </div>
        )}
      </div>
      
      <div className="text-sm text-slate-200">{description}</div>
      
      {cost && (
        <div className="text-xs text-yellow-300">Cost: {cost}</div>
      )}
      
      {requirements && requirements.length > 0 && (
        <div className="text-xs text-red-300">
          Requires: {requirements.join(', ')}
        </div>
      )}
    </div>
  );
}