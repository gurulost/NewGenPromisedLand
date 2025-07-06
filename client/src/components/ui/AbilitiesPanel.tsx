import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { Star, Clock, Target, Zap, Heart, Shield, Swords, Eye } from "lucide-react";
import { ABILITIES } from "@shared/data/abilities";
import { FACTIONS } from "@shared/data/factions";
import type { PlayerState } from "@shared/types/game";
import type { GameState } from "@shared/types/game";

interface AbilitiesPanelProps {
  currentPlayer: PlayerState;
  gameState: GameState;
  onActivateAbility: (abilityId: string, targetId?: string) => void;
}

interface TargetingState {
  abilityId: string | null;
  targetType: 'unit' | 'city' | 'coordinate' | null;
  instruction: string;
}

export function AbilitiesPanel({ currentPlayer, gameState, onActivateAbility }: AbilitiesPanelProps) {
  const [targetingState, setTargetingState] = useState<TargetingState>({
    abilityId: null,
    targetType: null,
    instruction: ''
  });

  // Get faction-specific abilities
  const factionData = FACTIONS[currentPlayer.factionId];
  const availableAbilities = useMemo(() => {
    if (!factionData) return [];
    
    return factionData.abilities.map(ability => {
      // Check if ability is unlocked by technology
      const isUnlocked = !ability.requirements || Object.entries(ability.requirements).every(([resource, cost]) => {
        return currentPlayer.stats[resource as keyof typeof currentPlayer.stats] >= cost;
      });

      // Check if player can afford the ability
      const canAfford = currentPlayer.stars >= (ability.cost || 0);

      // Check cooldown (simplified - in real game this would track per-ability cooldowns)
      const isOnCooldown = false; // TODO: Implement proper cooldown tracking

      return {
        ...ability,
        isUnlocked,
        canAfford,
        isOnCooldown,
        canActivate: isUnlocked && canAfford && !isOnCooldown
      };
    }).filter(Boolean);
  }, [currentPlayer, factionData]);

  const getAbilityIcon = (abilityId: string) => {
    switch (abilityId) {
      case 'blessing': return <Heart className="w-4 h-4" />;
      case 'divine_protection': return <Shield className="w-4 h-4" />;
      case 'conversion': return <Star className="w-4 h-4" />;
      case 'enlightenment': return <Eye className="w-4 h-4" />;
      case 'righteous_charge': return <Swords className="w-4 h-4" />;
      case 'ancestral_rage': return <Zap className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getResourceCost = (ability: any) => {
    const costs = [];
    if (ability.requirements?.stars) costs.push(`${ability.requirements.stars} Stars`);
    if (ability.requirements?.faith) costs.push(`${ability.requirements.faith} Faith`);
    if (ability.requirements?.pride) costs.push(`${ability.requirements.pride} Pride`);
    return costs.join(', ') || 'Free';
  };

  const handleAbilityClick = (ability: any) => {
    if (!ability.canActivate) return;

    // Check if ability requires targeting
    const requiresTargeting = ability.effect.includes('target') || ability.effect.includes('selected');
    
    if (requiresTargeting) {
      // Enter targeting mode
      setTargetingState({
        abilityId: ability.id,
        targetType: ability.effect.includes('unit') ? 'unit' : 'city',
        instruction: `Select a target for ${ability.name}`
      });
    } else {
      // Activate immediately
      onActivateAbility(ability.id);
    }
  };

  const cancelTargeting = () => {
    setTargetingState({
      abilityId: null,
      targetType: null,
      instruction: ''
    });
  };

  if (!factionData || availableAbilities.length === 0) {
    return (
      <Card className="p-4 bg-purple-950/90 border-purple-800">
        <div className="text-center text-white">
          <h3 className="font-semibold mb-2">Faction Abilities</h3>
          <p className="text-sm opacity-75">
            No abilities available for this faction
          </p>
        </div>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className="w-80 bg-purple-950/90 border-purple-800 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-white font-cinzel font-semibold tracking-wide flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {factionData.name} Abilities
          </CardTitle>
          
          {targetingState.abilityId && (
            <div className="p-2 bg-purple-900/50 border border-purple-700 rounded text-purple-200 text-sm">
              <div className="flex justify-between items-center">
                <span>{targetingState.instruction}</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={cancelTargeting}
                  className="h-6 px-2 text-purple-300 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="space-y-3">
          {/* Resource Display */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-yellow-400 flex items-center justify-center gap-1">
                <Star className="w-3 h-3" />
                <span className="font-semibold">{currentPlayer.stars}</span>
              </div>
              <div className="text-yellow-300">Stars</div>
            </div>
            <div className="text-center">
              <div className="text-blue-400 flex items-center justify-center gap-1">
                <Heart className="w-3 h-3" />
                <span className="font-semibold">{currentPlayer.stats.faith}</span>
              </div>
              <div className="text-blue-300">Faith</div>
            </div>
            <div className="text-center">
              <div className="text-red-400 flex items-center justify-center gap-1">
                <Shield className="w-3 h-3" />
                <span className="font-semibold">{currentPlayer.stats.pride}</span>
              </div>
              <div className="text-red-300">Pride</div>
            </div>
          </div>

          {/* Abilities List */}
          <div className="space-y-2">
            {availableAbilities.map((ability) => (
              <Tooltip key={ability.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full p-3 h-auto justify-start ${
                      ability.canActivate
                        ? 'bg-purple-600/20 border-purple-400 text-purple-100 hover:bg-purple-600/40'
                        : 'bg-gray-800/20 border-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                    onClick={() => handleAbilityClick(ability)}
                    disabled={!ability.canActivate}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="mt-0.5">
                        {getAbilityIcon(ability.id)}
                      </div>
                      
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{ability.name}</span>
                          <div className="flex items-center gap-1">
                            {ability.isOnCooldown && (
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="w-2 h-2 mr-1" />
                                Cooldown
                              </Badge>
                            )}
                            {!ability.isUnlocked && (
                              <Badge variant="destructive" className="text-xs">
                                Locked
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-xs opacity-75 mb-2 break-words whitespace-normal leading-relaxed">
                          {ability.description}
                        </div>
                        
                        <div className="text-xs">
                          <span className="text-yellow-300">Cost: {getResourceCost(ability)}</span>
                          {ability.cooldown && (
                            <span className="text-gray-400 ml-2">• Cooldown: {ability.cooldown} turns</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Button>
                </TooltipTrigger>
                
                <TooltipContent side="left" className="max-w-xs">
                  <div className="space-y-2">
                    <h4 className="font-semibold">{ability.name}</h4>
                    <p className="text-sm">{ability.description}</p>
                    <div className="text-xs text-gray-300">
                      <div>Effect: {ability.effect}</div>
                      {ability.duration && <div>Duration: {ability.duration} turns</div>}
                      <div>Type: {ability.type}</div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {availableAbilities.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-4">
              No abilities available
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}