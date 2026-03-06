import { useState, useEffect } from "react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { StepFretDivider } from "../primitives/StepFretDivider";
import { HeaddressIcon, WarriorShieldIcon, TempleIcon } from "../primitives/ThematicIcons";
import { Users, Globe, FolderOpen } from "lucide-react";
import { listSaves, type ServerSave } from "../../lib/saveApi";
import SaveLoadMenu from "./SaveLoadMenu";
import { loadAutosave } from "../../lib/autosaveStorage";
import { HeroBackground } from "./HeroBackground";
import { trackMenuSelection } from "../../utils/telemetry/gameplayAnalytics";

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
    trackMenuSelection({ selection: 'resume_autosave', location: 'main_menu' });
    loadGameState(autosave.gameState, { source: 'main_menu_autosave' });
  };

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <HeroBackground />
      <div className="absolute top-4 right-4 z-20 pointer-events-auto">
        <a
          href="/animations"
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[11px] text-white/80 backdrop-blur transition hover:border-amber-300 hover:text-white"
          aria-label="Open Animation Lab"
        >
          Animation Lab
        </a>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <ContentShell size="md" shimmerBorder showCornerOrnaments>
          <div className="p-6 space-y-6">
            <PanelHeader
              icon={<HeaddressIcon size="lg" />}
              title="Chronicles of the Promised Land"
              description="A Book of Mormon Strategy Game"
              animated
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

                  <StepFretDivider />
                </>
              )}

              <GlowingButton
                onClick={() => {
                  trackMenuSelection({ selection: 'single_player_vs_ai', location: 'main_menu' });
                  setGamePhase('playerSetup');
                }}
                data-testid="main-menu-single-player"
                className="w-full"
                size="lg"
                variant={savedGames.length > 0 ? "secondary" : "default"}
              >
                <span className="flex items-center justify-center gap-2">
                  <WarriorShieldIcon />
                  Single Player vs AI
                </span>
              </GlowingButton>

              <GlowingButton
                onClick={() => {
                  trackMenuSelection({ selection: 'local_multiplayer', location: 'main_menu' });
                  setGamePhase('playerSetup');
                }}
                data-testid="main-menu-local-multiplayer"
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
                onClick={() => {
                  trackMenuSelection({ selection: 'online_multiplayer', location: 'main_menu' });
                  setGamePhase('lobbies');
                }}
                data-testid="main-menu-online-multiplayer"
                variant="secondary"
                className="w-full"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2">
                  <Globe />
                  Online Multiplayer
                </span>
              </GlowingButton>

              <StepFretDivider />

              <GlowingButton
                onClick={() => {
                  trackMenuSelection({ selection: 'open_load_menu', location: 'main_menu' });
                  setShowLoadMenu(true);
                }}
                data-testid="main-menu-load-saved"
                variant="secondary"
                className="w-full"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2">
                  <FolderOpen />
                  Load Saved Game
                </span>
              </GlowingButton>

              <GlowingButton
                onClick={() => {
                  trackMenuSelection({ selection: 'tutorial_episode', location: 'main_menu' });
                  setGamePhase('tutorialEpisodeIntro');
                }}
                data-testid="menu-tutorial-episode"
                variant="secondary"
                className="w-full"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2">
                  <TempleIcon />
                  Tutorial Episode
                </span>
              </GlowingButton>
            </div>

            <div className="pt-4">
              <StepFretDivider size="sm" />
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
