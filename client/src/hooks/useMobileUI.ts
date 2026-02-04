import { useEffect, useMemo, useState } from 'react';
import { useTouchMode } from './useTouchMode';

const MOBILE_MAX_WIDTH = 900;
const MOBILE_MAX_HEIGHT = 700;

interface ViewportState {
  width: number;
  height: number;
}

export function useMobileUI() {
  const { isTouchDevice } = useTouchMode();
  const [viewport, setViewport] = useState<ViewportState>(() => {
    if (typeof window === 'undefined') {
      return { width: 0, height: 0 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const isPortrait = viewport.width > 0 && viewport.height > viewport.width;
  const isSmallViewport =
    viewport.width > 0 &&
    (viewport.width <= MOBILE_MAX_WIDTH || viewport.height <= MOBILE_MAX_HEIGHT);
  const isMobileUI = isTouchDevice && isSmallViewport;

  return useMemo(
    () => ({
      isTouchDevice,
      isSmallViewport,
      isPortrait,
      isMobileUI,
      width: viewport.width,
      height: viewport.height,
    }),
    [isTouchDevice, isSmallViewport, isPortrait, isMobileUI, viewport.width, viewport.height]
  );
}
