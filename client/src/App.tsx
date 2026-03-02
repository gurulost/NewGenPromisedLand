import { Suspense, lazy } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocalGame } from "./lib/stores/useLocalGame";
import * as THREE from "three";
import MainMenu from "./components/ui/MainMenu";
import PlayerSetup from "./components/ui/PlayerSetup";
import HandoffScreen from "./components/ui/HandoffScreen";
import TutorialEpisodeIntro from "./components/ui/TutorialEpisodeIntro";
import LobbyList from "./components/ui/LobbyList";
import LobbyRoom from "./components/ui/LobbyRoom";
import { VisualFeedbackProvider } from "./components/ui/VisualFeedback";
import { FloatingTextManager } from "./components/ui/FloatingText";
import { AudioProvider } from "./components/ui/AudioProvider";
import { WorldBuildLoader } from "./components/ui/WorldBuildLoader";
import { MapGenerationOverlay } from "./components/ui/MapGenerationOverlay";
import { useTouchModeProvider } from "./hooks/useTouchMode";
import { useMobileUI } from "./hooks/useMobileUI";
import { usePerformanceMode } from "./hooks/usePerformanceMode";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "@fontsource/inter";

const queryClient = new QueryClient();
const GameCanvas = lazy(() => import("./components/game/GameCanvas"));
const GameUI = lazy(() => import("./components/game/GameUI"));
const CombatEffectsDemo = lazy(async () => ({
  default: (await import("./components/effects/CombatEffectsDemo")).CombatEffectsDemo,
}));
const AnimationLab = lazy(async () => ({
  default: (await import("./components/ui/AnimationLab")).AnimationLab,
}));

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
  { name: "chat", keys: ["KeyC"] },
  { name: "attack", keys: ["KeyA"] },
  { name: "move", keys: ["KeyM"] },
  { name: "ability", keys: ["KeyQ"] },
];

function GameStage() {
  const { isMobileUI } = useMobileUI();
  const perfMode = usePerformanceMode();
  const allowShadows = perfMode === 'high' && !isMobileUI;
  const dpr = isMobileUI ? ([1, 1.5] as [number, number]) : undefined;

  return (
    <Canvas
      shadows={allowShadows}
      dpr={dpr}
      camera={{
        position: [0, 8, 8],
        fov: 45,
        near: 0.5,
        far: 1000
      }}
      gl={{
        antialias: perfMode === 'high' && !isMobileUI,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.3,
      }}
      className="absolute inset-0"
    >
      <color attach="background" args={["#0f172a"]} />

      {/* Lighting - Much brighter for better tile visibility */}
      <ambientLight intensity={1.15} color="#ffffff" />
      <hemisphereLight
        color="#ffffff"
        groundColor="#6b7280"
        intensity={0.65}
      />
      <directionalLight
        position={[10, 10, 5]}
        intensity={3.0}
        color="#fff3d6"
        castShadow={allowShadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      {/* Additional light for better coverage */}
      <directionalLight
        position={[-10, 10, -5]}
        intensity={1.8}
        color="#e0f2fe"
        castShadow={allowShadows}
      />

      <Suspense fallback={null}>
        <GameCanvas />
      </Suspense>
    </Canvas>
  );
}

function App() {
  const { gamePhase } = useLocalGame();

  // Check for demo routes
  const isDemoRoute = window.location.hash === '#combat-demo';
  const isAnimationsRoute = typeof window !== 'undefined' &&
    (window.location.pathname === '/animations' || window.location.pathname === '/animations/');

  // If demo route, show the demo component
  if (isDemoRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <CombatEffectsDemo />
        </Suspense>
      </QueryClientProvider>
    );
  }
  if (isAnimationsRoute) {
    return (
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <AnimationLab />
        </Suspense>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TouchModeProvider>
        <AudioProvider>
          <VisualFeedbackProvider>
              <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
                <KeyboardControls map={controls}>
                {gamePhase === 'menu' && <MainMenu />}

                {gamePhase === 'tutorialEpisodeIntro' && <TutorialEpisodeIntro />}

                {gamePhase === 'playerSetup' && <PlayerSetup />}

                {gamePhase === 'handoff' && <HandoffScreen />}

                {gamePhase === 'lobbies' && <LobbyList />}

                {gamePhase === 'lobbyRoom' && <LobbyRoom />}

                {(gamePhase === 'playing' || gamePhase === 'gameOver') && (
                  <ErrorBoundary>
                    <GameStage />
                    <Suspense fallback={null}>
                      <GameUI />
                    </Suspense>
                    <WorldBuildLoader enabled />
                  </ErrorBoundary>
                )}
              </KeyboardControls>
              <MapGenerationOverlay />
            </div>
          </VisualFeedbackProvider>
          <FloatingTextManager />
        </AudioProvider>
      </TouchModeProvider>
    </QueryClientProvider>
  );
}

export default App;
