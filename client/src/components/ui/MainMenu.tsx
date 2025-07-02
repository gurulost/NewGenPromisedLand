import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { useState, useEffect, useRef } from "react";

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
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
          videoEnded ? 'opacity-0' : 'opacity-100'
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
  const { setGamePhase } = useLocalGame();

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <HeroBackground />
      
      <Card className="relative z-10 w-96 bg-black/90 backdrop-blur-md border-amber-500/30 text-white shadow-2xl">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-4xl font-cinzel font-bold text-amber-300 mb-3 tracking-wide leading-tight drop-shadow-lg">
            Chronicles of the Promised Land
          </CardTitle>
          <p className="text-amber-100/90 text-base font-body font-medium tracking-wide drop-shadow-md">
            A Book of Mormon Strategy Game
          </p>
        </CardHeader>
        
        <CardContent className="space-y-5">
          <Button
            onClick={() => setGamePhase('playerSetup')}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 text-lg font-semibold shadow-lg transition-all duration-200 hover:shadow-xl"
          >
            Pass-and-Play (Local)
          </Button>
          
          <Button
            variant="outline"
            className="w-full border-gray-500/50 text-gray-300 hover:bg-white/10 hover:border-gray-400 py-4 text-lg backdrop-blur-sm transition-all duration-200"
            disabled
          >
            Single Player (Coming Soon)
          </Button>
          
          <Button
            variant="outline"
            className="w-full border-gray-500/50 text-gray-300 hover:bg-white/10 hover:border-gray-400 py-4 text-lg backdrop-blur-sm transition-all duration-200"
            disabled
          >
            Online Multiplayer (Coming Soon)
          </Button>
          
          <div className="mt-8 pt-6 border-t border-amber-500/20">
            <p className="text-sm text-amber-100/70 text-center leading-relaxed font-body">
              Lead your people through faith, struggle, and triumph in the ancient Americas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
