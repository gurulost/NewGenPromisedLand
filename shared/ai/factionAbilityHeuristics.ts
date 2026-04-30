import type { GameState, PlayerState } from "../types/game";
import { getFactionAbilityAvailability } from "../logic/factionAbilityAvailability";
import { getTestimonyPressureSelection } from "../logic/testimonyPressure";

export interface AIFactionAbilityDecision {
  type: "USE_ABILITY";
  abilityId: string;
  priority: number;
}

export function evaluateAIFactionAbilityUsage(
  gameState: GameState,
  aiPlayer: PlayerState
): AIFactionAbilityDecision[] {
  const decisions: AIFactionAbilityDecision[] = [];
  const missionaryZeal = getFactionAbilityAvailability(gameState, aiPlayer.id, "MISSIONARY_ZEAL");

  if (!missionaryZeal.available) return decisions;

  const selection = getTestimonyPressureSelection(
    gameState,
    aiPlayer.id,
    missionaryZeal.spec.target.range ?? 4,
    { requireTargetVisibility: true }
  );
  const affectedCount = selection.targetUnits.length;
  const rallyBreakCount = selection.targetUnits.filter(unit =>
    unit.status === "rallied" || unit.rallyBuff || unit.tacticalCommand
  ).length;

  if (affectedCount >= 2 || (affectedCount >= 1 && aiPlayer.stats.faith >= 95)) {
    decisions.push({
      type: "USE_ABILITY",
      abilityId: "MISSIONARY_ZEAL",
      priority: 68 + affectedCount * 8 + rallyBreakCount * 6,
    });
  }

  return decisions;
}
