import { useEffect, useMemo, useRef, useState } from 'react';
import { Star, BookOpen, Hammer, ScrollText, Settings, Save, ShieldHalf, Menu as MenuIcon, Home, MessageSquare } from 'lucide-react';
import { isBugReportingEnabled } from '../../utils/bugReport';
import clsx from 'clsx';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { getPlayerStats } from '../../selectors/player';
import { useMobileUI } from '../../hooks/useMobileUI';
import type { GameState, PlayerState } from '@shared/types/game';

interface MobileHUDProps {
  player: PlayerState;
  gameState: GameState;
  onEndTurn: () => void;
  onOpenTech: () => void;
  onOpenConstruction: () => void;
  onOpenDiplomacy: () => void;
  onOpenSaveLoad: () => void;
  onOpenSettings: () => void;
  onOpenBugReport?: () => void;
  onOpenGameLog: () => void;
  onOpenChat: () => void;
  showChat?: boolean;
  onOpenCities?: () => void;
  onOpenAdvancedSave?: () => void;
}

export function MobileHUD({
  player,
  gameState,
  onEndTurn,
  onOpenTech,
  onOpenConstruction,
  onOpenDiplomacy,
  onOpenSaveLoad,
  onOpenSettings,
  onOpenBugReport,
  onOpenGameLog,
  onOpenChat,
  showChat = true,
  onOpenCities,
  onOpenAdvancedSave,
}: MobileHUDProps) {
  const { isPortrait } = useMobileUI();
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const playerStats = useMemo(() => getPlayerStats(player, gameState), [player, gameState]);

  const handleMenuAction = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const updateHeight = () => {
      const height = Math.ceil(rootRef.current?.getBoundingClientRect().height ?? 0);
      document.documentElement.style.setProperty('--mobile-hud-height', `${height}px`);
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    const observer = typeof ResizeObserver !== 'undefined' && rootRef.current
      ? new ResizeObserver(updateHeight)
      : null;
    if (observer && rootRef.current) {
      observer.observe(rootRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateHeight);
      observer?.disconnect();
      document.documentElement.style.removeProperty('--mobile-hud-height');
    };
  }, []);

  return (
    <div ref={rootRef} className="fixed top-0 left-0 right-0 z-[var(--z-hud)] pointer-events-auto">
      <div className="mobile-safe-top bg-slate-900/85 border-b border-amber-500/20 backdrop-blur-md">
        <div className={clsx("px-3 py-2", isPortrait ? "space-y-2" : "flex items-center justify-between gap-3")}>
          <div className={clsx("flex items-center gap-3", isPortrait ? "w-full justify-between" : "")}>
            <div className="flex items-center gap-2 rounded-lg bg-amber-900/30 border border-amber-500/30 px-2 py-1">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-amber-100 font-semibold">{player.stars}</span>
              <span className="text-xs text-amber-200/70">+{playerStats.starProduction}/turn</span>
            </div>
            <div className="text-xs text-amber-200/70">
              Turn {gameState.turn}
            </div>
          </div>

          <div className={clsx("flex items-center gap-2", isPortrait ? "w-full justify-between" : "")}>
            <div className="flex items-center gap-2 text-xs text-slate-200/90">
              <span className="rounded-full bg-blue-500/20 px-2 py-1 text-blue-200">F {player.stats.faith}</span>
              <span className="rounded-full bg-red-500/20 px-2 py-1 text-red-200">P {player.stats.pride}</span>
              <span className="rounded-full bg-orange-500/20 px-2 py-1 text-orange-200">D {player.stats.internalDissent}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onEndTurn}
                className="min-h-[44px] rounded-lg bg-green-600 px-3 text-sm font-semibold text-white shadow-lg active:bg-green-700"
              >
                End Turn
              </button>
              <button
                onClick={() => setMenuOpen(true)}
                className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-600 bg-slate-800 text-slate-100 shadow-lg active:bg-slate-700"
                aria-label="Open menu"
              >
                <MenuIcon className="mx-auto h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="bottom"
          className="mobile-safe-bottom max-h-[calc(100dvh-0.5rem)] overflow-y-auto touch-scroll bg-slate-950 text-amber-100 border-t border-amber-500/30 p-4"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="font-cinzel text-lg text-amber-100">Game Menu</SheetTitle>
          </SheetHeader>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => handleMenuAction(onOpenTech)}
              className="min-h-[52px] rounded-lg border border-blue-500/40 bg-blue-900/30 text-blue-100 flex items-center justify-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Tech
            </button>
            <button
              onClick={() => handleMenuAction(onOpenConstruction)}
              className="min-h-[52px] rounded-lg border border-amber-500/40 bg-amber-900/30 text-amber-100 flex items-center justify-center gap-2"
            >
              <Hammer className="h-4 w-4" />
              Build
            </button>
            {onOpenCities && (
              <button
                onClick={() => handleMenuAction(onOpenCities)}
                className="min-h-[52px] rounded-lg border border-slate-500/40 bg-slate-800/40 text-slate-100 flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                Cities
              </button>
            )}
            <button
              onClick={() => handleMenuAction(onOpenDiplomacy)}
              className="min-h-[52px] rounded-lg border border-purple-500/40 bg-purple-900/30 text-purple-100 flex items-center justify-center gap-2"
            >
              <ShieldHalf className="h-4 w-4" />
              Diplomacy
            </button>
            <button
              onClick={() => handleMenuAction(onOpenSaveLoad)}
              className="min-h-[52px] rounded-lg border border-amber-600/40 bg-amber-950/30 text-amber-100 flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save/Load
            </button>
            <button
              onClick={() => handleMenuAction(onOpenGameLog)}
              className="min-h-[52px] rounded-lg border border-slate-500/40 bg-slate-800/40 text-slate-100 flex items-center justify-center gap-2"
            >
              <ScrollText className="h-4 w-4" />
              Game Log
            </button>
            {showChat && (
              <button
                onClick={() => handleMenuAction(onOpenChat)}
                className="min-h-[52px] rounded-lg border border-amber-500/40 bg-amber-950/20 text-amber-100 flex items-center justify-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Chat
              </button>
            )}
            {onOpenAdvancedSave && (
              <button
                onClick={() => handleMenuAction(onOpenAdvancedSave)}
                className="min-h-[52px] rounded-lg border border-slate-600/40 bg-slate-800/40 text-slate-100 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                Advanced
              </button>
            )}
            {isBugReportingEnabled() && (
              <button
                onClick={() => handleMenuAction(onOpenBugReport)}
                className="min-h-[52px] rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-100 flex items-center justify-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Report Issue
              </button>
            )}
            <button
              onClick={() => handleMenuAction(onOpenSettings)}
              className="min-h-[52px] rounded-lg border border-slate-500/40 bg-slate-800/40 text-slate-100 flex items-center justify-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
