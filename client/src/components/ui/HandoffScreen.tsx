import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { resolveUiTurnPlayer } from "../../lib/turnPresentation";
import { getFaction } from "@shared/data/factions";
import { GlowingButton } from "../primitives/GlowingButton";
import { AvatarBadge } from "../primitives/AvatarBadge";
import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { Play, Clock } from "lucide-react";
import { useHotkeys } from "../../hooks/useHotkeys";

// List of all available background images
const BACKGROUND_IMAGES = [
  'gurulost_Beautiful_starry_sky_--ar_7758_--profile_2vwm1m5_--v_4fbdae50-fb09-4b18-9679-8408effea140_2-min.png',
  'magnifics_upscale-1ssBKwwuqWqtx9ashhF7-IMG_0347-min.png',
  'magnifics_upscale-4FNqXmYoU9d05I2h0QRx-IMG_0331-min.png',
  'magnifics_upscale-53tsJYGaxCdV1z1hhaej-IMG_0329-min.png',
  'magnifics_upscale-570Hzxtjqn3qfkz7fxim-IMG_0353-min.png',
  'magnifics_upscale-7tEVi7NcuZlkOMypT5GQ-IMG_0324-min.png',
  'magnifics_upscale-BZHXJwuVvOsNMuc3LCxK-IMG_0355-min.png',
  'magnifics_upscale-CpO2UpRa9ciZrE8b9Ub2-IMG_0361-min.png',
  'magnifics_upscale-D1lh7dKdKmvBWeUtkjPd-IMG_0352-min.png',
  'magnifics_upscale-G7eAcUMj3GJvsju0MwMh-IMG_0346-min.png',
  'magnifics_upscale-Lq6Mzwnqjsd0SbY9QPBY-IMG_0333-min.png',
  'magnifics_upscale-PqLEGEiD7SkaS30xLAgd-IMG_0344-min.png',
  'magnifics_upscale-RcMVI6o8TnjsKcfQN44y-IMG_0356-min.png',
  'magnifics_upscale-RkG5TnZP5toW6ZfPtOfp-IMG_0357-min.png',
  'magnifics_upscale-SPQ8bIQPBknAlKOfzw4q-IMG_0362-min.png',
  'magnifics_upscale-TdzgvOSg188nlso67ep7-IMG_0345-min.png',
  'magnifics_upscale-VXii6LKvKvzZzwuGSvto-IMG_0358-min.png',
  'magnifics_upscale-aWMfnMu3TsWlQri91IZs-IMG_0338-min.png',
  'magnifics_upscale-b2wp0A7myzNE31iiYi2E-IMG_0319-min.png',
  'magnifics_upscale-bMYxXaxQsSVUX63s1kPv-IMG_0350-min.png',
  'magnifics_upscale-bglZRGLzjyE7zgse9Muy-IMG_0354-min.png',
  'magnifics_upscale-cKXVF7ChkO1HtfnmoAiB-IMG_0330-min.png',
  'magnifics_upscale-eV9etXQdhFcY4d6E0uDa-IMG_0336-min.png',
  'magnifics_upscale-hcaMGYNISlOJFlEXcaUv-IMG_0335-min.png',
  'magnifics_upscale-hnWxFitkUkHDEO1TZyIM-IMG_0317-min.png',
  'magnifics_upscale-i2Wm2EnoBiUfF1CxyEfH-IMG_0348-min.png',
  'magnifics_upscale-j9mce8ieNCfTRpqOCUeQ-IMG_0334-min.png',
  'magnifics_upscale-lkZr36PQQoWy1hp4br2x-IMG_0360-min.png',
  'magnifics_upscale-oVbi1RTbVX9HzFOPXlX4-IMG_0342-min.png',
  'magnifics_upscale-sMVFGILtFl4OUhDLVEkZ-IMG_0320-min.png',
  'magnifics_upscale-tdzMmbmhMeE7x8F2BNwq-IMG_0359-min.png',
  'magnifics_upscale-vyFZJy5MDLVFZr9BMwbB-IMG_0323-min.png',
  'magnifics_upscale-x4FPKzh8EiSxrjlhLgJd-IMG_0325-min.png',
  'magnifics_upscale-zef3xiojQOSs8MAIGb6w-IMG_0332-min.png',
  'magnifics_upscale-zr6uwxMiG09mW0ByxKFZ-IMG_0326-min.png'
];

// Track loaded images to avoid reloading in the same session.
const loadedImages = new Set<string>();

export default function HandoffScreen() {
  const { gameState, turnPresentation, setGamePhase, onlineSession } = useLocalGame();
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageFailed, setImageFailed] = useState<boolean>(false);

  useHotkeys('Space', () => setGamePhase('playing'));
  useHotkeys('Enter', () => setGamePhase('playing'));

  // Select a random background image when component mounts
  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    const randomIndex = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
    const selectedImage = BACKGROUND_IMAGES[randomIndex];
    const imagePath = `/images/rotating_images/${selectedImage}`;

    // If already loaded, display immediately; otherwise load on demand.
    if (loadedImages.has(selectedImage)) {
      setBackgroundImage(imagePath);
      setImageLoaded(true);
    } else {
      // Fallback loading if preload didn't complete
      const img = new Image();
      img.onload = () => {
        setBackgroundImage(imagePath);
        setImageLoaded(true);
        loadedImages.add(selectedImage);
      };
      img.onerror = () => {
        setBackgroundImage('');
        setImageFailed(true);
        setImageLoaded(true);
      };
      img.src = imagePath;
    }

    const prefetchLimit = 3;
    const available = BACKGROUND_IMAGES.filter(
      (image) => image !== selectedImage && !loadedImages.has(image)
    );
    const picks: string[] = [];
    const pool = [...available];
    while (pool.length > 0 && picks.length < prefetchLimit) {
      const idx = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(idx, 1)[0]);
    }

    const preload = () => {
      picks.forEach((image) => {
        const src = `/images/rotating_images/${image}`;
        const prefetch = new Image();
        prefetch.onload = () => {
          loadedImages.add(image);
        };
        prefetch.src = src;
      });
    };

    const idleCallback = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const cancelIdle = (window as any).cancelIdleCallback as
      | ((id: number) => void)
      | undefined;

    const idleId = idleCallback
      ? idleCallback(preload, { timeout: 2000 })
      : window.setTimeout(preload, 400);

    return () => {
      if (idleCallback && cancelIdle) {
        cancelIdle(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, []); // Empty dependency array ensures this runs once per mount

  if (!gameState) {
    return null;
  }

  const currentPlayer = resolveUiTurnPlayer(gameState, turnPresentation?.player ?? null);

  if (!currentPlayer) {
    console.warn('HandoffScreen: currentPlayer is undefined at index', gameState.currentPlayerIndex);
    return null;
  }

  const faction = getFaction(currentPlayer.factionId as any);
  const isOnline = !!onlineSession;
  const subtitle = isOnline ? "Ready for your turn?" : "Pass the device to the next player";

  const handleStartTurn = () => {
    setGamePhase('playing');
  };

  const isPendingImage = !imageLoaded && !imageFailed;
  const hasCustomImage = !!backgroundImage && !imageFailed;

  return (
    <div 
      className="w-full h-full flex items-center justify-center relative overflow-hidden transition-opacity duration-300"
      style={{
        backgroundImage: hasCustomImage
          ? `url(${backgroundImage})`
          : 'linear-gradient(135deg, #1e293b 0%, #7c3aed 50%, #1e293b 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: isPendingImage ? 0.8 : 1
      }}
    >
      {/* Elegant handoff panel with improved styling */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <ContentShell size="md">
          <div className="p-6 space-y-6 text-center">
            <PanelHeader
              icon={<Clock />}
              title={`${currentPlayer.name}'s Turn`}
              description={subtitle}
            />
            
            {/* Player info with AvatarBadge */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <AvatarBadge 
                playerId={currentPlayer.id}
                playerName={currentPlayer.name}
                factionId={currentPlayer.factionId as any}
                size="large"
                className="shadow-2xl shadow-amber-500/30"
              />
              <div className="text-center">
                <div className="text-2xl font-bold font-cinzel text-amber-100">
                  {currentPlayer.name}
                </div>
                <div className="text-lg text-amber-300 font-body">
                  {faction.name}
                </div>
              </div>
            </motion.div>
            
            {/* Turn indicator */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex items-center justify-center gap-2 text-amber-100/70 font-body"
            >
              <Clock className="w-4 h-4" />
              <span>Turn {gameState.turn}</span>
            </motion.div>
            
            {/* Call-to-action button */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
            >
              <GlowingButton
                onClick={handleStartTurn}
                data-testid="handoff-start-turn-button"
                className="w-full flex items-center gap-2 justify-center"
                size="lg"
              >
                <Play />
                Start Turn
              </GlowingButton>
              <div className="mt-3 text-xs text-amber-200/70 font-body">
                Press Space or Enter to start
              </div>
            </motion.div>
          </div>
        </ContentShell>
      </div>
    </div>
  );
}
