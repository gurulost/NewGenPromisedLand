import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Progress } from "./progress";
import { Button } from "./button";
import { Star, Book, Building } from "lucide-react";
import type { PlayerState } from "@shared/types/game";
import type { Faction } from "@shared/types/faction";

interface PlayerHUDProps {
  player: PlayerState;
  faction: Faction;
  onShowTechPanel: () => void;
  onShowCityPanel: () => void;
  onEndTurn: () => void;
}

export default function PlayerHUD({ 
  player, 
  faction, 
  onShowTechPanel, 
  onShowCityPanel, 
  onEndTurn 
}: PlayerHUDProps) {
  return (
    <div className="absolute top-4 left-4 space-y-4 pointer-events-auto">
      {/* Current Player Info */}
      <Card className="w-64 bg-black/80 border-white/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-white">
            <div 
              className="w-4 h-4 rounded-full border-2" 
              style={{ backgroundColor: faction.color }}
            />
            {player.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-white">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400" />
              <span>{player.stars}</span>
            </div>
            <div className="text-sm text-gray-400">
              Turn {/* This could be passed as a prop if needed */}
            </div>
          </div>
          
          {/* Faith Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-blue-300">Faith</span>
              <span className="text-white">{player.stats.faith}/100</span>
            </div>
            <Progress value={player.stats.faith} className="h-2" />
          </div>
          
          {/* Pride Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-purple-300">Pride</span>
              <span className="text-white">{player.stats.pride}/100</span>
            </div>
            <Progress value={player.stats.pride} className="h-2" />
          </div>
          
          {/* Internal Dissent Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-300">Dissent</span>
              <span className="text-white">{player.stats.internalDissent}/100</span>
            </div>
            <Progress value={player.stats.internalDissent} className="h-2" />
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-blue-600/20 border-blue-400 text-blue-100 hover:bg-blue-600/40"
                onClick={onShowTechPanel}
              >
                <Book className="w-4 h-4 mr-1" />
                Research
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-green-600/20 border-green-400 text-green-100 hover:bg-green-600/40"
                onClick={onShowCityPanel}
              >
                <Building className="w-4 h-4 mr-1" />
                Cities
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