import type { GameState, PlayerState } from "../types/game";
import { GAME_RULES } from "../data/gameRules";
import { getFaction } from "../data/factions";
import { getUnitDefinition } from "../data/units";
import { coerceFactionId } from "../types/factionId";
import { getCulturalPressureSelection } from "../logic/culturalPressure";
import { explainFactionAbilityAction } from "../logic/ruleQueries";
import { getTestimonyPressureSelection } from "../logic/testimonyPressure";
import { hexDistance } from "../utils/hex";

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
  const factionId = coerceFactionId(aiPlayer.factionId);
  const faction = factionId ? getFaction(factionId) : undefined;
  const activeAbilityIds = faction?.abilities
    .filter(ability => ability.type === "active")
    .map(ability => ability.id) ?? [];

  const canUse = (abilityId: string) => {
    const { availability, check } = explainFactionAbilityAction(gameState, aiPlayer.id, abilityId);
    return availability.available && check.legal ? availability : undefined;
  };

  const ownedUnits = gameState.units.filter(unit => unit.playerId === aiPlayer.id);
  const visibleEnemyUnits = gameState.units.filter(unit => {
    if (unit.playerId === aiPlayer.id) return false;
    if (aiPlayer.alliedWith?.includes(unit.playerId)) return false;
    const key = `${unit.coordinate.q},${unit.coordinate.r}`;
    if ((aiPlayer.visibilityMask ?? []).length > 0) return aiPlayer.visibilityMask?.includes(key);
    if (aiPlayer.exploredTiles?.includes(key)) return true;
    return gameState.map.tiles.some(tile =>
      tile.coordinate.q === unit.coordinate.q &&
      tile.coordinate.r === unit.coordinate.r &&
      tile.exploredBy?.includes(aiPlayer.id)
    );
  });

  if (activeAbilityIds.includes("TITLE_OF_LIBERTY")) {
    const title = canUse("TITLE_OF_LIBERTY");
    if (title?.available) {
      const bestCoverage = ownedUnits.reduce((best, source) => {
        const coverage = ownedUnits.filter(unit => hexDistance(unit.coordinate, source.coordinate) <= (title.spec.target.range ?? 3)).length;
        return Math.max(best, coverage);
      }, 0);
      const combatNear = visibleEnemyUnits.some(enemy =>
        ownedUnits.some(unit => hexDistance(unit.coordinate, enemy.coordinate) <= 3)
      );
      if (bestCoverage >= 3 && (combatNear || aiPlayer.stats.faith >= 90)) {
        decisions.push({
          type: "USE_ABILITY",
          abilityId: "TITLE_OF_LIBERTY",
          priority: 64 + bestCoverage * 7 + (combatNear ? 12 : 0),
        });
      }
    }
  }

  if (activeAbilityIds.includes("WARRIOR_RAGE")) {
    const rage = canUse("WARRIOR_RAGE");
    if (rage?.available) {
      const engagedUnits = ownedUnits.filter(unit =>
        visibleEnemyUnits.some(enemy => hexDistance(unit.coordinate, enemy.coordinate) <= 2)
      ).length;
      if (engagedUnits >= 2 || (engagedUnits >= 1 && aiPlayer.stats.pride >= 85)) {
        decisions.push({
          type: "USE_ABILITY",
          abilityId: "WARRIOR_RAGE",
          priority: 66 + engagedUnits * 8,
        });
      }
    }
  }

  if (activeAbilityIds.includes("lamanite_guerrilla_tactics")) {
    const guerrilla = canUse("lamanite_guerrilla_tactics");
    if (guerrilla?.available) {
      const forestUnits = ownedUnits.filter(unit =>
        gameState.map.tiles.some(tile =>
          tile.terrain === "forest" &&
          tile.coordinate.q === unit.coordinate.q &&
          tile.coordinate.r === unit.coordinate.r
        )
      ).length;
      if (forestUnits > 0) {
        decisions.push({
          type: "USE_ABILITY",
          abilityId: "lamanite_guerrilla_tactics",
          priority: 42 + forestUnits * 4,
        });
      }
    }
  }

  if (activeAbilityIds.includes("COVENANT_OF_PEACE")) {
    const covenant = canUse("COVENANT_OF_PEACE");
    if (covenant?.available) {
      const range = GAME_RULES.conversion.covenantOfPeace.range;
      const targetCount = visibleEnemyUnits.filter(enemy =>
        ownedUnits.some(unit => hexDistance(unit.coordinate, enemy.coordinate) <= range)
      ).length;
      if (targetCount > 0) {
        decisions.push({
          type: "USE_ABILITY",
          abilityId: "COVENANT_OF_PEACE",
          priority: 70 + targetCount * 6,
        });
      }
    }
  }

  if (activeAbilityIds.includes("MISSIONARY_ZEAL")) {
    const missionaryZeal = canUse("MISSIONARY_ZEAL");
    if (missionaryZeal?.available) {
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
    }
  }

  if (activeAbilityIds.includes("CULTURAL_RECLAMATION")) {
    const cultural = canUse("CULTURAL_RECLAMATION");
    if (cultural?.available) {
      const selection = getCulturalPressureSelection(
        gameState,
        aiPlayer.id,
        cultural.spec.target.range ?? GAME_RULES.abilities.factionActive.culturalReclamation.range,
        { requireTargetVisibility: true }
      );
      const valuableTargets = selection.targetUnits.filter(unit => {
        const def = getUnitDefinition(unit.type);
        return (def?.cost ?? 0) >= 5 || unit.hp >= 10;
      }).length;
      if (selection.targetUnits.length >= 2 || (valuableTargets >= 1 && aiPlayer.stats.faith >= 70)) {
        decisions.push({
          type: "USE_ABILITY",
          abilityId: "CULTURAL_RECLAMATION",
          priority: 62 + selection.targetUnits.length * 7 + valuableTargets * 4,
        });
      }
    }
  }

  if (activeAbilityIds.includes("RAMEUMPTOM")) {
    const rameumptom = canUse("RAMEUMPTOM");
    if (rameumptom?.available && aiPlayer.stats.internalDissent <= 65) {
      const economyBase = aiPlayer.stars + aiPlayer.citiesOwned.length * 4;
      if (economyBase >= 12 || aiPlayer.stats.pride >= 90) {
        decisions.push({
          type: "USE_ABILITY",
          abilityId: "RAMEUMPTOM",
          priority: 54 + Math.min(24, economyBase),
        });
      }
    }
  }

  if (activeAbilityIds.includes("ANCIENT_MIGHT")) {
    const ancientMight = canUse("ANCIENT_MIGHT");
    if (ancientMight?.available && aiPlayer.stats.pride <= 82) {
      const contestedUnits = ownedUnits.filter(unit =>
        visibleEnemyUnits.some(enemy => hexDistance(unit.coordinate, enemy.coordinate) <= 3)
      ).length;
      if (ownedUnits.length >= 3 && (contestedUnits >= 2 || aiPlayer.atWarWith?.length > 0)) {
        decisions.push({
          type: "USE_ABILITY",
          abilityId: "ANCIENT_MIGHT",
          priority: 60 + ownedUnits.length * 4 + contestedUnits * 6,
        });
      }
    }
  }

  return decisions;
}
