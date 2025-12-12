import { GameState, Player } from '../../../shared/types/game';

export interface PlayerStats {
  faithPercentage: number;
  pridePercentage: number;
  dissentPercentage: number;
  cityCount: number;
  techCount: number;
  starProduction: number;
  starProductionBreakdown: Array<{ source: string; amount: number }>;
}

export function getPlayerStats(player: Player, gameState: GameState): PlayerStats {
  const breakdown: Array<{ source: string; amount: number }> = [];
  let totalStarProduction = 1; // Base production

  // Base production
  breakdown.push({ source: 'Base', amount: 1 });

  // Cities production
  let cityStars = 0;
  player.citiesOwned.forEach(cityId => {
    const city = gameState.cities.find(c => c.id === cityId);
    if (city) {
      cityStars += city.population;
      totalStarProduction += city.population;
    }
  });

  if (cityStars > 0) {
    breakdown.push({ source: `Cities (${player.citiesOwned.length})`, amount: cityStars });
  }

  // Improvements production
  const playerImprovements = gameState.improvements?.filter(imp => imp.ownerId === player.id) || [];
  let improvementStars = 0;
  playerImprovements.forEach(improvement => {
    if (improvement.constructionTurns === 0) {
      improvementStars += improvement.effects.starProduction;
      totalStarProduction += improvement.effects.starProduction;
    }
  });

  if (improvementStars > 0) {
    breakdown.push({ source: `Improvements (${playerImprovements.length})`, amount: improvementStars });
  }

  // Structures production - simplified for now
  // Would need actual structure system integration

  return {
    faithPercentage: player.stats.faith,
    pridePercentage: player.stats.pride,
    dissentPercentage: player.stats.internalDissent,
    cityCount: player.citiesOwned.length,
    techCount: player.researchedTechs.length,
    starProduction: totalStarProduction,
    starProductionBreakdown: breakdown
  };
}