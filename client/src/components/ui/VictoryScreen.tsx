import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getFaction } from "@shared/data/factions";
import { 
  Trophy, Crown, Star, Church, Shield, 
  Users, RotateCw, Home, Sparkles 
} from "lucide-react";

interface VictoryScreenProps {
  winnerId: string;
  victoryType: 'faith' | 'territorial' | 'elimination' | 'domination';
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export default function VictoryScreen({ 
  winnerId, 
  victoryType, 
  onPlayAgain, 
  onMainMenu 
}: VictoryScreenProps) {
  const { gameState } = useLocalGame();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (!gameState) return null;

  const winner = gameState.players.find(p => p.id === winnerId);
  if (!winner) return null;

  const faction = getFaction(winner.factionId as any);

  const getVictoryIcon = (type: string) => {
    switch (type) {
      case 'faith': return <Church className="w-8 h-8 text-blue-400" />;
      case 'territorial': return <Crown className="w-8 h-8 text-purple-400" />;
      case 'elimination': return <Shield className="w-8 h-8 text-red-400" />;
      case 'domination': return <Trophy className="w-8 h-8 text-yellow-400" />;
      default: return <Star className="w-8 h-8 text-white" />;
    }
  };

  const getVictoryTitle = (type: string) => {
    switch (type) {
      case 'faith': return 'Divine Victory';
      case 'territorial': return 'Territorial Conquest';
      case 'elimination': return 'Total Domination';
      case 'domination': return 'Strategic Supremacy';
      default: return 'Victory';
    }
  };

  const getVictoryDescription = (type: string) => {
    switch (type) {
      case 'faith': 
        return 'Through unwavering faith and spiritual leadership, you have achieved divine enlightenment and brought peace to the land.';
      case 'territorial': 
        return 'By controlling the majority of cities and territories, you have established your dominion over the promised land.';
      case 'elimination': 
        return 'Through strategic warfare and tactical brilliance, you have eliminated all opposing forces.';
      case 'domination': 
        return 'Your superior strategy and leadership have led your people to complete victory.';
      default: 
        return 'Victory has been achieved through your exceptional leadership.';
    }
  };

  const getFinalStats = () => {
    const totalTurns = gameState.turn;
    const citiesControlled = winner.citiesOwned.length;
    const unitsRemaining = gameState.units.filter(u => u.playerId === winnerId).length;
    const techsResearched = winner.researchedTechs.length;

    return {
      totalTurns,
      citiesControlled,
      unitsRemaining,
      techsResearched,
      finalFaith: winner.stats.faith,
      finalPride: winner.stats.pride,
      finalStars: winner.stars
    };
  };

  const stats = getFinalStats();

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 animate-bounce">
            <Sparkles className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="absolute top-10 right-1/3 animate-bounce delay-300">
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div className="absolute top-20 left-1/3 animate-bounce delay-700">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
        </div>
      )}

      <Card className="w-[600px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-yellow-500/50 shadow-2xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            {getVictoryIcon(victoryType)}
          </div>
          
          <CardTitle className="text-4xl font-cinzel font-bold text-yellow-300 mb-2 tracking-wide">
            {getVictoryTitle(victoryType)}
          </CardTitle>
          
          <div className="flex items-center justify-center gap-2 mb-3">
            <div 
              className="w-6 h-6 rounded-full border-2 border-white" 
              style={{ backgroundColor: faction.color }}
            />
            <h3 className="text-2xl font-semibold text-white font-cinzel">
              {winner.name} Victorious!
            </h3>
          </div>
          
          <Badge 
            variant="outline" 
            className="text-lg px-4 py-2 border-yellow-500/50 text-yellow-300"
          >
            {faction.name}
          </Badge>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Victory Description */}
          <div className="text-center">
            <p className="text-slate-300 text-lg leading-relaxed font-body">
              {getVictoryDescription(victoryType)}
            </p>
          </div>

          <Separator className="bg-slate-600" />

          {/* Final Statistics */}
          <div>
            <h4 className="text-xl font-semibold text-white mb-4 font-cinzel text-center">
              Final Statistics
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats.totalTurns}</div>
                  <div className="text-sm text-slate-400">Total Turns</div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats.citiesControlled}</div>
                  <div className="text-sm text-slate-400">Cities Controlled</div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.unitsRemaining}</div>
                  <div className="text-sm text-slate-400">Units Remaining</div>
                </div>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{stats.techsResearched}</div>
                  <div className="text-sm text-slate-400">Technologies</div>
                </div>
              </div>
            </div>

            {/* Resource Stats */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="bg-slate-800/30 rounded p-2 text-center">
                <div className="text-lg font-semibold text-blue-300">{stats.finalFaith}</div>
                <div className="text-xs text-slate-400">Faith</div>
              </div>
              <div className="bg-slate-800/30 rounded p-2 text-center">
                <div className="text-lg font-semibold text-purple-300">{stats.finalPride}</div>
                <div className="text-xs text-slate-400">Pride</div>
              </div>
              <div className="bg-slate-800/30 rounded p-2 text-center">
                <div className="text-lg font-semibold text-yellow-300">{stats.finalStars}</div>
                <div className="text-xs text-slate-400">Stars</div>
              </div>
            </div>
          </div>

          <Separator className="bg-slate-600" />

          {/* Player Rankings */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3 font-cinzel text-center">
              Final Rankings
            </h4>
            
            <div className="space-y-2">
              {gameState.players
                .sort((a, b) => {
                  // Sort by victory (winner first), then by faith + cities + units
                  if (a.id === winnerId) return -1;
                  if (b.id === winnerId) return 1;
                  
                  const scoreA = a.stats.faith + a.citiesOwned.length * 10 + 
                    gameState.units.filter(u => u.playerId === a.id).length * 5;
                  const scoreB = b.stats.faith + b.citiesOwned.length * 10 + 
                    gameState.units.filter(u => u.playerId === b.id).length * 5;
                  
                  return scoreB - scoreA;
                })
                .map((player, index) => {
                  const playerFaction = getFaction(player.factionId as any);
                  const isWinner = player.id === winnerId;
                  
                  return (
                    <div 
                      key={player.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isWinner 
                          ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30' 
                          : 'bg-slate-800/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-white">#{index + 1}</div>
                        <div 
                          className="w-4 h-4 rounded-full border" 
                          style={{ backgroundColor: playerFaction.color }}
                        />
                        <div>
                          <div className="font-semibold text-white">{player.name}</div>
                          <div className="text-xs text-slate-400">{playerFaction.name}</div>
                        </div>
                      </div>
                      
                      {isWinner && (
                        <Crown className="w-5 h-5 text-yellow-400" />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={onPlayAgain}
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3"
            >
              <RotateCw className="w-5 h-5 mr-2" />
              Play Again
            </Button>
            
            <Button
              onClick={onMainMenu}
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700 py-3"
            >
              <Home className="w-5 h-5 mr-2" />
              Main Menu
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}