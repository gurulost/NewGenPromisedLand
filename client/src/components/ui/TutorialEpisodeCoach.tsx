import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Compass, RotateCcw, X } from "lucide-react";
import type { GameState } from "@shared/types/game";
import type { HexCoordinate } from "@shared/types/coordinates";
import { hexDistance } from "@shared/utils/hex";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useGameState } from "../../lib/stores/useGameState";
import { useMapPulseStore } from "../effects/MapPulseEffects";
import { Button } from "./button";
import { cn } from "@/lib/utils";

type StepId =
  | "arrival"
  | "move"
  | "ruins"
  | "research_org"
  | "recruit_worker"
  | "research_agri"
  | "end_turn_worker"
  | "grain_choice"
  | "combat"
  | "village"
  | "epilogue";

const STEP_ORDER: StepId[] = [
  "arrival",
  "move",
  "ruins",
  "research_org",
  "recruit_worker",
  "research_agri",
  "end_turn_worker",
  "grain_choice",
  "combat",
  "village",
  "epilogue",
];

const MARKERS = {
  ruinRewardPrefix: "tutorial:episode1:ruin_reward:",
  grainPatch: "tutorial:episode1:grain_patch_target",
  village: "tutorial:episode1:village_target",
} as const;

interface TutorialEpisodeCoachProps {
  gameState: GameState;
  currentPlayerId: string;
  isLocalHumanTurn: boolean;
  onOpenTech: () => void;
  onOpenBuildMenu: () => void;
}

interface Targets {
  ruin?: HexCoordinate;
  grainPatch?: HexCoordinate;
  village?: HexCoordinate;
  enemy?: HexCoordinate;
}

const findTile = (state: GameState, coord: HexCoordinate | undefined) => {
  if (!coord) return null;
  return state.map.tiles.find(
    (t) => t.coordinate.q === coord.q && t.coordinate.r === coord.r
  ) ?? null;
};

export function TutorialEpisodeCoach({
  gameState,
  currentPlayerId,
  isLocalHumanTurn,
  onOpenTech,
  onOpenBuildMenu,
}: TutorialEpisodeCoachProps) {
  const resetGame = useLocalGame((s) => s.resetGame);
  const startTutorialEpisode = useLocalGame((s) => s.startTutorialEpisode);
  const addPulse = useMapPulseStore((s) => s.addPulse);
  const selectedUnit = useGameState((s) => s.selectedUnit);
  const setSelectedUnit = useGameState((s) => s.setSelectedUnit);

  const player = useMemo(
    () => gameState.players.find((p) => p.id === currentPlayerId) ?? null,
    [gameState.players, currentPlayerId]
  );

  const [isSkipped, setIsSkipped] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targets, setTargets] = useState<Targets>({});
  const [hasMoved, setHasMoved] = useState(false);
  const [hasAttacked, setHasAttacked] = useState(false);

  // Reset coach per new tutorial game.
  // Intentionally keyed off gameState.id so progress isn't reset on every action.
  useEffect(() => {
    setIsSkipped(false);
    setStepIndex(0);
    setHasMoved(false);
    setHasAttacked(false);

    const ruinTile = gameState.map.tiles.find(
      (t) => (t.resources || []).includes("jaredite_ruins") &&
        (t.resources || []).some((r) => String(r).startsWith(MARKERS.ruinRewardPrefix))
    );
    const grainTile = gameState.map.tiles.find(
      (t) => (t.resources || []).includes("grain_patch") &&
        (t.resources || []).some((r) => String(r) === MARKERS.grainPatch)
    );
    const villageTile = gameState.map.tiles.find(
      (t) => t.feature === "village" &&
        (t.resources || []).some((r) => String(r) === MARKERS.village)
    );

    let enemy: HexCoordinate | undefined;
    if (villageTile) {
      const nearby = gameState.units
        .filter((u) => u.playerId !== currentPlayerId)
        .map((u) => ({ unit: u, d: hexDistance(u.coordinate, villageTile.coordinate) }))
        .sort((a, b) => a.d - b.d)[0];
      if (nearby && nearby.d <= 2) enemy = nearby.unit.coordinate;
    }

    setTargets({
      ruin: ruinTile?.coordinate,
      grainPatch: grainTile?.coordinate,
      village: villageTile?.coordinate,
      enemy,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.id, currentPlayerId]);

  useEffect(() => {
    const last = gameState.lastAction as any;
    if (!last || !player) return;

    if (last.type === "MOVE_UNIT") {
      const movedUnit = gameState.units.find((u) => u.id === last.payload?.unitId);
      if (movedUnit?.playerId === player.id) setHasMoved(true);
    }

    if (last.type === "ATTACK_UNIT") {
      const attacker = gameState.units.find((u) => u.id === last.payload?.attackerId);
      if (attacker?.playerId === player.id) setHasAttacked(true);
    }
  }, [gameState.lastAction, gameState.units, player]);

  const stepId = STEP_ORDER[Math.max(0, Math.min(stepIndex, STEP_ORDER.length - 1))];

  const isComplete = useMemo(() => {
    if (!player) return false;

    switch (stepId) {
      case "arrival":
        return false;
      case "move":
        return hasMoved;
      case "ruins": {
        const tile = findTile(gameState, targets.ruin);
        // If the tile no longer exists (unlikely) or the ruins resource is gone, we count it as explored.
        return !tile || !(tile.resources || []).includes("jaredite_ruins");
      }
      case "research_org":
        return player.researchedTechs.includes("organization");
      case "recruit_worker":
        return Boolean(
          (player.constructionQueue || []).some((item) => item.category === "units" && item.type === "worker") ||
          gameState.units.some((u) => u.playerId === player.id && u.type === "worker")
        );
      case "research_agri":
        return player.researchedTechs.includes("agriculture");
      case "end_turn_worker":
        return gameState.units.some((u) => u.playerId === player.id && u.type === "worker");
      case "grain_choice": {
        const tile = findTile(gameState, targets.grainPatch);
        if (!tile) return true;
        const resources = tile.resources || [];
        const hasBuildMarker = resources.some((r) => String(r).startsWith("we:grain_patch:"));
        const harvested = !resources.includes("grain_patch");
        return hasBuildMarker || harvested;
      }
      case "combat":
        return hasAttacked;
      case "village": {
        const tile = findTile(gameState, targets.village);
        if (!tile) return false;
        return tile.cityOwner === player.id;
      }
      case "epilogue":
        return false;
      default:
        return false;
    }
  }, [gameState, hasMoved, hasAttacked, player, stepId, targets.grainPatch, targets.ruin, targets.village]);

  // Auto-advance on completion for action steps.
  useEffect(() => {
    if (isSkipped) return;
    if (stepId === "arrival" || stepId === "epilogue") return;
    if (!isComplete) return;
    setStepIndex((prev) => Math.min(prev + 1, STEP_ORDER.length - 1));
  }, [isComplete, isSkipped, stepId]);

  const selectMyWarrior = () => {
    if (!player) return;
    const warrior = gameState.units.find((u) => u.playerId === player.id && u.type === "warrior");
    if (warrior) setSelectedUnit(warrior as any);
  };

  const selectMyWorkerIfReady = () => {
    if (!player) return;
    const worker = gameState.units.find((u) => u.playerId === player.id && u.type === "worker");
    if (worker) setSelectedUnit(worker as any);
  };

  const pulseAt = (coord: HexCoordinate | undefined, type: "tech" | "unit" | "construction" | "levelup" = "tech") => {
    if (!coord) return;
    addPulse(type, { q: coord.q, r: coord.r });
  };

  const showMe = () => {
    if (!player) return;
    switch (stepId) {
      case "arrival":
        selectMyWarrior();
        break;
      case "move":
        selectMyWarrior();
        pulseAt(targets.ruin, "tech");
        break;
      case "ruins":
        selectMyWarrior();
        pulseAt(targets.ruin, "tech");
        break;
      case "research_org":
        onOpenTech();
        break;
      case "recruit_worker":
        onOpenBuildMenu();
        break;
      case "research_agri":
        onOpenTech();
        break;
      case "end_turn_worker":
        // We can’t spotlight the button reliably, so we keep the focus on the city & the queue.
        pulseAt(player.citiesOwned?.length ? gameState.cities.find(c => c.id === player.citiesOwned[0])?.coordinate : undefined, "construction");
        break;
      case "grain_choice":
        selectMyWorkerIfReady();
        pulseAt(targets.grainPatch, "construction");
        break;
      case "combat":
        selectMyWarrior();
        pulseAt(targets.enemy ?? targets.village, "unit");
        break;
      case "village":
        selectMyWarrior();
        pulseAt(targets.village, "levelup");
        break;
      case "epilogue":
        break;
      default:
        break;
    }
  };

  if (!gameState.id.startsWith("tutorial-episode-")) return null;
  if (!player) return null;

  if (isSkipped) {
    return (
      <div className="pointer-events-none fixed right-4 top-4 z-[210]">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-slate-950/80 px-3 py-2 text-xs text-amber-100 shadow-lg shadow-black/40 backdrop-blur">
          <span className="font-cinzel">Tutorial Episode</span>
          <span className="text-amber-200/40">•</span>
          <span className="text-amber-200/70">Guidance skipped</span>
          <div className="ml-2 flex items-center gap-1">
            <Button
              variant="outline"
              className="h-7 border-amber-500/30 bg-amber-500/10 px-2 text-amber-100 hover:bg-amber-500/20"
              onClick={() => startTutorialEpisode()}
              title="Restart tutorial episode"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              className="h-7 border-amber-500/30 bg-amber-500/10 px-2 text-amber-100 hover:bg-amber-500/20"
              onClick={() => resetGame()}
              title="Exit to main menu"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const title = (() => {
    switch (stepId) {
      case "arrival":
        return "Arrival: The Covenant and the Land";
      case "move":
        return "First Steps: Movement & Fog of War";
      case "ruins":
        return "Ancient Sign: A Jaredite Ruin";
      case "research_org":
        return "Order: Research Organization";
      case "recruit_worker":
        return "Stewardship: Recruit a Worker";
      case "research_agri":
        return "Harvest Wisdom: Research Agriculture";
      case "end_turn_worker":
        return "Time Passes: End Turn";
      case "grain_choice":
        return "The First Moral Choice: Grain Patch";
      case "combat":
        return "Conflict at the Edge: Combat";
      case "village":
        return "Village Decision: Conquer or Convert";
      case "epilogue":
        return "Epilogue: Your Record Begins";
      default:
        return "Tutorial Episode";
    }
  })();

  const body = (() => {
    switch (stepId) {
      case "arrival":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              You have entered a land of promise. Prosperity will test your covenant.
              Build wisely, and let faith govern the shape of your power.
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              This guide is optional and never blocks play. It will point you to the next meaningful action — and then
              get out of your way.
            </p>
          </>
        );
      case "move":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              Select your Warrior and move into the fog. New tiles become visible — but only while you can see them.
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              Tip: Movement is a resource. Spend it to reveal the map and choose where your story begins.
            </p>
          </>
        );
      case "ruins":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              An ancient Jaredite ruin waits beyond the fog. Move onto the ruin and choose <span className="text-amber-200">Explore</span>.
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              This tutorial ruin is fixed: you will gain <span className="text-amber-200">+1 Faith</span> and find a cache of{" "}
              <span className="text-amber-200">15 Stars</span>.
            </p>
          </>
        );
      case "research_org":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              Open <span className="text-amber-200">Knowledge</span> and research{" "}
              <span className="text-amber-200">Organization</span>. Tech costs Stars, but unlocks your future.
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              Organization unlocks Workers — the hands that turn a wilderness into a home.
            </p>
          </>
        );
      case "recruit_worker":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              Open <span className="text-amber-200">Build</span> and recruit a{" "}
              <span className="text-amber-200">Worker</span>, then choose a spawn tile near your city. Units take a turn
              to arrive.
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              A Worker is not a soldier — it is your ability to shape the map: roads, improvements, and moral choices.
            </p>
          </>
        );
      case "research_agri":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              Return to <span className="text-amber-200">Knowledge</span> and research{" "}
              <span className="text-amber-200">Agriculture</span>. This unlocks Grain Patch actions.
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              More power is not always more peace — watch Pride and Dissent.
            </p>
          </>
        );
      case "end_turn_worker":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              End your turn. When the Worker is ready, you can guide them to the Grain Patch and decide what kind of
              prosperity you seek.
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              In this episode, the opposing side will not act — you can learn without being rushed.
            </p>
          </>
        );
      case "grain_choice":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              Move your Worker onto the <span className="text-amber-200">Grain Patch</span>. Choose:
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              <span className="text-amber-200">Gather Harvest</span>: immediate growth, but Pride + Dissent rise.
            </p>
            <p className="text-sm text-amber-100/70">
              <span className="text-amber-200">Build Field</span>: costs Stars now, but grants Faithful stewardship.
            </p>
          </>
        );
      case "combat":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              A patrol stands near a village. Select your Warrior and make a single attack to learn terrain, range, and
              retaliation.
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              You don&apos;t need perfection here — you need to see how combat feels, then decide when it&apos;s worth it.
            </p>
          </>
        );
      case "village":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              Step onto the village and choose how to bring them into your fold:
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              <span className="text-amber-200">Conquer</span>: immediate Stars, but Pride and Dissent rise.
            </p>
            <p className="text-sm text-amber-100/70">
              <span className="text-amber-200">Convert</span>: costs Faith, but shapes a steadier peace.
            </p>
          </>
        );
      case "epilogue":
        return (
          <>
            <p className="text-sm text-amber-100/90">
              You&apos;ve completed the guided episode. From here, the land is yours to write.
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              If you ever forget a system, the <span className="text-amber-200">?</span> help icons and Tutorial Library
              remain available.
            </p>
          </>
        );
      default:
        return null;
    }
  })();

  const showSkipBig = stepId === "arrival";

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[210] w-[min(420px,calc(100vw-2rem))]">
      <motion.div
        className="pointer-events-auto rounded-2xl border border-amber-500/35 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-950/90 shadow-2xl shadow-black/60 backdrop-blur"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-amber-500/20 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-amber-300/70">
              <BookOpen className="h-4 w-4" />
              Tutorial Episode
              <span className="text-amber-200/40">•</span>
              <span className="text-amber-200/60">
                Step {Math.min(stepIndex + 1, STEP_ORDER.length)}/{STEP_ORDER.length}
              </span>
            </div>
            <div className="mt-1 truncate font-cinzel text-base text-amber-100">
              {title}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8 border-amber-500/30 bg-amber-500/10 px-2 text-amber-100 hover:bg-amber-500/20"
              onClick={() => startTutorialEpisode()}
              title="Restart tutorial episode"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 border-amber-500/30 bg-amber-500/10 px-2 text-amber-100 hover:bg-amber-500/20"
              onClick={() => resetGame()}
              title="Exit to main menu"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 py-4 text-amber-100">
          {body}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className={cn(
                "border-amber-500/40 text-amber-100 hover:bg-amber-500/20",
                !isLocalHumanTurn && "opacity-60"
              )}
              onClick={() => showMe()}
              disabled={!isLocalHumanTurn}
              title={!isLocalHumanTurn ? "Wait for your turn" : "Show me where to focus"}
            >
              <Compass className="mr-2 h-4 w-4" />
              Show Me
            </Button>

            <Button
              className={cn(
                "bg-amber-600 text-amber-50 hover:bg-amber-500",
                stepId !== "arrival" && stepId !== "epilogue" && !isComplete && "opacity-70"
              )}
              onClick={() => {
                if (stepId === "arrival" || stepId === "epilogue") {
                  if (stepId === "epilogue") {
                    setIsSkipped(true);
                    return;
                  }
                  setStepIndex((prev) => Math.min(prev + 1, STEP_ORDER.length - 1));
                  return;
                }
                // Manual advance is allowed (non-blocking), but we keep visual feedback.
                setStepIndex((prev) => Math.min(prev + 1, STEP_ORDER.length - 1));
              }}
            >
              {stepId === "arrival" ? "Begin" : stepId === "epilogue" ? "Close" : "Next"}
            </Button>

            {showSkipBig ? (
              <div className="ml-auto flex flex-col items-end gap-1">
                <Button
                  variant="destructive"
                  className="h-9 px-4"
                  onClick={() => setIsSkipped(true)}
                >
                  Skip Guidance
                </Button>
                <div className="text-[11px] text-red-200/70">
                  Skips this episode&apos;s prompts for this run only.
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="ml-auto text-xs text-amber-200/70 underline decoration-amber-400/20 underline-offset-4 transition hover:text-amber-100"
                onClick={() => setIsSkipped(true)}
                title="Stop showing tutorial episode prompts"
              >
                Skip guidance
              </button>
            )}
          </div>

          {selectedUnit && (
            <div className="mt-3 text-[11px] text-amber-200/60">
              Selected: <span className="text-amber-100/80">{selectedUnit.type}</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default TutorialEpisodeCoach;
