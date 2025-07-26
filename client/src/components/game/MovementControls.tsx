import { Button } from "../ui/button";
import { X, Navigation } from "lucide-react";
import { useGameState } from "../../lib/stores/useGameState";

interface MovementControlsProps {
  selectedUnit: any;
  reachableCount: number;
}

export default function MovementControls({ selectedUnit, reachableCount }: MovementControlsProps) {
  const { setMovementMode, setReachableCoordinates } = useGameState();

  const handleCancelMovement = () => {
    setMovementMode(false);
    setReachableCoordinates([]);
  };

  return (
    <div className="absolute top-4 right-4 pointer-events-auto z-50">
      <div className="bg-black/90 backdrop-blur-sm border border-emerald-500/30 rounded-lg p-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <Navigation className="w-5 h-5 text-emerald-400" />
          <div className="text-white font-cinzel font-semibold">Movement Mode</div>
        </div>
        
        <div className="text-sm text-gray-300 mb-3 font-body">
          Select a highlighted tile to move {selectedUnit?.type || 'unit'}
        </div>
        
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="text-xs text-emerald-300 font-body">
            {reachableCount} tiles available
          </div>
          <div className="text-xs text-blue-300 font-body">
            {selectedUnit?.remainingMovement || 0} movement left
          </div>
        </div>
        
        <Button
          onClick={handleCancelMovement}
          variant="outline"
          size="sm"
          className="w-full min-h-[40px] border-red-500/50 text-red-300 md:hover:bg-red-900/30 active:bg-red-900/50 transition-all duration-200 active:scale-95 touch-manipulation"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel Movement
        </Button>
      </div>
    </div>
  );
}