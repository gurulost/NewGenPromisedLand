import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocalGame } from "./lib/stores/useLocalGame";
import MainMenu from "./components/ui/MainMenu";
import PlayerSetup from "./components/ui/PlayerSetup";
import HandoffScreen from "./components/ui/HandoffScreen";
import GameCanvas from "./components/game/GameCanvas";
import GameUI from "./components/game/GameUI";
import { CombatEffectsDemo } from "./components/effects/CombatEffectsDemo";
import "@fontsource/inter";

const queryClient = new QueryClient();

// Define control keys for the game
const controls = [
  { name: "select", keys: ["Enter", "Space"] },
  { name: "cancel", keys: ["Escape"] },
  { name: "endTurn", keys: ["KeyT"] },
  { name: "save", keys: ["KeyS"] },
  { name: "load", keys: ["KeyL"] },
];

function App() {
  const { gamePhase } = useLocalGame();

  // Check for demo routes
  const isDemoRoute = window.location.hash === '#combat-demo';

  // If demo route, show the demo component
  if (isDemoRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <CombatEffectsDemo />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
        <KeyboardControls map={controls}>
          {gamePhase === 'menu' && <MainMenu />}
          
          {gamePhase === 'playerSetup' && <PlayerSetup />}
          
          {gamePhase === 'handoff' && <HandoffScreen />}
          
          {(gamePhase === 'playing' || gamePhase === 'gameOver') && (
            <>
              <Canvas
                shadows
                camera={{
                  position: [0, 8, 8],
                  fov: 45,
                  near: 0.01,
                  far: 1000
                }}
                gl={{
                  antialias: true,
                  powerPreference: "high-performance"
                }}
                className="absolute inset-0"
              >
                <color attach="background" args={["#0f172a"]} />
                
                {/* Lighting - Much brighter for better tile visibility */}
                <ambientLight intensity={0.8} />
                <directionalLight
                  position={[10, 10, 5]}
                  intensity={2.5}
                  castShadow
                  shadow-mapSize-width={2048}
                  shadow-mapSize-height={2048}
                />
                {/* Additional light for better coverage */}
                <directionalLight
                  position={[-10, 10, -5]}
                  intensity={1.5}
                />
                
                <Suspense fallback={null}>
                  <GameCanvas />
                </Suspense>
              </Canvas>
              <GameUI />
            </>
          )}
        </KeyboardControls>
      </div>
    </QueryClientProvider>
  );
}

export default App;
