import React, { createContext, useContext, useEffect } from 'react';
import { useAudioIntegration, useGameAudio } from '../../hooks/useAudioIntegration';

interface AudioContextType {
  gameAudio: ReturnType<typeof useGameAudio>;
}

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { playSfx } = useAudioIntegration();
  const gameAudio = useGameAudio();

  return (
    <AudioContext.Provider value={{ gameAudio }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudioContext() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioContext must be used within AudioProvider');
  }
  return context;
}

/**
 * HOC to add audio feedback to any component
 */
export function withAudio<T extends Record<string, any>>(
  Component: React.ComponentType<T>
) {
  return function AudioEnhancedComponent(props: T) {
    const { gameAudio } = useAudioContext();
    
    return <Component {...props} gameAudio={gameAudio} />;
  };
}