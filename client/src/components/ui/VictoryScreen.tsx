import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "./badge";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getFaction } from "@shared/data/factions";
import { 
  Trophy, Crown, Star, Church, Shield, 
  Users, RotateCw, Home, Sparkles 
} from "lucide-react";
import { PanelShell } from "../primitives/PanelShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { AvatarBadge } from "../primitives/AvatarBadge";
import { useHotkeys } from "../../hooks/useHotkeys";

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

  useHotkeys('Escape', onMainMenu);
  useHotkeys('KeyB', onMainMenu);

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
    <PanelShell isOpen={true} onClose={onMainMenu} size="full">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ 
                x: Math.random() * window.innerWidth,
                y: -50,
                rotate: Math.random() * 360,
                scale: 0
              }}
              animate={{ 
                y: window.innerHeight + 50,
                rotate: Math.random() * 720,
                scale: [0, 1, 0]
              }}
              transition={{ 
                duration: 3 + Math.random() * 2,
                delay: Math.random() * 2,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <Sparkles className={`w-${4 + Math.floor(Math.random() * 4)} h-${4 + Math.floor(Math.random() * 4)} text-amber-400`} />
            </motion.div>
          ))}
        </div>
      )}

      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
        >
          <PanelHeader
            icon={getVictoryIcon(victoryType)}
            title={getVictoryTitle(victoryType)}
            description="Victory in the Promised Land"
            onClose={onMainMenu}
          />
        </motion.div>
        
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-center space-y-4"
        >
          <AvatarBadge 
            playerId={winner.id}
            playerName={winner.name}
            factionId={winner.factionId as any}
            size="large"
            className="mx-auto shadow-2xl shadow-amber-500/30"
          />
          
          <h3 className="text-3xl font-semibold text-amber-100 font-cinzel">
            {winner.name} Victorious!
          </h3>
          
          <Badge 
            variant="outline" 
            className="text-lg px-4 py-2 border-amber-500/50 text-amber-300"
          >
            {faction.name}
          </Badge>
        </motion.div>
        
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="space-y-6"
        >
          {/* Victory Description */}
          <div className="text-center">
            <p className="text-amber-100/80 text-lg leading-relaxed font-body">
              {getVictoryDescription(victoryType)}
            </p>
          </div>

          <Separator className="bg-amber-600/30" />

          {/* Final Statistics */}
          <div>
            <h4 className="text-xl font-semibold text-amber-100 mb-4 font-cinzel text-center">
              Final Statistics
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-800/50 rounded-lg p-3 border border-amber-600/20"
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{stats.totalTurns}</div>
                  <div className="text-sm text-amber-100/60">Total Turns</div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-800/50 rounded-lg p-3 border border-amber-600/20"
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats.citiesControlled}</div>
                  <div className="text-sm text-amber-100/60">Cities Controlled</div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-800/50 rounded-lg p-3 border border-amber-600/20"
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.unitsRemaining}</div>
                  <div className="text-sm text-amber-100/60">Units Remaining</div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 1.0 }}
                className="bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-800/50 rounded-lg p-3 border border-amber-600/20"
              >
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">{stats.techsResearched}</div>
                  <div className="text-sm text-amber-100/60">Technologies</div>
                </div>
              </motion.div>
            </div>

            {/* Resource Stats */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="mt-4 grid grid-cols-3 gap-2"
            >
              <div className="bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-800/50 rounded p-2 text-center border border-amber-600/20">
                <div className="text-lg font-semibold text-blue-300">{stats.finalFaith}</div>
                <div className="text-xs text-amber-100/60">Faith</div>
              </div>
              <div className="bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-800/50 rounded p-2 text-center border border-amber-600/20">
                <div className="text-lg font-semibold text-purple-300">{stats.finalPride}</div>
                <div className="text-xs text-amber-100/60">Pride</div>
              </div>
              <div className="bg-gradient-to-br from-slate-800/50 via-slate-700/30 to-slate-800/50 rounded p-2 text-center border border-amber-600/20">
                <div className="text-lg font-semibold text-yellow-300">{stats.finalStars}</div>
                <div className="text-xs text-amber-100/60">Stars</div>
              </div>
            </motion.div>
          </div>

          <Separator className="bg-amber-600/30" />

          {/* Player Rankings */}
          <div>
            <h4 className="text-lg font-semibold text-amber-100 mb-3 font-cinzel text-center">
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
                    <motion.div 
                      key={player.id}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 1 + index * 0.1 }}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isWinner 
                          ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/30' 
                          : 'bg-slate-800/30 border border-slate-600/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-amber-100">#{index + 1}</div>
                        <AvatarBadge 
                          playerId={player.id}
                          playerName={player.name}
                          factionId={player.factionId as any}
                          size="small"
                        />
                        <div>
                          <div className="font-semibold text-amber-100">{player.name}</div>
                          <div className="text-xs text-amber-100/60">{playerFaction.name}</div>
                        </div>
                      </div>
                      
                      {isWinner && (
                        <Crown className="w-5 h-5 text-amber-400" />
                      )}
                    </motion.div>
                  );
                })}
            </div>
          </div>

          {/* Action Buttons */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="flex gap-4 pt-4"
          >
            <GlowingButton
              onClick={onPlayAgain}
              icon={<RotateCw />}
              className="flex-1"
              size="lg"
            >
              Play Again
            </GlowingButton>
            
            <GlowingButton
              onClick={onMainMenu}
              variant="secondary"
              icon={<Home />}
              className="flex-1"
              size="lg"
            >
              Main Menu
            </GlowingButton>
          </motion.div>
        </motion.div>
      </div>
    </PanelShell>
  );
}
