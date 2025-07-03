import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getFaction } from "@shared/data/factions";

export default function HandoffScreen() {
  const { gameState, setGamePhase } = useLocalGame();

  if (!gameState) {
    return null;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const faction = getFaction(currentPlayer.factionId as any);

  const handleStartTurn = () => {
    setGamePhase('playing');
  };

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Card className="w-96 bg-black/90 border-amber-600/50 text-white text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-cinzel text-amber-400 mb-4 font-semibold tracking-wide">
            Turn Complete
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-lg text-gray-300 font-body">
              Turn {gameState.turn} is ready to begin.
            </p>
            
            <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-600">
              <p className="text-sm text-gray-400 mb-2 font-body">Pass the device to:</p>
              <div className="flex items-center justify-center gap-3">
                <div 
                  className="w-6 h-6 rounded-full"
                  style={{ backgroundColor: faction.color }}
                />
                <span className="text-xl font-bold font-body">{currentPlayer.name}</span>
              </div>
              <p className="text-lg text-amber-300 mt-2 font-cinzel">{faction.name}</p>
            </div>
            
            <div className="space-y-2 text-sm text-gray-400 font-body">
              <p>• Make sure only {currentPlayer.name} can see the screen</p>
              <p>• Other players should look away</p>
              <p>• Click the button when ready to start your turn</p>
            </div>
          </div>
          
          <Button
            onClick={handleStartTurn}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
          >
            Start My Turn
          </Button>
          
          <div className="pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              {faction.playstyle}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
