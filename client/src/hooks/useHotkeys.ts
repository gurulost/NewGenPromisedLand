import { useEffect, useRef } from 'react';

const isEditableTarget = (target: EventTarget | null) => {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

export function useHotkeys(keys: string | string[], callback: () => void, deps: any[] = []) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const keyList = Array.isArray(keys) ? keys : [keys];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }

      const eventKey = event.key ? event.key.toLowerCase() : '';
      const isEscape = event.code === 'Escape' || eventKey === 'escape';
      if (!isEscape && isEditableTarget(event.target)) {
        return;
      }

      const keyPressed = keyList.some((key) => {
        const normalizedKey = key.replace('Key', '').toLowerCase();
        return event.code === key || eventKey === normalizedKey;
      });

      if (keyPressed) {
        event.preventDefault();
        callbackRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keys, ...deps]);
}
