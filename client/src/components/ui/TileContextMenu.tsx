import { useEffect, useRef, useState } from "react";
import { useGameState } from "@/lib/stores/useGameState";

const EMPTY_MENU = {
  isOpen: false,
  screenPosition: { x: 0, y: 0 },
  tileCoordinate: null,
  options: [],
} as const;

export function TileContextMenu() {
  const { tileContextMenu, closeTileContextMenu } = useGameState();
  const safeMenu = tileContextMenu ?? EMPTY_MENU;
  const safeClose = typeof closeTileContextMenu === "function" ? closeTileContextMenu : () => {};
  const menuRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      
      const handleResize = () => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      };
      
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        safeClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        safeClose();
      }
    }

    if (safeMenu.isOpen) {
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
      }, 50);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [safeMenu.isOpen, safeClose]);

  if (!safeMenu.isOpen || safeMenu.options.length === 0) {
    return null;
  }

  const menuWidth = 200;
  const menuPadding = 8;
  const viewportWidth = viewport.width || 800;
  const viewportHeight = viewport.height || 600;

  let left = safeMenu.screenPosition.x;
  let top = safeMenu.screenPosition.y;

  if (left + menuWidth + menuPadding > viewportWidth) {
    left = viewportWidth - menuWidth - menuPadding;
  }
  if (left < menuPadding) {
    left = menuPadding;
  }

  const estimatedMenuHeight = safeMenu.options.length * 44 + 40;
  if (top + estimatedMenuHeight + menuPadding > viewportHeight) {
    top = viewportHeight - estimatedMenuHeight - menuPadding;
  }
  if (top < menuPadding) {
    top = menuPadding;
  }

  const handleOptionClick = (action: () => void) => {
    action();
    safeClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-slate-800/95 backdrop-blur-sm border border-amber-500/50 rounded-lg shadow-xl overflow-hidden pointer-events-auto"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        minWidth: `${menuWidth}px`,
      }}
    >
      <div className="text-xs text-amber-400/70 px-3 py-2 border-b border-amber-500/30 uppercase tracking-wider font-semibold">
        Select Action
      </div>
      <div className="py-1">
        {safeMenu.options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleOptionClick(option.action)}
            className="w-full px-3 py-2.5 text-left text-sm text-white hover:bg-amber-500/20 transition-colors flex items-center gap-2"
          >
            {option.icon && <span className="text-lg">{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
