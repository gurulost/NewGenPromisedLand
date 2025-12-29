import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocalGame } from "./lib/stores/useLocalGame";
import MainMenu from "./components/ui/MainMenu";
import PlayerSetup from "./components/ui/PlayerSetup";
import HandoffScreen from "./components/ui/HandoffScreen";
import LobbyList from "./components/ui/LobbyList";
import LobbyRoom from "./components/ui/LobbyRoom";
import GameCanvas from "./components/game/GameCanvas";
import GameUI from "./components/game/GameUI";
import { CombatEffectsDemo } from "./components/effects/CombatEffectsDemo";
import { ToastProvider } from "./components/ui/ToastProvider";
import { VisualFeedbackProvider } from "./components/ui/VisualFeedback";
import { FloatingTextManager } from "./components/ui/FloatingText";
import { AudioProvider } from "./components/ui/AudioProvider";
import { useTouchModeProvider, TouchModeContext } from "./hooks/useTouchMode";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "@fontsource/inter";

function GameLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-amber-100 font-medium">Loading game...</p>
      </div>
    </div>
  );
}

const queryClient = new QueryClient();

function TouchModeProvider({ children }: { children: React.ReactNode }) {
  const touchMode = useTouchModeProvider();
  return (
    <touchMode.TouchModeContext.Provider value={{
      isTouchDevice: touchMode.isTouchDevice,
      forceTouchMode: touchMode.forceTouchMode,
      setForceTouchMode: touchMode.setForceTouchMode,
    }}>
      {children}
    </touchMode.TouchModeContext.Provider>
  );
}

// Define control keys for the game
const controls = [
  { name: "select", keys: ["Enter", "Space"] },
  { name: "cancel", keys: ["Escape"] },
  { name: "endTurn", keys: ["KeyT"] },
  { name: "save", keys: ["KeyS"] },
  { name: "load", keys: ["KeyL"] },
  { name: "diplomacy", keys: ["KeyD"] },
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
      <TouchModeProvider>
        <AudioProvider>
          <ToastProvider>
            <VisualFeedbackProvider>
              <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
                <KeyboardControls map={controls}>
                {gamePhase === 'menu' && <MainMenu />}

                {gamePhase === 'playerSetup' && <PlayerSetup />}

                {gamePhase === 'handoff' && <HandoffScreen />}

                {gamePhase === 'lobbies' && <LobbyList />}

                {gamePhase === 'lobbyRoom' && <LobbyRoom />}

                {(gamePhase === 'playing' || gamePhase === 'gameOver') && (
                  <ErrorBoundary>
                    <Canvas
                      shadows
                      camera={{
                        position: [0, 8, 8],
                        fov: 45,
                        near: 0.5,
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
                  </ErrorBoundary>
                )}
              </KeyboardControls>
            </div>
            </VisualFeedbackProvider>
          </ToastProvider>
          <FloatingTextManager />
        </AudioProvider>
      </TouchModeProvider>
    </QueryClientProvider>
  );
}

export default App;
