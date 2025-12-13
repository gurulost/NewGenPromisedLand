import { useState, useEffect, createContext, useContext } from 'react';

interface TouchModeContext {
  isTouchDevice: boolean;
  forceTouchMode: boolean;
  setForceTouchMode: (force: boolean) => void;
}

const TouchModeContext = createContext<TouchModeContext>({
  isTouchDevice: false,
  forceTouchMode: false,
  setForceTouchMode: () => {},
});

export function useTouchMode() {
  return useContext(TouchModeContext);
}

export function useTouchModeProvider() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [forceTouchMode, setForceTouchMode] = useState(false);

  useEffect(() => {
    const detectTouch = () => {
      const hasTouch = 
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches;
      
      setIsTouchDevice(hasTouch);
    };

    detectTouch();

    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const handleChange = () => detectTouch();
    
    mediaQuery.addEventListener('change', handleChange);
    window.addEventListener('touchstart', () => setIsTouchDevice(true), { once: true });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isTouchDevice || forceTouchMode) {
      root.classList.add('touch-mode');
    } else {
      root.classList.remove('touch-mode');
    }
  }, [isTouchDevice, forceTouchMode]);

  return {
    isTouchDevice: isTouchDevice || forceTouchMode,
    forceTouchMode,
    setForceTouchMode,
    TouchModeContext,
  };
}

export { TouchModeContext };
