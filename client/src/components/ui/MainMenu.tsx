import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { useLocalGame } from "../../lib/stores/useLocalGame";

export default function MainMenu() {
  const { setGamePhase } = useLocalGame();

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 bg-black/20" />
      
      <Card className="relative z-10 w-96 bg-black/80 border-amber-600/50 text-white">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-cinzel font-bold text-amber-400 mb-2 tracking-wide leading-tight">
            Chronicles of the Promised Land
          </CardTitle>
          <p className="text-gray-300 text-sm font-body font-medium tracking-wide">
            A Book of Mormon Strategy Game
          </p>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Button
            onClick={() => setGamePhase('playerSetup')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
          >
            Pass-and-Play (Local)
          </Button>
          
          <Button
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-800 py-3 text-lg"
            disabled
          >
            Single Player (Coming Soon)
          </Button>
          
          <Button
            variant="outline"
            className="w-full border-gray-600 text-gray-300 hover:bg-gray-800 py-3 text-lg"
            disabled
          >
            Online Multiplayer (Coming Soon)
          </Button>
          
          <div className="mt-6 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 text-center">
              Lead your people through faith, struggle, and triumph in the ancient Americas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
