import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocalGame } from "./lib/stores/useLocalGame";
import MainMenu from "./components/ui/MainMenu";
import PlayerSetup from "./components/ui/PlayerSetup";
import HandoffScreen from "./components/ui/HandoffScreen";
import TutorialEpisodeIntro from "./components/ui/TutorialEpisodeIntro";
import LobbyList from "./components/ui/LobbyList";
import LobbyRoom from "./components/ui/LobbyRoom";
import { VisualFeedbackProvider } from "./components/ui/VisualFeedback";
import { FloatingTextManager } from "./components/ui/FloatingText";
import { AudioProvider } from "./components/ui/AudioProvider";
import { MapGenerationOverlay } from "./components/ui/MapGenerationOverlay";
import { useTouchModeProvider } from "./hooks/useTouchMode";
import { ErrorBoundary } from "./components/ErrorBoundary";
import BugReportHost from "./components/ui/BugReportHost";
import AnimationLabGate from "./components/ui/AnimationLabGate";
import { useAnimationLabAccess } from "./lib/stores/useAnimationLabAccess";
import "@fontsource/inter";

const queryClient = new QueryClient();
const PlayingScene = lazy(() => import("./components/game/PlayingScene"));
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

function App() {
  const { gamePhase } = useLocalGame();
  const refreshAnimationLabAccess = useAnimationLabAccess((state) => state.refresh);

  useEffect(() => {
    void refreshAnimationLabAccess();
  }, [refreshAnimationLabAccess]);

  // Check for demo routes
  const isDemoRoute = window.location.hash === '#combat-demo';
  const isAnimationsRoute = typeof window !== 'undefined' &&
    (window.location.pathname === '/animations' || window.location.pathname === '/animations/');
  const isMainGameRoute = !isDemoRoute && !isAnimationsRoute;

  let routeContent: React.ReactNode;
  if (isDemoRoute) {
    routeContent = (
      <Suspense fallback={null}>
        <CombatEffectsDemo />
      </Suspense>
    );
  } else if (isAnimationsRoute) {
    routeContent = (
      <AnimationLabGate>
        <Suspense fallback={null}>
          <AnimationLab />
        </Suspense>
      </AnimationLabGate>
    );
  } else {
    routeContent = (
      <div className="w-full h-full relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
        {gamePhase === 'menu' && <MainMenu />}

        {gamePhase === 'tutorialEpisodeIntro' && <TutorialEpisodeIntro />}

        {gamePhase === 'playerSetup' && <PlayerSetup />}

        {gamePhase === 'handoff' && <HandoffScreen />}

        {gamePhase === 'lobbies' && <LobbyList />}

        {gamePhase === 'lobbyRoom' && <LobbyRoom />}

        {(gamePhase === 'playing' || gamePhase === 'gameOver') && (
          <ErrorBoundary>
            <Suspense fallback={null}>
              <PlayingScene />
            </Suspense>
          </ErrorBoundary>
        )}
        <BugReportHost />
        <MapGenerationOverlay />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TouchModeProvider>
        <AudioProvider>
          <VisualFeedbackProvider>
            {routeContent}
          </VisualFeedbackProvider>
          {(isMainGameRoute || isDemoRoute || isAnimationsRoute) && <FloatingTextManager />}
        </AudioProvider>
      </TouchModeProvider>
    </QueryClientProvider>
  );
}

export default App;
