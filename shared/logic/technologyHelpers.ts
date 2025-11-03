import { TECHNOLOGIES, type Technology, calculateResearchCost } from "../data/technologies";
import { GameRuleHelpers } from "../data/gameRules";
import type { PlayerState } from "../types/game";

export function getTechnology(techId: string): Technology | undefined {
  return TECHNOLOGIES[techId];
}

export function playerHasTechPrerequisites(player: PlayerState, technology: Technology): boolean {
  return technology.prerequisites.every(prereq => player.researchedTechs.includes(prereq));
}

export function getTechCostDetails(technology: Technology, player: PlayerState): { baseCost: number; discount: number; finalCost: number } {
  const baseCost = calculateResearchCost(technology, player.researchedTechs.length);
  const inspiration = GameRuleHelpers.clampInspiration(player.researchInspiration ?? 0);
  const maxDiscount = Math.max(0, baseCost - 1);
  const discount = Math.min(inspiration, maxDiscount);
  const finalCost = Math.max(1, baseCost - discount);
  return { baseCost, discount, finalCost };
}

export function getEffectiveTechCostForPlayer(technology: Technology, player: PlayerState): number {
  return getTechCostDetails(technology, player).finalCost;
}

export function canPlayerResearchTechnology(player: PlayerState, technology: Technology): boolean {
  if (player.researchedTechs.includes(technology.id)) {
    return false;
  }
  if (!playerHasTechPrerequisites(player, technology)) {
    return false;
  }
  const { finalCost } = getTechCostDetails(technology, player);
  return player.stars >= finalCost;
}
