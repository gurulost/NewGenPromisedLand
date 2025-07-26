import { useEffect } from 'react';

export function useHotkeys(key: string, callback: () => void, deps: any[] = []) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle both key codes and key names
      const keyPressed = event.code === key || event.key === key.replace('Key', '').toLowerCase();
      
      if (keyPressed) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, ...deps]);
}