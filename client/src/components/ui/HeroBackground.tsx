import { useEffect, useRef, useState } from "react";

export function HeroBackground() {
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.load();
    }
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fallback Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
        style={{
          backgroundImage: "url(/assets/hero-image.avif)",
          opacity: videoEnded || !videoLoaded ? 1 : 0,
        }}
      />

      {/* Hero Video */}
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${videoEnded ? "opacity-0" : "opacity-100"
          }`}
        autoPlay
        muted
        playsInline
        onEnded={() => setVideoEnded(true)}
        onLoadedData={() => setVideoLoaded(true)}
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

