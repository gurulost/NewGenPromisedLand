import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { Button } from "./button";
import { Star, Book, Building, TrendingUp, Info, Hammer } from "lucide-react";
import type { PlayerState, GameState } from "@shared/types/game";
import type { Faction } from "@shared/types/faction";
import { GAME_RULES, GameRuleHelpers } from "@shared/data/gameRules";
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from "@shared/types/city";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { InfoTooltip, StarProductionTooltip, FaithSystemTooltip, PrideSystemTooltip, TechnologyTooltip } from "./TooltipSystem";

interface PlayerHUDProps {
  player: PlayerState;
  faction: Faction;
  onShowTechPanel: () => void;
  onShowConstructionHall: () => void;
  onEndTurn: () => void;
}

export default function PlayerHUD({ 
  player, 
  faction, 
  onShowTechPanel, 
  onShowConstructionHall, 
  onEndTurn 
}: PlayerHUDProps) {
  const { gameState } = useLocalGame();

  // Memoize expensive stat calculations including star production
  const playerStats = useMemo(() => {
    if (!gameState) return {
      faithPercentage: player.stats.faith,
      pridePercentage: player.stats.pride,
      dissentPercentage: player.stats.internalDissent,
      cityCount: player.citiesOwned.length,
      techCount: player.researchedTechs.length,
      starProduction: 0,
      starProductionBreakdown: []
    };

    // Enhanced Polytopia-style star production calculation
    const playerCityObjects = gameState.cities?.filter(city => city.ownerId === player.id) || [];
    let totalStarProduction = 0;
    
    // Calculate city-based star production with levels
    const cityStarProduction = playerCityObjects.reduce((sum, city) => sum + city.starProduction, 0);
    totalStarProduction += cityStarProduction;
    
    const breakdown: Array<{source: string, amount: number}> = [];
    
    if (playerCityObjects.length > 0) {
      breakdown.push({ 
        source: `Cities (${playerCityObjects.length})`, 
        amount: cityStarProduction 
      });
    } else {
      // Fallback base production if no cities
      const baseProduction = GAME_RULES.resources.baseStarsPerTurn;
      totalStarProduction += baseProduction;
      breakdown.push({ source: "Base", amount: baseProduction });
    }

    // Add improvements
    const playerImprovements = gameState.improvements?.filter(imp => imp.ownerId === player.id) || [];
    let improvementStars = 0;
    playerImprovements.forEach(improvement => {
      const improvementDef = IMPROVEMENT_DEFINITIONS[improvement.type as keyof typeof IMPROVEMENT_DEFINITIONS];
      if (improvementDef && improvement.constructionTurns === 0) {
        improvementStars += improvement.starProduction;
        totalStarProduction += improvement.starProduction;
      }
    });
    
    if (improvementStars > 0) {
      breakdown.push({ source: `Improvements (${playerImprovements.length})`, amount: improvementStars });
    }

    // Add structures
    const playerStructures = gameState.structures?.filter(struct => struct.ownerId === player.id) || [];
    let structureStars = 0;
    playerStructures.forEach(structure => {
      const structureDef = STRUCTURE_DEFINITIONS[structure.type as keyof typeof STRUCTURE_DEFINITIONS];
      if (structureDef && structure.constructionTurns === 0) {
        structureStars += structure.effects.starProduction;
        totalStarProduction += structure.effects.starProduction;
      }
    });
    
    if (structureStars > 0) {
      breakdown.push({ source: `Structures (${playerStructures.length})`, amount: structureStars });
    }

    return {
      faithPercentage: player.stats.faith,
      pridePercentage: player.stats.pride,
      dissentPercentage: player.stats.internalDissent,
      cityCount: player.citiesOwned.length,
      techCount: player.researchedTechs.length,
      starProduction: totalStarProduction,
      starProductionBreakdown: breakdown
    };
  }, [player, gameState]);

  // Memoize faction styling
  const factionStyle = useMemo(() => ({
    backgroundColor: faction.color
  }), [faction.color]);

  return (
    <div className="absolute top-4 left-4 space-y-4 pointer-events-auto">
      {/* Current Player Info */}
      <Card className="w-72 bg-black/80 border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-white font-cinzel text-lg font-semibold tracking-wide">
            <div 
              className="w-4 h-4 rounded-full border-2" 
              style={factionStyle}
            />
            {player.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Star Resources with Production Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-white">
              <div className="flex items-center gap-1 relative">
                <Star className="w-4 h-4 text-yellow-400" />
                <span className="font-semibold">{player.stars}</span>
                <Info className="w-3 h-3 text-gray-400 opacity-60" />
                <InfoTooltip content={<StarProductionTooltip totalIncome={playerStats.starProduction} breakdown={playerStats.starProductionBreakdown} />} />
              </div>
              <div className="flex items-center gap-1 text-sm text-green-400">
                <TrendingUp className="w-3 h-3" />
                <span>+{playerStats.starProduction}/turn</span>
              </div>
            </div>
            
            {/* Star Production Breakdown - Expandable */}
            <details className="group">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 flex items-center gap-1">
                <span>Production breakdown</span>
                <span className="transition-transform group-open:rotate-90">▶</span>
              </summary>
              <div className="mt-1 space-y-1 text-xs">
                {playerStats.starProductionBreakdown.map((item, index) => (
                  <div key={index} className="flex justify-between text-gray-300">
                    <span>{item.source}:</span>
                    <span className="text-yellow-400">+{item.amount}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-white border-t border-gray-600 pt-1">
                  <span>Total:</span>
                  <span className="text-green-400">+{playerStats.starProduction}</span>
                </div>
              </div>
            </details>
          </div>
          
          {/* Faith Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <div className="relative">
                <span className="text-blue-300 font-cinzel font-medium flex items-center gap-1">
                  Faith
                  <Info className="w-3 h-3 text-gray-400 opacity-60" />
                </span>
                <InfoTooltip content={<FaithSystemTooltip />} />
              </div>
              <span className="text-white font-body font-medium">{player.stats.faith}/100</span>
            </div>
            <Progress value={player.stats.faith} className="h-2" />
          </div>
          
          {/* Pride Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <div className="relative">
                <span className="text-purple-300 font-cinzel font-medium flex items-center gap-1">
                  Pride
                  <Info className="w-3 h-3 text-gray-400 opacity-60" />
                </span>
                <InfoTooltip content={<PrideSystemTooltip />} />
              </div>
              <span className="text-white font-body font-medium">{player.stats.pride}/100</span>
            </div>
            <Progress value={player.stats.pride} className="h-2" />
          </div>
          
          {/* Internal Dissent Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-300 font-cinzel font-medium">Dissent</span>
              <span className="text-white font-body font-medium">{player.stats.internalDissent}/100</span>
            </div>
            <Progress value={player.stats.internalDissent} className="h-2" />
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-blue-600/20 border-blue-400 text-blue-100 hover:bg-blue-600/40 text-xs px-2 py-2"
                  onClick={onShowTechPanel}
                >
                  <Book className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span>Research</span>
                </Button>
                <InfoTooltip content={<TechnologyTooltip />} />
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-green-600/20 border-green-400 text-green-100 hover:bg-green-600/40 text-xs px-2 py-2 h-auto"
                onClick={onShowConstructionHall}
              >
                <div className="flex flex-col items-center justify-center">
                  <Hammer className="w-3 h-3 mb-1" />
                  <span className="text-xs leading-tight">Construction Hall</span>
                </div>
              </Button>
            </div>
            
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              onClick={onEndTurn}
            >
              End Turn (T)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}