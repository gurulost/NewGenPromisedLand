import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye } from "lucide-react";

import type { GameState } from "@shared/types/game";
import { getFaction } from "@shared/data/factions";
import { coerceFactionId } from "@shared/types/factionId";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useMapToastStore, hexToWorldPos } from "../../lib/stores/useMapToasts";
import { useMapPulseStore } from "../effects/MapPulseEffects";
import { useParticleStore } from "../effects/ParticleEffects";
import { useSfxEngine } from "../../hooks/useSfx";
import { GlowingButton } from "../primitives/GlowingButton";
import { VictoryReveal } from "./VictoryReveal";
import VictoryScreen from "./VictoryScreen";
import {
  getVictoryFocusCity,
  getVictoryTheme,
  getWinnerCities,
  type VictoryLogEntry,
  type VictoryType,
} from "../../lib/victoryPresentation";

interface VictorySequenceOverlayProps {
  gameState: GameState | null;
  gameLogEntries: VictoryLogEntry[];
}

export function VictorySequenceOverlay({
  gameState,
  gameLogEntries,
}: VictorySequenceOverlayProps) {
  const resetGame = useLocalGame((state) => state.resetGame);
  const setGamePhase = useLocalGame((state) => state.setGamePhase);
  const addToast = useMapToastStore((state) => state.addToast);
  const addPulse = useMapPulseStore((state) => state.addPulse);
  const playSfx = useSfxEngine();
  const victorySequenceRef = useRef<string | null>(null);
  const victoryTimeoutsRef = useRef<number[]>([]);
  const [overlayMode, setOverlayMode] = useState<"hidden" | "reveal" | "report" | "review">("hidden");

  const clearVictorySequenceTimers = useCallback(() => {
    victoryTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    victoryTimeoutsRef.current = [];
  }, []);

  useEffect(() => clearVictorySequenceTimers, [clearVictorySequenceTimers]);

  useEffect(() => {
    if (!gameState?.winner || !gameState.victoryType || gameState.phase !== "ended") {
      victorySequenceRef.current = null;
      clearVictorySequenceTimers();
      setOverlayMode("hidden");
      return;
    }

    const signature = `${gameState.id}:${gameState.winner}:${gameState.victoryType}:${gameState.turn}`;
    if (victorySequenceRef.current === signature) return;

    victorySequenceRef.current = signature;
    clearVictorySequenceTimers();
    setOverlayMode("reveal");

    const { addEvent: addParticle } = useParticleStore.getState();
    const winner = gameState.players.find((player) => player.id === gameState.winner);
    const focusCity = getVictoryFocusCity(gameState, gameState.winner);
    const ownedCities = getWinnerCities(gameState, gameState.winner).slice(0, 6);
    const theme = getVictoryTheme(gameState.victoryType);

    playSfx("achievement");

    if (focusCity) {
      victoryTimeoutsRef.current.push(window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("ruinsCinematic", {
          detail: {
            coordinate: focusCity.coordinate,
            focusMs: 900,
            holdMs: 2300,
            returnMs: 650,
          },
        }));
      }, 140));
    }

    if (focusCity && winner) {
      victoryTimeoutsRef.current.push(window.setTimeout(() => {
        addToast(
          `${winner.name} claims ${theme.title}`,
          theme.particleTone === "faith" ? "faith" : theme.particleTone === "capture" ? "combat" : "reward",
          hexToWorldPos(focusCity.coordinate.q, focusCity.coordinate.r),
          3200,
        );
      }, 260));
    }

    ownedCities.forEach((city, index) => {
      victoryTimeoutsRef.current.push(window.setTimeout(() => {
        addPulse(theme.pulseTone, city.coordinate);
        addParticle(theme.particleTone, city.coordinate);
      }, 280 + index * 240));
    });

    victoryTimeoutsRef.current.push(window.setTimeout(() => {
      setOverlayMode("report");
    }, 4300));
  }, [addPulse, addToast, clearVictorySequenceTimers, gameState, playSfx]);

  const winner = useMemo(
    () => (gameState?.winner ? gameState.players.find((player) => player.id === gameState.winner) ?? null : null),
    [gameState],
  );
  const activeVictoryType = (gameState?.victoryType ?? "faith") as VictoryType;
  const winnerFactionId = coerceFactionId(winner?.factionId);
  const winnerFactionName = winner
    ? getFaction(winnerFactionId ?? "NEPHITES").name
    : null;
  const victoryFocusCity = winner && gameState
    ? getVictoryFocusCity(gameState, winner.id)
    : null;
  const resetToMenu = useCallback(() => {
    clearVictorySequenceTimers();
    resetGame();
    setGamePhase("menu");
  }, [clearVictorySequenceTimers, resetGame, setGamePhase]);

  if (!winner || !gameState?.winner) {
    return null;
  }

  return (
    <>
      {overlayMode === "reveal" && (
        <VictoryReveal
          winnerName={winner.name}
          factionName={winnerFactionName ?? winner.factionId}
          victoryType={activeVictoryType}
          turn={gameState.turn}
          focusCityName={victoryFocusCity?.name}
          onSkip={() => {
            clearVictorySequenceTimers();
            setOverlayMode("report");
          }}
        />
      )}

      {overlayMode === "report" && (
        <VictoryScreen
          winnerId={winner.id}
          victoryType={activeVictoryType}
          gameLogEntries={gameLogEntries}
          onContinueToMap={() => setOverlayMode("review")}
          onPlayAgain={resetToMenu}
          onMainMenu={resetToMenu}
        />
      )}

      {overlayMode === "review" && (
        <div
          className="fixed left-1/2 top-4 z-[var(--z-hud)] w-[min(92vw,760px)] -translate-x-1/2 rounded-2xl border border-amber-300/20 bg-slate-950/78 p-3 shadow-2xl shadow-black/45 backdrop-blur-md"
          data-ui-layer="modal"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60">Match Concluded</div>
              <div className="mt-1 text-sm text-amber-50">
                {winner.name} won by {getVictoryTheme(activeVictoryType).title}. Review the final world or reopen the report.
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <GlowingButton
                onClick={() => setOverlayMode("report")}
                variant="secondary"
                glowColor="blue"
                size="md"
              >
                <span className="flex items-center justify-center gap-2">
                  <Eye className="h-4 w-4" />
                  View Report
                </span>
              </GlowingButton>
              <GlowingButton onClick={resetToMenu} variant="secondary" glowColor="slate" size="md">
                Main Menu
              </GlowingButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
