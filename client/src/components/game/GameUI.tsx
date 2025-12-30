import { useEffect, useRef, useState } from "react";
import { useKeyboardControls } from "@react-three/drei";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { useAITurn } from "../../hooks/useAITurn";
import { useOnlineGameSync } from "../../hooks/useOnlineGameSync";
import { getFaction } from "@shared/data/factions";
import { PlayerHUD } from "../hud/PlayerHUD";
import SelectedUnitPanel from "../ui/SelectedUnitPanel";
import UnitActionsPanel from "../ui/AbilitiesPanel";
import TechPanel from "../ui/TechPanel";
import CityPanel from "../ui/CityPanel";
import { BuildingMenu } from "../ui/BuildingMenu";
import VictoryScreen from "../ui/VictoryScreen";
import SaveLoadMenu from "../ui/SaveLoadMenu";
import { TurnTransition, useTurnTransition } from "../ui/TurnTransition";
import { SaveSystem } from "../ui/SaveSystem";
import { UnitSelectionUI } from "../effects/UnitSelection";
import { ActionTooltip } from "../ui/TooltipSystem";
import { WorldElementPanel } from "../ui/WorldElementPanel";
import { VillageCapturePanel } from "../ui/VillageCapturePanel";
import { DiplomacyPanel } from "../ui/DiplomacyPanel";
import { RuinsRewardPanel } from "../ui/RuinsRewardPanel";
import { TileContextMenu } from "../ui/TileContextMenu";
import { useVisualFeedback } from "../ui/VisualFeedback";
import { GameLogPanel } from "../ui/GameLogPanel";
import { SettingsMenu } from "../ui/SettingsMenu";
import MovementControls from "../game/MovementControls";
import { STRUCTURE_DEFINITIONS, IMPROVEMENT_DEFINITIONS } from "@shared/types/city";
import { UNIT_DEFINITIONS } from "@shared/data/units";
import { getWorldElement, WORLD_ELEMENTS } from "@shared/data/worldElements";
import { useMapToastStore, hexToWorldPos } from "../../lib/stores/useMapToasts";
import { useParticleStore } from "../effects/ParticleEffects";
import { pushCapped, MEMORY_LIMITS } from "../../lib/memoryUtils";
import { useMemoryCleanup, useTurnEndCleanup } from "../../hooks/useMemoryCleanup";
import { requestAutosaveIfDirty } from "../../lib/autosaveManager";
import { useAutosaveStatus } from "../../lib/stores/useAutosaveStatus";
import type { Unit } from "@shared/types/unit";

interface ActiveNotification {
  id: string;
  type: string;
  message: string;
  timestamp: number;
}

export default function GameUI() {
  const isDev = import.meta.env.DEV;
  const { gameState, endTurn, useAbility, attackUnit, setGamePhase, resetGame, loadGameState } = useLocalGame();
  const actionError = useLocalGame((state) => state.actionError);
  const clearActionError = useLocalGame((state) => state.clearActionError);
  const { selectedUnit, setSelectedUnit, constructionMode, cancelConstruction, isRoadBuildMode, cancelRoadBuild, isMovementMode, isAttackMode, setMovementMode, setAttackMode, reachableCoordinates, closeTileContextMenu } = useGameState();
  const [subscribeKeys] = useKeyboardControls();
  const { triggerFlash, showToast } = useVisualFeedback();
  const [showTechPanel, setShowTechPanel] = useState(false);
  const [showCityPanel, setShowCityPanel] = useState(false);
  const [showConstructionHall, setShowConstructionHall] = useState(false);

  useOnlineGameSync();
  const { toasts: mapToasts } = useMapToastStore();
  const addToast = useMapToastStore(state => state.addToast);
  const [activeNotification, setActiveNotification] = useState<ActiveNotification | null>(null);
  const gameLogRef = useRef<any[]>([]);
  const [gameLogEntries, setGameLogEntries] = useState<Array<{
    id: string;
    turn: number;
    playerId: string;
    playerName: string;
    type: string;
    message: string;
    timestamp: number;
  }>>([]);

  // Safety-net cleanup for long sessions (stale particles/map-toasts can linger when tab is backgrounded).
  useMemoryCleanup();
  useTurnEndCleanup(gameState?.turn || 0);

  // Keep latest visual-feedback functions for stable event listeners.
  const visualRef = useRef({ triggerFlash, showToast });
  useEffect(() => {
    visualRef.current = { triggerFlash, showToast };
  }, [triggerFlash, showToast]);

  useEffect(() => {
    if (!actionError) return;
    const type = actionError.level === 'error' ? 'error' : 'warning';
    showToast(actionError.message, type);
    clearActionError();
  }, [actionError, clearActionError, showToast]);

  // Best-effort autosave on lifecycle events (helps avoid catastrophic loss on tab reclaim).
  useEffect(() => {
    const onHide = () => {
      const gs = useLocalGame.getState().gameState;
      if (!gs) return;
      requestAutosaveIfDirty(gs, 'pagehide');
    };

    const onVisibilityChange = () => {
      if (document.hidden) onHide();
    };

    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Dev-only: deterministic long-session simulation helper for memory profiling.
  useEffect(() => {
    if (!isDev) return;
    (window as any).simulateTurns = async (turns: number = 50, delayMs: number = 0) => {
      for (let i = 0; i < turns; i++) {
        const gs = useLocalGame.getState().gameState;
        if (!gs) break;
        const currentPlayerId = gs.players?.[gs.currentPlayerIndex]?.id;
        if (!currentPlayerId) break;
        useLocalGame.getState().dispatch({ type: 'END_TURN', payload: { playerId: currentPlayerId } } as any);
        useGameState.getState().setSelectedUnit(null);
        if (delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          await Promise.resolve();
        }
      }
    };
    return () => {
      try {
        delete (window as any).simulateTurns;
        delete (window as any).getMemoryDebug;
        delete (window as any).assertMemoryCaps;
      } catch {
        (window as any).simulateTurns = undefined;
        (window as any).getMemoryDebug = undefined;
        (window as any).assertMemoryCaps = undefined;
      }
    };
  }, [isDev]);

  // Dev-only: tiny memory dashboard (immediate regression visibility).
  const autosave = useAutosaveStatus();
  const particleCount = useParticleStore((s) => s.events.length);
  const mapToastCount = useMapToastStore((s) => s.toasts.length);
  const heapBytes =
    (isDev && typeof (performance as any)?.memory?.usedJSHeapSize === 'number'
      ? (performance as any).memory.usedJSHeapSize
      : null) as number | null;

  useEffect(() => {
    gameLogRef.current = gameLogEntries;
  }, [gameLogEntries]);

  // Dev-only: expose debug getters/assertions for quick regression checks from console.
  useEffect(() => {
    if (!isDev) return;

    (window as any).getMemoryDebug = () => {
      const particles = useParticleStore.getState().events.length;
      const mapToasts = useMapToastStore.getState().toasts.length;
      const heap =
        typeof (performance as any)?.memory?.usedJSHeapSize === 'number'
          ? (performance as any).memory.usedJSHeapSize
          : null;
      return {
        gameLogEntries: gameLogRef.current.length,
        particles,
        mapToasts,
        heapBytes: heap,
      };
    };

    (window as any).assertMemoryCaps = () => {
      const stats = (window as any).getMemoryDebug?.() ?? {};
      const ok =
        (stats.gameLogEntries ?? 0) <= MEMORY_LIMITS.GAME_LOG_MAX_ENTRIES &&
        (stats.particles ?? 0) <= MEMORY_LIMITS.PARTICLE_MAX_EVENTS &&
        (stats.mapToasts ?? 0) <= MEMORY_LIMITS.MAP_TOAST_MAX_ITEMS;
      if (!ok) {
        // eslint-disable-next-line no-console
        console.warn('[MemoryCaps] Exceeded caps:', stats);
      }
      return { ok, stats };
    };

    return () => {
      try {
        delete (window as any).getMemoryDebug;
        delete (window as any).assertMemoryCaps;
      } catch {
        (window as any).getMemoryDebug = undefined;
        (window as any).assertMemoryCaps = undefined;
      }
    };
  }, [isDev]);

  // Global Event Particle Triggers (Captures, Conversions)
  // Watches gameState.lastAction to trigger effects for both Player and AI
  useEffect(() => {
    if (!gameState?.lastAction) return;

    // Explicitly type the action to avoid 'unknown' errors
    const rootAction: any = gameState.lastAction;
    const { addEvent: addParticle } = useParticleStore.getState();

    const handleAction = (action: any) => {
      if (!action) return;

      if (action.type === 'CAPTURE_CITY') {
        const city = gameState.cities.find(c => c.id === action.payload.cityId);
        if (city) {
          addParticle('combat', city.coordinate);
          // Also show toast if it was the current player
          if (action.payload.playerId === gameState.players[gameState.currentPlayerIndex].id) {
            addToast('City Captured!', 'combat', hexToWorldPos(city.coordinate.q, city.coordinate.r));
            triggerFlash('red');
          }
        }
      } else if (action.type === 'CONVERT_CITY') {
        const city = gameState.cities.find(c => c.id === action.payload.cityId);
        if (city) {
          addParticle('faith', city.coordinate);
          if (action.payload.playerId === gameState.players[gameState.currentPlayerIndex].id) {
            addToast('City Converted!', 'faith', hexToWorldPos(city.coordinate.q, city.coordinate.r));
            triggerFlash('blue');
          }
        }
      } else if (action.type === 'CONVERT_UNIT') {
        const targetUnit = gameState.units.find(u => u.id === action.payload.targetUnitId);
        const success = targetUnit?.playerId === action.payload.playerId;
        const coord = targetUnit?.coordinate;
        const worldPos = coord ? hexToWorldPos(coord.q, coord.r) : { x: 0, y: 0.5, z: 0 };
        if (coord) {
          addParticle('faith', coord);
        }
        if (action.payload.playerId === gameState.players[gameState.currentPlayerIndex].id) {
          if (success) {
            addToast('Unit Converted!', 'faith', worldPos);
            triggerFlash('blue');
          } else {
            addToast('Conversion Failed', 'dissent', worldPos);
            triggerFlash('red');
          }
        }
      } else if (action.type === 'CONQUER_VILLAGE') {
        // Find unit to get location
        const unit = gameState.units.find(u => u.id === action.payload.unitId);
        if (unit) {
          addParticle('capture', unit.coordinate);
          if (action.payload.playerId === gameState.players[gameState.currentPlayerIndex].id) {
            addToast('Village Conquered', 'reward', hexToWorldPos(unit.coordinate.q, unit.coordinate.r));
            triggerFlash('gold');
          }
        }
      } else if (action.type === 'CONVERT_VILLAGE') {
        const unit = gameState.units.find(u => u.id === action.payload.unitId);
        if (unit) {
          addParticle('faith', unit.coordinate);
          if (action.payload.playerId === gameState.players[gameState.currentPlayerIndex].id) {
            addToast('Village Converted', 'faith', hexToWorldPos(unit.coordinate.q, unit.coordinate.r));
            triggerFlash('blue');
          }
        }
      } else if (action.type === 'MORALE_EVENT') {
        const { kind, playerId, starsDelta, cityId } = action.payload || {};
        const cityName = typeof cityId === 'string' ? (gameState.cities.find(c => c.id === cityId)?.name || 'a city') : 'a city';

        if (kind === 'rebellion') {
          triggerFlash('red');
          showToast(`Rebellion! Unrest in ${cityName} (${starsDelta ?? -5}★)`, 'warning');
        } else if (kind === 'desertion') {
          triggerFlash('red');
          showToast(`Desertion! A unit abandoned you (${starsDelta ?? -3}★)`, 'warning');
        } else if (kind === 'contention') {
          triggerFlash('red');
          showToast(`Contention! Wealth lost (${starsDelta ?? -5}★)`, 'warning');
        } else if (kind === 'blessing') {
          triggerFlash('green');
          showToast(`Blessings of humility (+${starsDelta ?? 0}★, +Faith)`, 'success');
        } else {
          showToast(`Morale shifted`, 'info');
        }

        // Log it (best-effort; keep concise)
        const actor = gameState.players.find(p => p.id === playerId);
        if (actor) {
          const message =
            kind === 'rebellion' ? `Rebellion: unrest in ${cityName}` :
              kind === 'desertion' ? `Desertion: a unit abandoned them` :
                kind === 'contention' ? `Contention: lost wealth` :
                  kind === 'blessing' ? `Blessings of humility` : 'Morale event';
          setGameLogEntries(prev => pushCapped(prev, {
            id: `log_${Date.now()}`,
            turn: gameState.turn,
            playerId: actor.id,
            playerName: actor.name,
            type: 'morale',
            message,
            timestamp: Date.now(),
          }, MEMORY_LIMITS.GAME_LOG_MAX_ENTRIES));
        }
      } else if (action.type === 'TESTIMONY_PRESSURE') {
        const currentPlayerId = gameState.players[gameState.currentPlayerIndex].id;
        const affected: Array<{ playerId: string; unitIds: string[] }> = action.payload?.affected || [];
        const myAffected = affected.find(a => a.playerId === currentPlayerId);
        if (myAffected?.unitIds?.length) {
          const penalty = action.payload?.attackPenalty ?? 1;
          const duration = action.payload?.durationTurns ?? 1;
          triggerFlash('blue');
          showToast(`Enemy missionaries weakened ${myAffected.unitIds.length} unit(s) (-${penalty} Attack, ${duration} turn)`, 'warning');
        }
      }
    };

    if (rootAction.type === 'END_TURN_RESOLUTION') {
      const events = rootAction.payload?.events || [];
      events.forEach(handleAction);
      return;
    }

    handleAction(rootAction);
  }, [gameState?.lastAction, gameState?.cities, gameState?.units, addToast, triggerFlash, showToast, gameState?.players, gameState?.currentPlayerIndex]);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [showSaveLoadMenu, setShowSaveLoadMenu] = useState(false);
  const [showAdvancedSaveSystem, setShowAdvancedSaveSystem] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showCitySelector, setShowCitySelector] = useState(false);
  const [citySelectorAction, setCitySelectorAction] = useState<'city_panel' | 'construction'>('city_panel');

  const [selectedWorldElement, setSelectedWorldElement] = useState<{
    elementId: string;
    coordinate: { q: number; r: number; s: number };
    unitId?: string;
  } | null>(null);

  const [selectedVillage, setSelectedVillage] = useState<{
    unitId: string;
    coordinate: { q: number; r: number; s: number };
  } | null>(null);

  const [showDiplomacy, setShowDiplomacy] = useState(false);
  const [ruinsReward, setRuinsReward] = useState<any | null>(null);
  const [showGameLog, setShowGameLog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Local screenFlash state removed in favor of VisualFeedbackProvider

  // Turn transition system
  const { isTransitioning, pendingPlayer, startTransition, completeTransition } = useTurnTransition();

  if (isDev) {
    console.log(
      '[GameUI] Rendering, gameState exists:',
      !!gameState,
      'players:',
      gameState?.players?.length,
      'currentPlayerIndex:',
      gameState?.currentPlayerIndex
    );
  }

  if (!gameState) {
    console.warn('[GameUI] gameState is null, returning null');
    return null;
  }

  const heapMb = heapBytes ? Math.round(heapBytes / (1024 * 1024)) : null;

  // Enable AI opponents
  useAITurn();

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  // Guard against undefined currentPlayer (can happen during turn transitions with 4+ players)
  if (!currentPlayer) {
    console.warn('GameUI: currentPlayer is undefined at index', gameState.currentPlayerIndex);
    return null;
  }

  const faction = getFaction(currentPlayer.factionId as any);

  // Enhanced end turn with transition  
  const handleEndTurn = () => {
    if (!gameState || !currentPlayer) return;

    // Close any open context menu
    closeTileContextMenu();

    const nextPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    const nextPlayer = gameState.players[nextPlayerIndex];

    // Guard against undefined next player
    if (!nextPlayer) {
      console.warn('GameUI: nextPlayer is undefined at index', nextPlayerIndex);
      return;
    }

    // Start turn transition animation
    startTransition(nextPlayer);

    // Complete turn after transition
    setTimeout(() => {
      endTurn(currentPlayer.id); // Pass the current player's ID
      completeTransition();
    }, 1000);
  };

  // Keyboard controls
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.endTurn,
      (pressed) => {
        if (pressed) {
          handleEndTurn();
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys]);

  // Deselect unit with escape
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.cancel,
      (pressed) => {
        if (pressed && selectedUnit) {
          setSelectedUnit(null);
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys, selectedUnit, setSelectedUnit]);

  // Save/Load keyboard shortcut
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.save,
      (pressed) => {
        if (pressed) {
          setShowSaveLoadMenu(true);
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys]);

  // Diplomacy keyboard shortcut
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (state) => state.diplomacy,
      (pressed) => {
        if (pressed) {
          setShowDiplomacy(prev => !prev);
        }
      }
    );
    return unsubscribe;
  }, [subscribeKeys]);

  // Handle world element actions
  const handleWorldElementAction = (actionType: 'harvest' | 'build', unitId: string) => {
    if (!selectedWorldElement) return;

    const action = {
      type: actionType === 'harvest' ? 'WORLD_ELEMENT_HARVEST' : 'WORLD_ELEMENT_BUILD',
      payload: {
        playerId: currentPlayer.id,
        unitId,
        elementId: selectedWorldElement.elementId,
        coordinate: selectedWorldElement.coordinate
      }
    } as any;

    // Dispatch the action through the game reducer
    useLocalGame.getState().dispatch(action);
    setSelectedWorldElement(null);
  };

  // Detect clicks on world element tiles
  useEffect(() => {
    const handleWorldElementClick = (event: CustomEvent) => {
      const gs = useLocalGame.getState().gameState;
      if (!gs) return;
      const player = gs.players?.[gs.currentPlayerIndex];
      if (!player) return;

      if (!event.detail?.coordinate || !Array.isArray(event.detail?.resources)) {
        if (isDev) console.log('⚠️ Invalid world element click event:', event.detail);
        return;
      }

      const { coordinate, resources } = event.detail;
      if (isDev) {
        console.log('🌍 World element click detected:', { coordinate, resources, availableElements: Object.keys(WORLD_ELEMENTS) });
      }

      for (const resource of resources) {
        if (!WORLD_ELEMENTS[resource]) {
          if (isDev) console.log('❌ Resource not in WORLD_ELEMENTS:', resource);
          continue;
        }

        if (isDev) console.log('✅ Setting selected world element:', resource, coordinate);
        const unitsOnTile =
          gs.units?.filter(u =>
            u.playerId === player.id &&
            u.coordinate.q === coordinate.q &&
            u.coordinate.r === coordinate.r &&
            !u.hasAttacked &&
            u.remainingMovement > 0
          ) || [];

        const maybeSelectedUnit = useGameState.getState().selectedUnit;
        const preferredUnitId =
          maybeSelectedUnit &&
          maybeSelectedUnit.playerId === player.id &&
          maybeSelectedUnit.coordinate.q === coordinate.q &&
          maybeSelectedUnit.coordinate.r === coordinate.r &&
          !maybeSelectedUnit.hasAttacked &&
          maybeSelectedUnit.remainingMovement > 0
            ? maybeSelectedUnit.id
            : unitsOnTile[0]?.id;

        setSelectedWorldElement({
          elementId: resource,
          coordinate,
          unitId: preferredUnitId
        });
        return;
      }

      if (isDev) console.log('⚠️ No world elements found in resources:', resources);
    };

    // Listen for world element clicks
    window.addEventListener('worldElementClick', handleWorldElementClick as EventListener);

    return () => {
      window.removeEventListener('worldElementClick', handleWorldElementClick as EventListener);
    };
  }, [isDev]);

  // Handle village capture actions
  const handleVillageCaptureAction = (actionType: 'conquer' | 'convert') => {
    if (!selectedVillage) return;

    const action = {
      type: actionType === 'conquer' ? 'CONQUER_VILLAGE' : 'CONVERT_VILLAGE',
      payload: {
        unitId: selectedVillage.unitId,
        playerId: currentPlayer.id
      }
    } as any;

    // Dispatch the action through the game reducer
    useLocalGame.getState().dispatch(action);
    setSelectedVillage(null);
  };

  // Detect when a unit enters a village
  useEffect(() => {
    const handleVillageEncounter = (event: CustomEvent) => {
      if (event.detail?.unitId && event.detail?.coordinate) {
        const { unitId, coordinate } = event.detail;

        if (isDev) console.log('🏘 Village encounter detected:', { unitId, coordinate });

        // Open village capture panel
        setSelectedVillage({
          unitId,
          coordinate
        });
      }
    };

    // Listen for village encounters
    window.addEventListener('villageEncounter', handleVillageEncounter as EventListener);

    return () => {
      window.removeEventListener('villageEncounter', handleVillageEncounter as EventListener);
    };
  }, []);

  // Handle diplomacy actions
  useEffect(() => {
    const handleDiplomacyAction = (event: CustomEvent) => {
      if (event.detail?.type && event.detail?.payload) {
        const { type, payload } = event.detail;

        if (isDev) console.log('🤝 Diplomacy action:', type, payload);

        const beforeState = useLocalGame.getState().gameState;
        // Dispatch the diplomacy action through the game reducer
        useLocalGame.getState().dispatch({ type, payload } as any);
        const afterState = useLocalGame.getState().gameState;
        const { triggerFlash: flash, showToast: toast } = visualRef.current;

        // Visual feedback based on action type
        if (type === 'DECLARE_WAR') {
          flash('red');
          toast(`War Declared!`, 'combat');
        } else if (type === 'FORM_ALLIANCE') {
          flash('blue');
          toast(`Alliance Formed!`, 'info');
        } else if (type === 'ESTABLISH_TRADE_ROUTE') {
          const beforePlayer = beforeState?.players?.find(p => p.id === payload.playerId);
          const afterPlayer = afterState?.players?.find(p => p.id === payload.playerId);
          const beforeRoutes = beforePlayer?.tradeRoutes || [];
          const afterRoutes = afterPlayer?.tradeRoutes || [];
          const established = afterRoutes.length > beforeRoutes.length;

          if (established) {
            const newRoute = afterRoutes.find(r => !beforeRoutes.some(br =>
              (br.fromCityId === r.fromCityId && br.toCityId === r.toCityId) ||
              (br.fromCityId === r.toCityId && br.toCityId === r.fromCityId)
            ));
            flash('gold');
            toast(
              newRoute ? `Trade Route Established (+${newRoute.starsPerTurn}★/turn)` : `Trade Route Established`,
              'reward'
            );
          } else {
            flash('red');
            toast(`Trade Route Failed`, 'error');
          }
        }

        // Add to game log
        const gs = useLocalGame.getState().gameState;
        const current = gs?.players?.[gs?.currentPlayerIndex ?? 0];
        if (current && gs) {
          const targetPlayer = gs.players.find(p => p.id === payload.targetPlayerId);
          let message = '';
          if (type === 'DECLARE_WAR') {
            message = `Declared war on ${targetPlayer?.name || 'Unknown'}`;
          } else if (type === 'FORM_ALLIANCE') {
            message = `Formed alliance with ${targetPlayer?.name || 'Unknown'}`;
          } else if (type === 'ESTABLISH_TRADE_ROUTE') {
            const beforePlayer = beforeState?.players?.find(p => p.id === payload.playerId);
            const afterPlayer = afterState?.players?.find(p => p.id === payload.playerId);
            const established = (afterPlayer?.tradeRoutes?.length || 0) > (beforePlayer?.tradeRoutes?.length || 0);
            if (!established) return;
            message = 'Established a new trade route';
          }

          const newEntry = {
            id: `log_${Date.now()}`,
            turn: gs.turn,
            playerId: current.id,
            playerName: current.name,
            type: 'diplomacy',
            message,
            timestamp: Date.now(),
          };
          setGameLogEntries(prev => pushCapped(prev, newEntry, MEMORY_LIMITS.GAME_LOG_MAX_ENTRIES));
        }
      }
    };

    window.addEventListener('diplomacyAction', handleDiplomacyAction as EventListener);

    return () => {
      window.removeEventListener('diplomacyAction', handleDiplomacyAction as EventListener);
    };
  }, [isDev]);

  // Handle ruins rewards
  useEffect(() => {
    const handleRuinsReward = (event: CustomEvent) => {
      if (event.detail?.reward) {
        setRuinsReward(event.detail.reward);
        // Trigger screen flash based on reward type
        const reward = event.detail.reward;
        const coordinate = event.detail.coordinate;

        const { triggerFlash: flash, showToast: toast } = visualRef.current;
        if (reward.type === 'curse') {
          flash('red');
          toast('Cursed!', 'combat');
        } else if (reward.rarity === 'legendary') {
          flash('gold');
          toast('Legendary Find!', 'reward');
        } else if (reward.type === 'faith') {
          flash('blue');
          toast('Divine Inspiration', 'info');
        } else {
          flash('gold');
          toast('Ruins Explored', 'reward');
        }

        // Trigger floating map toasts with actual reward values
        if (coordinate) {
          const worldPos = hexToWorldPos(coordinate.q, coordinate.r);
          const { addToast } = useMapToastStore.getState();
          const { addEvent: addParticle } = useParticleStore.getState();

          // Trigger particle burst
          const particleType = reward.type === 'curse' ? 'combat' :
            reward.type === 'faith' ? 'faith' :
              reward.rarity === 'legendary' ? 'discovery' : 'reward';
          addParticle(particleType, coordinate);

          if (reward.stars) {
            addToast(`+${reward.stars} Stars`, 'stars', worldPos);
          }
          if (reward.faith) {
            addToast(`+${reward.faith} Faith`, 'faith', { ...worldPos, y: worldPos.y + 0.3 });
          }
          if (reward.techBoost) {
            addToast(`+${reward.techBoost} Research`, 'tech', { ...worldPos, y: worldPos.y + 0.6 });
          }
          if (reward.healAmount) {
            addToast(`+${reward.healAmount} HP`, 'heal', worldPos);
          }
          if (reward.unitType) {
            addToast(`${reward.unitType} Recruited!`, 'unit', worldPos);
          }
          if (reward.dissent) {
            addToast(`+${reward.dissent} Dissent`, 'dissent', worldPos);
          }
        }

        // Add to game log
        const gs = useLocalGame.getState().gameState;
        const current = gs?.players?.[gs?.currentPlayerIndex ?? 0];
        if (current && gs) {
          const newEntry = {
            id: `log_${Date.now()}`,
            turn: gs.turn,
            playerId: current.id,
            playerName: current.name,
            type: 'resource',
            message: `Explored ruins and found: ${reward.name}`,
            timestamp: Date.now(),
          };
          setGameLogEntries(prev => pushCapped(prev, newEntry, MEMORY_LIMITS.GAME_LOG_MAX_ENTRIES));
        }
      }
    };

    window.addEventListener('ruinsReward', handleRuinsReward as EventListener);

    return () => {
      window.removeEventListener('ruinsReward', handleRuinsReward as EventListener);
    };
  }, []);



  // Check for victory conditions
  useEffect(() => {
    if (gameState?.winner) {
      // Victory screen will be shown
      return;
    }

    // Check faith victory
    const faithWinner = gameState?.players.find(p => p.stats.faith >= 100);
    if (faithWinner) {
      // Set winner and trigger victory screen
      const updatedState = { ...gameState, winner: faithWinner.id };
      // This would ideally be handled by the game reducer
      return;
    }

    // Check elimination victory
    const activePlayers = gameState?.players.filter(p => !p.isEliminated);
    if (activePlayers && activePlayers.length === 1) {
      // Set winner and trigger victory screen
      const updatedState = { ...gameState, winner: activePlayers[0].id };
      // This would ideally be handled by the game reducer
      return;
    }
  }, [gameState]);

  // Remove duplicate - using enhanced version above

  const handleUseAbility = (abilityId: string) => {
    useAbility(currentPlayer.id, abilityId);
  };

  const handleActivateAbility = (abilityId: string, targetId?: string) => {
    // Dispatch the faction ability action through the game store
    const action = {
      type: 'ACTIVATE_FACTION_ABILITY' as const,
      payload: {
        playerId: currentPlayer.id,
        abilityId,
        targetId
      }
    };

    // Get dispatch from useLocalGame store
    const { dispatch } = useLocalGame.getState();
    dispatch(action);
  };

  const handleAttackUnit = (attackerId: string, targetId: string) => {
    attackUnit(attackerId, targetId);
  };

  const handleUnitAction = (action: string) => {
    if (!selectedUnit) return;

    switch (action) {
      case 'attack':
        // Enter attack mode - show attack indicators
        console.log('Attack mode activated');
        setAttackMode(true);
        break;
      case 'move':
        // Enter move mode - show movement indicators  
        console.log('Move mode activated');
        setMovementMode(true);
        break;
      case 'ability':
        // Use unit ability
        console.log('Using unit ability');
        break;
    }
  };

  const handleShowCityPanel = () => {
    const playerCities = gameState.cities?.filter(city =>
      currentPlayer.citiesOwned.includes(city.id)
    ) || [];

    if (playerCities.length === 0) {
      console.log('No cities owned by player');
      return;
    }

    if (playerCities.length === 1) {
      setSelectedCityId(playerCities[0].id);
      setShowCityPanel(true);
    } else {
      setCitySelectorAction('city_panel');
      setShowCitySelector(true);
    }
  };

  const handleShowConstructionHall = () => {
    const playerCities = gameState.cities?.filter(city =>
      currentPlayer.citiesOwned.includes(city.id)
    ) || [];

    if (playerCities.length === 0) {
      console.log('No cities owned by player');
      return;
    }

    if (playerCities.length === 1) {
      setSelectedCityId(playerCities[0].id);
      setShowConstructionHall(true);
    } else {
      setCitySelectorAction('construction');
      setShowCitySelector(true);
    }
  };

  const handleSelectCity = (cityId: string) => {
    setSelectedCityId(cityId);
    setShowCitySelector(false);

    if (citySelectorAction === 'city_panel') {
      setShowCityPanel(true);
    } else {
      setShowConstructionHall(true);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <TileContextMenu />
      {isDev && (
        <div className="fixed bottom-3 left-3 z-[300] rounded-md border border-white/10 bg-black/60 px-3 py-2 text-[11px] text-white/80 backdrop-blur pointer-events-auto">
          <div className="font-semibold text-white/90">Dev Memory</div>
          <div>Log: {gameLogEntries.length}/{MEMORY_LIMITS.GAME_LOG_MAX_ENTRIES}</div>
          <div>Particles: {particleCount}/{MEMORY_LIMITS.PARTICLE_MAX_EVENTS}</div>
          <div>Map toasts: {mapToastCount}/{MEMORY_LIMITS.MAP_TOAST_MAX_ITEMS}</div>
          <div>Autosave: {autosave.isSaving ? 'saving…' : autosave.dirty ? 'dirty' : 'ok'}</div>
          {heapMb !== null && <div>Heap: ~{heapMb} MB</div>}
          {autosave.lastFailureAt && <div className="text-red-200">Autosave failed</div>}
        </div>
      )}
      {/* Construction Mode Indicator - Positioned in top-right corner */}
      {constructionMode.isActive && (
        <div className="absolute top-4 right-4 pointer-events-auto z-50">
          <div className="bg-black/90 text-white px-4 py-3 rounded-lg border-2 border-yellow-400 shadow-lg backdrop-blur-sm max-w-xs">
            <div className="text-center">
              <h3 className="text-sm font-bold mb-1">Construction Mode</h3>
              <p className="text-xs mb-2">Select a tile to build: <span className="font-semibold text-yellow-300">{constructionMode.buildingType}</span></p>
              <button
                onClick={cancelConstruction}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Road Build Mode Indicator */}
      {isRoadBuildMode && (
        <div className="absolute top-4 right-4 pointer-events-auto z-50">
          <div className="bg-black/90 text-white px-4 py-3 rounded-lg border-2 border-amber-400 shadow-lg backdrop-blur-sm max-w-xs">
            <div className="text-center">
              <h3 className="text-sm font-bold mb-1">Road Build Mode</h3>
              <p className="text-xs mb-2">Select an adjacent tile to build a road.</p>
              <button
                onClick={cancelRoadBuild}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-xs text-white font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movement Mode Controls */}
      {isMovementMode && selectedUnit && (
        <MovementControls
          selectedUnit={selectedUnit}
          reachableCount={reachableCoordinates.length}
        />
      )}

      {/* Player HUD */}
      <PlayerHUD
        player={currentPlayer}
        gameState={gameState}
        onShowTechPanel={() => setShowTechPanel(true)}
        onShowConstructionHall={handleShowConstructionHall}
        onShowDiplomacy={() => setShowDiplomacy(true)}
        onEndTurn={handleEndTurn}
      />

      {/* Selected Unit Panel - Unified interface with all unit actions */}
      {selectedUnit && (
        <SelectedUnitPanel unit={selectedUnit} />
      )}

      {/* Combat Panel removed - all functionality consolidated into SelectedUnitPanel */}

      {/* NOTE: Faction Abilities Panel removed - consolidated into unit-specific UnitActionsPanel */}

      {/* Tech Panel Modal */}
      <TechPanel
        open={showTechPanel}
        onClose={() => setShowTechPanel(false)}
      />

      {/* City Panel Modal */}
      {selectedCityId && (
        <CityPanel
          open={showCityPanel}
          onClose={() => setShowCityPanel(false)}
          cityId={selectedCityId as string}
        />
      )}

      {/* Construction Hall */}
      {showConstructionHall && selectedCityId && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setShowConstructionHall(false);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            <BuildingMenu
              city={gameState.cities?.find(c => c.id === selectedCityId)!}
              player={currentPlayer}
              gameState={gameState}
              onBuild={(optionId) => {
                // Handle construction logic
                console.log('Starting construction:', optionId);
                // Determine building category
                let category: 'improvements' | 'structures' | 'units';

                if (Object.values(STRUCTURE_DEFINITIONS).some(s => s.id === optionId)) {
                  category = 'structures';
                } else if (Object.values(UNIT_DEFINITIONS).some(u => u.type === optionId)) {
                  category = 'units';
                } else {
                  category = 'improvements';
                }

                // Use the game state construction system
                const { startConstruction } = useGameState.getState();
                startConstruction(optionId, category, selectedCityId, currentPlayer.id);
                setShowConstructionHall(false);
              }}
              onClose={() => setShowConstructionHall(false)}
              onShowCities={() => {
                setShowConstructionHall(false);
                setShowCityPanel(true);
              }}
            />
          </div>
        </div>
      )}

      {/* City Selector Dialog */}
      {showCitySelector && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCitySelector(false);
            }
          }}
        >
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/40 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-cinzel font-bold text-amber-100 mb-4 text-center">
              Select a City
            </h2>
            <p className="text-amber-200/70 text-sm text-center mb-4">
              {citySelectorAction === 'city_panel' ? 'Choose a city to view' : 'Choose a city for construction'}
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gameState.cities?.filter(city =>
                currentPlayer.citiesOwned.includes(city.id)
              ).map(city => (
                <button
                  key={city.id}
                  onClick={() => handleSelectCity(city.id)}
                  className="w-full p-3 bg-amber-900/30 hover:bg-amber-700/40 border border-amber-500/30 hover:border-amber-500/60 rounded-lg transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-amber-100">{city.name}</div>
                      <div className="text-xs text-amber-300/70">
                        Population: {city.population} | Level: {city.level}
                      </div>
                    </div>
                    <div className="text-amber-400 text-sm">
                      +{city.starProduction} ⭐/turn
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowCitySelector(false)}
              className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Victory Screen */}
      {gameState?.winner && (
        <VictoryScreen
          winnerId={gameState.winner}
          victoryType="faith" // This would be determined by victory conditions
          onPlayAgain={() => {
            resetGame();
            setGamePhase('menu');
          }}
          onMainMenu={() => {
            resetGame();
            setGamePhase('menu');
          }}
        />
      )}

      {/* Save/Load Menu */}
      {showSaveLoadMenu && (
        <SaveLoadMenu
          onClose={() => setShowSaveLoadMenu(false)}
        />
      )}

      {/* World Element Panel */}
      {selectedWorldElement && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setSelectedWorldElement(null);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            <WorldElementPanel
              gameState={gameState}
              playerId={currentPlayer.id}
              elementId={selectedWorldElement.elementId}
              coordinate={selectedWorldElement.coordinate}
              unitId={selectedWorldElement.unitId}
              onAction={handleWorldElementAction}
              onClose={() => setSelectedWorldElement(null)}
            />
          </div>
        </div>
      )}

      {/* Village Capture Panel */}
      {selectedVillage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setSelectedVillage(null);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ pointerEvents: 'auto' }}
          >
            <VillageCapturePanel
              gameState={gameState}
              playerId={currentPlayer.id}
              unitId={selectedVillage.unitId}
              coordinate={selectedVillage.coordinate}
              onAction={handleVillageCaptureAction}
              onClose={() => setSelectedVillage(null)}
            />
          </div>
        </div>
      )}

      {/* Diplomacy Panel */}
      {showDiplomacy && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm pointer-events-auto">
          <DiplomacyPanel
            gameState={gameState}
            currentPlayerId={currentPlayer.id}
            onClose={() => setShowDiplomacy(false)}
          />
        </div>
      )}

      {/* Ruins Reward Panel */}
      <RuinsRewardPanel
        reward={ruinsReward}
        onClose={() => setRuinsReward(null)}
      />

      {/* Game Log Panel */}
      <GameLogPanel
        entries={gameLogEntries as any}
        currentTurn={gameState?.turn || 1}
        isOpen={showGameLog}
        onToggle={() => setShowGameLog(!showGameLog)}
      />

      {/* Screen Flash Effect */}
      {/* Screen Flash Effect handled by Provider */}

      {/* Advanced Save System */}
      {showAdvancedSaveSystem && (
        <SaveSystem
          currentGameState={gameState}
          onLoadGame={(loadedState) => {
            loadGameState(loadedState);
            setShowAdvancedSaveSystem(false);
          }}
          onClose={() => setShowAdvancedSaveSystem(false)}
        />
      )}

      {/* Turn Transition Animation */}
      <TurnTransition
        isVisible={isTransitioning}
        currentPlayer={pendingPlayer || currentPlayer}
        onComplete={completeTransition}
      />

      {/* Enhanced Unit Selection UI */}
      <UnitSelectionUI
        selectedUnit={selectedUnit}
        onUnitAction={handleUnitAction}
      />

      {/* Touch-friendly Save/Load Buttons - Bottom Right */}
      <div className="pointer-events-auto fixed bottom-6 right-6 flex flex-col gap-2">
        <button
          className="p-3 min-w-[48px] min-h-[48px] bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-lg border border-slate-600 transition-all shadow-lg flex items-center justify-center gap-2"
          onClick={() => setShowSettings(true)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setShowSettings(true);
          }}
          title="Settings"
        >
          <span className="text-lg">⚙️</span>
          <span className="text-sm font-medium">Settings</span>
        </button>
        <button
          className="p-3 min-w-[48px] min-h-[48px] bg-amber-700 hover:bg-amber-600 active:bg-amber-500 text-white rounded-lg border border-amber-500/60 transition-all shadow-lg flex items-center justify-center gap-2"
          onClick={() => setShowSaveLoadMenu(true)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setShowSaveLoadMenu(true);
          }}
          title="Save/Load Game (S)"
        >
          <span className="text-lg">💾</span>
          <span className="text-sm font-medium">Save/Load</span>
        </button>
        <button
          className="p-3 min-w-[48px] min-h-[48px] bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-lg border border-slate-600 transition-all shadow-lg flex items-center justify-center gap-2"
          onClick={() => setShowAdvancedSaveSystem(true)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setShowAdvancedSaveSystem(true);
          }}
          title="Advanced Save System"
        >
          <span className="text-lg">📁</span>
          <span className="text-sm font-medium">Advanced</span>
        </button>
      </div>

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
