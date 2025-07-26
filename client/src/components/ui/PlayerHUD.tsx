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
      {/* Enhanced Player Info with Book of Mormon Golden Theming */}
      <Card className="w-72 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/30 shadow-2xl shadow-amber-500/20">
        <CardHeader className="pb-2 bg-gradient-to-r from-amber-900/20 to-amber-800/20 border-b border-amber-500/20">
          <CardTitle className="flex items-center gap-2 text-amber-100 font-cinzel text-lg font-semibold tracking-wide">
            <div 
              className="w-4 h-4 rounded-full border-2 border-amber-400 shadow-sm" 
              style={factionStyle}
            />
            {player.name}
          </CardTitle>
          <div className="text-xs text-amber-300/70 font-normal">— Leader of the Promised Land —</div>
        </CardHeader>
        <CardContent className="space-y-3 bg-slate-900/40">
          {/* Enhanced Star Resources with Golden Theming */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-amber-100">
              <div className="flex items-center gap-1 relative">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-amber-200">{player.stars}</span>
                <Info className="w-3 h-3 text-amber-400/60 opacity-60" />
                <InfoTooltip content={<StarProductionTooltip totalIncome={playerStats.starProduction} breakdown={playerStats.starProductionBreakdown} />} />
              </div>
              <div className="flex items-center gap-1 text-sm text-amber-300">
                <TrendingUp className="w-3 h-3" />
                <span>+{playerStats.starProduction}/turn</span>
              </div>
            </div>
            
            {/* Enhanced Star Production Breakdown with Golden Theming */}
            <details className="group">
              <summary className="text-xs text-amber-300/70 cursor-pointer hover:text-amber-300 flex items-center gap-1">
                <span>Production breakdown</span>
                <span className="transition-transform group-open:rotate-90">▶</span>
              </summary>
              <div className="mt-1 space-y-1 text-xs bg-amber-900/10 rounded p-2 border border-amber-500/20">
                {playerStats.starProductionBreakdown.map((item, index) => (
                  <div key={index} className="flex justify-between text-amber-200">
                    <span>{item.source}:</span>
                    <span className="text-amber-300">+{item.amount}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-amber-100 border-t border-amber-600/50 pt-1">
                  <span>Total:</span>
                  <span className="text-amber-300">+{playerStats.starProduction}</span>
                </div>
              </div>
            </details>
          </div>
          
          {/* Enhanced Faith Progress with Golden Theming */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <div className="relative">
                <span className="text-blue-300 font-cinzel font-medium flex items-center gap-1">
                  Faith
                  <Info className="w-3 h-3 text-amber-400/60 opacity-60" />
                </span>
                <InfoTooltip content={<FaithSystemTooltip />} />
              </div>
              <span className="text-amber-100 font-body font-medium">{player.stats.faith}/100</span>
            </div>
            <Progress value={player.stats.faith} className="h-2" />
          </div>
          
          {/* Enhanced Pride Progress with Golden Theming */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <div className="relative">
                <span className="text-purple-300 font-cinzel font-medium flex items-center gap-1">
                  Pride
                  <Info className="w-3 h-3 text-amber-400/60 opacity-60" />
                </span>
                <InfoTooltip content={<PrideSystemTooltip />} />
              </div>
              <span className="text-amber-100 font-body font-medium">{player.stats.pride}/100</span>
            </div>
            <Progress value={player.stats.pride} className="h-2" />
          </div>
          
          {/* Enhanced Internal Dissent Progress with Golden Theming */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-300 font-cinzel font-medium">Dissent</span>
              <span className="text-amber-100 font-body font-medium">{player.stats.internalDissent}/100</span>
            </div>
            <Progress value={player.stats.internalDissent} className="h-2" />
          </div>
          
          {/* Enhanced Action Buttons with Book of Mormon Golden Theming */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full bg-gradient-to-r from-blue-600/20 to-blue-700/20 border-blue-400/60 text-blue-100 md:hover:bg-blue-600/40 text-xs px-2 py-2 shadow-lg shadow-blue-500/10"
                  onClick={onShowTechPanel}
                >
                  <Book className="w-3 h-3 mr-1 flex-shrink-0" />
                  <span>Sacred Knowledge</span>
                </Button>
                <InfoTooltip content={<TechnologyTooltip />} />
              </div>
              
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-400/60 text-amber-100 md:hover:bg-amber-600/40 text-xs px-2 py-2 h-auto shadow-lg shadow-amber-500/10"
                onClick={onShowConstructionHall}
              >
                <div className="flex flex-col items-center justify-center">
                  <Hammer className="w-3 h-3 mb-1" />
                  <span className="text-xs leading-tight">Construction Hall</span>
                </div>
              </Button>
            </div>
            
            <Button
              className="w-full bg-gradient-to-r from-amber-600 to-amber-700 md:hover:from-amber-700 md:hover:to-amber-800 text-amber-100 shadow-lg shadow-amber-500/25 border border-amber-500/30"
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