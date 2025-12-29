import { useState, useEffect, useRef } from "react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { Users, Crown, Globe, FolderOpen } from "lucide-react";
import { listSaves, type ServerSave } from "../../lib/saveApi";
import SaveLoadMenu from "./SaveLoadMenu";
import { loadAutosave } from "../../lib/autosaveStorage";

function HeroBackground() {
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  }, []);

  const handleVideoEnded = () => {
    setVideoEnded(true);
  };

  const handleVideoLoaded = () => {
    setVideoLoaded(true);
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fallback Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{
          backgroundImage: 'url(/assets/hero-image.avif)',
          opacity: videoEnded || !videoLoaded ? 1 : 0
        }}
      />

      {/* Hero Video */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${videoEnded ? 'opacity-0' : 'opacity-100'
          }`}
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnded}
        onLoadedData={handleVideoLoaded}
        preload="auto"
      >
        <source src="/assets/hero-video.webm" type="video/webm" />
      </video>

      {/* Gradient Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

      {/* Subtle vignette effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />
    </div>
  );
}

export default function MainMenu() {
  const { setGamePhase, loadGameState } = useLocalGame();
  const [savedGames, setSavedGames] = useState<ServerSave[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [autosaveInfo, setAutosaveInfo] = useState<{ timestamp: number; turn: number; playerCount: number } | null>(null);
  const [isLoadingAutosave, setIsLoadingAutosave] = useState(true);

  useEffect(() => {
    const loadSaves = async () => {
      try {
        const saves = await listSaves();
        setSavedGames(saves);
      } catch (err) {
        console.error('Failed to load saved games:', err);
      }
    };
    loadSaves();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkAutosave = async () => {
      try {
        const autosave = await loadAutosave();
        if (cancelled) return;
        if (autosave?.gameState) {
          setAutosaveInfo({
            timestamp: autosave.timestamp,
            turn: autosave.gameState.turn || 1,
            playerCount: autosave.gameState.players.length,
          });
        } else {
          setAutosaveInfo(null);
        }
      } finally {
        if (!cancelled) setIsLoadingAutosave(false);
      }
    };
    checkAutosave();
    return () => {
      cancelled = true;
    };
  }, []);

  const resumeAutosave = async () => {
    const autosave = await loadAutosave();
    if (!autosave?.gameState) return;
    loadGameState(autosave.gameState);
  };

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <HeroBackground />

      <div className="relative z-10 w-full max-w-md">
        <ContentShell size="md">
          <div className="p-6 space-y-6">
            <PanelHeader
              icon={<Crown />}
              title="Chronicles of the Promised Land"
              description="A Book of Mormon Strategy Game"
            />

            <div className="space-y-4">
              {!isLoadingAutosave && autosaveInfo && (
                <>
                  <GlowingButton
                    onClick={resumeAutosave}
                    className="w-full"
                    size="lg"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <FolderOpen />
                      Resume Last Session (Turn {autosaveInfo.turn})
                    </span>
                  </GlowingButton>

                  <div className="border-t border-amber-500/20 my-2" />
                </>
              )}

              <GlowingButton
                onClick={() => {
                  setGamePhase('playerSetup');
                }}
                className="w-full"
                size="lg"
                variant={savedGames.length > 0 ? "secondary" : "default"}
              >
                <span className="flex items-center justify-center gap-2">
                  <Crown />
                  Single Player vs AI
                </span>
              </GlowingButton>

              <GlowingButton
                onClick={() => setGamePhase('playerSetup')}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2">
                  <Users />
                  Local Multiplayer (Pass-and-Play)
                </span>
              </GlowingButton>

              <GlowingButton
                onClick={() => setGamePhase('lobbies')}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2">
                  <Globe />
                  Online Multiplayer
                </span>
              </GlowingButton>

              <div className="border-t border-amber-500/20 my-2" />

              <GlowingButton
                onClick={() => setShowLoadMenu(true)}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2">
                  <FolderOpen />
                  Load Saved Game
                </span>
              </GlowingButton>
            </div>

            <div className="pt-4 border-t border-amber-500/20">
              <p className="text-sm text-amber-100/70 text-center leading-relaxed font-body">
                Lead your people through faith, struggle, and triumph in the ancient Americas
              </p>
            </div>
          </div>
        </ContentShell>
      </div>

      {showLoadMenu && (
        <SaveLoadMenu 
          onClose={() => setShowLoadMenu(false)} 
          onLoadFromMenu={true}
        />
      )}
    </div>
  );
}
