import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getFaction } from "@shared/data/factions";
import { useState, useEffect } from "react";

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

// Preload all images for instant display
const preloadedImages = new Map<string, HTMLImageElement>();

const preloadImages = () => {
  BACKGROUND_IMAGES.forEach(imageName => {
    if (!preloadedImages.has(imageName)) {
      const img = new Image();
      img.src = `/images/rotating_images/${imageName}`;
      preloadedImages.set(imageName, img);
    }
  });
};

// Start preloading immediately when module loads
if (typeof window !== 'undefined') {
  preloadImages();
}

export default function HandoffScreen() {
  const { gameState, setGamePhase } = useLocalGame();
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  // Select a random background image when component mounts
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * BACKGROUND_IMAGES.length);
    const selectedImage = BACKGROUND_IMAGES[randomIndex];
    const imagePath = `/images/rotating_images/${selectedImage}`;
    
    // Check if image is preloaded, if so show immediately
    if (preloadedImages.has(selectedImage)) {
      setBackgroundImage(imagePath);
      setImageLoaded(true);
    } else {
      // Fallback loading if preload didn't complete
      const img = new Image();
      img.onload = () => {
        setBackgroundImage(imagePath);
        setImageLoaded(true);
      };
      img.src = imagePath;
    }
  }, []); // Empty dependency array ensures this runs once per mount

  if (!gameState) {
    return null;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const faction = getFaction(currentPlayer.factionId as any);

  const handleStartTurn = () => {
    setGamePhase('playing');
  };

  return (
    <div 
      className="w-full h-full flex items-center justify-center relative overflow-hidden transition-opacity duration-300"
      style={{
        backgroundImage: imageLoaded ? `url(${backgroundImage})` : 'linear-gradient(135deg, #1e293b 0%, #7c3aed 50%, #1e293b 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: imageLoaded ? 1 : 0.8
      }}
    >
      {/* Dark overlay to ensure text readability - removed blur for clear image visibility */}
      <div className="absolute inset-0 bg-black/50"></div>
      
      {/* Content wrapper with relative positioning */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
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
    </div>
  );
}
