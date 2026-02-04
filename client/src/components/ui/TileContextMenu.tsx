import { useEffect, useRef, useState } from "react";
import { useGameState } from "@/lib/stores/useGameState";
import { useMobileUI } from "../../hooks/useMobileUI";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./sheet";

const EMPTY_MENU = {
  isOpen: false,
  screenPosition: { x: 0, y: 0 },
  tileCoordinate: null,
  options: [],
} as const;

export function TileContextMenu() {
  const { tileContextMenu, closeTileContextMenu } = useGameState();
  const { isMobileUI } = useMobileUI();
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
        document.addEventListener("touchstart", handleClickOutside);
        document.addEventListener("pointerdown", handleClickOutside);
        document.addEventListener("keydown", handleEscape);
      }, 50);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
        document.removeEventListener("pointerdown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [safeMenu.isOpen, safeClose]);

  if (!safeMenu.isOpen || safeMenu.options.length === 0) {
    return null;
  }

  const handleOptionClick = (action: () => void) => {
    action();
    safeClose();
  };

  if (isMobileUI) {
    return (
      <Sheet
        open={safeMenu.isOpen}
        onOpenChange={(open) => {
          if (!open) safeClose();
        }}
      >
        <SheetContent
          side="bottom"
          className="mobile-safe-bottom bg-slate-950 text-amber-100 border-t border-amber-500/30 p-4"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-cinzel text-lg text-amber-100">Select Action</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-1 gap-2">
            {safeMenu.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleOptionClick(option.action)}
                className="min-h-[52px] w-full rounded-lg border border-amber-500/30 bg-slate-900/60 px-4 text-left text-sm text-amber-100 flex items-center gap-3"
              >
                {option.icon && <span className="text-lg">{option.icon}</span>}
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm">{option.label}</span>
                  {option.subLabel && (
                    <span className="text-xs text-amber-200/70">{option.subLabel}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
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

  const optionHeight = safeMenu.options.some(option => option.subLabel) ? 64 : 44;
  const estimatedMenuHeight = safeMenu.options.length * optionHeight + 40;
  if (top + estimatedMenuHeight + menuPadding > viewportHeight) {
    top = viewportHeight - estimatedMenuHeight - menuPadding;
  }
  if (top < menuPadding) {
    top = menuPadding;
  }

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
            className="w-full px-3 py-2.5 text-left text-sm text-white hover:bg-amber-500/20 transition-colors flex items-start gap-2"
          >
            {option.icon && <span className="text-lg">{option.icon}</span>}
            <span className="flex flex-col gap-1">
              <span>{option.label}</span>
              {option.subLabel && (
                <span className="text-xs text-amber-200/70">{option.subLabel}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
