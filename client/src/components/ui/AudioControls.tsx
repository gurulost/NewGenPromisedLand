import React from 'react';
import { Volume2, VolumeX, Music, Zap } from 'lucide-react';
import { Button } from './button';
import { Slider } from './slider';
import { Card, CardContent } from './card';
import { useAudioControls } from '../../hooks/useAudioIntegration';
import { Tooltip } from './TooltipSystem';

interface AudioControlsProps {
  compact?: boolean;
  className?: string;
}

export function AudioControls({ compact = false, className = '' }: AudioControlsProps) {
  const {
    isMuted,
    musicVolume,
    sfxVolume,
    toggleMute,
    setMusicVolume,
    setSfxVolume,
    startBackgroundMusic,
    stopBackgroundMusic
  } = useAudioControls();

  const handleMuteToggle = () => {
    const wasMuted = isMuted;
    toggleMute();
    
    // Start background music if unmuting
    if (wasMuted) {
      startBackgroundMusic();
    }
  };

  // Compact version for mobile/small screens
  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Tooltip
          content={
            <div className="text-center">
              <div className="font-semibold">{isMuted ? 'Unmute Audio' : 'Mute Audio'}</div>
              <div className="text-xs text-slate-300 mt-1">
                Click to {isMuted ? 'enable' : 'disable'} all game audio
              </div>
            </div>
          }
        >
          <Button
            variant="outline"
            size="sm"
            onClick={handleMuteToggle}
            className={`
              w-8 h-8 p-0 rounded-full border-2 transition-all duration-200
              ${isMuted 
                ? 'border-red-400/60 bg-red-600/20 text-red-300 hover:bg-red-600/40' 
                : 'border-green-400/60 bg-green-600/20 text-green-300 hover:bg-green-600/40'
              }
            `}
            aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
        </Tooltip>
      </div>
    );
  }

  // Full version for desktop
  return (
    <Card className={`bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/30 shadow-lg ${className}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span className="text-amber-100 font-semibold text-sm">Audio Controls</span>
          </div>
          
          <Tooltip
            content={
              <div className="text-center">
                <div className="font-semibold">{isMuted ? 'Unmute Audio' : 'Mute Audio'}</div>
                <div className="text-xs text-slate-300 mt-1">
                  Master audio control - affects all game sounds
                </div>
              </div>
            }
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handleMuteToggle}
              className={`
                transition-all duration-200 border-2
                ${isMuted 
                  ? 'border-red-400/60 bg-red-600/20 text-red-300 hover:bg-red-600/40' 
                  : 'border-green-400/60 bg-green-600/20 text-green-300 hover:bg-green-600/40'
                }
              `}
              aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 mr-1" />
                  Muted
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-1" />
                  Active
                </>
              )}
            </Button>
          </Tooltip>
        </div>

        {/* Volume Controls - Only show when not muted */}
        {!isMuted && (
          <div className="space-y-3">
            {/* Music Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music className="w-3 h-3 text-blue-400" />
                  <label className="text-xs text-blue-300 font-medium">
                    Background Music
                  </label>
                </div>
                <span className="text-xs text-slate-300">
                  {Math.round(musicVolume * 100)}%
                </span>
              </div>
              <Slider
                value={[musicVolume]}
                onValueChange={(value) => setMusicVolume(value[0])}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
                aria-label="Background music volume"
              />
            </div>

            {/* SFX Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <label className="text-xs text-yellow-300 font-medium">
                    Sound Effects
                  </label>
                </div>
                <span className="text-xs text-slate-300">
                  {Math.round(sfxVolume * 100)}%
                </span>
              </div>
              <Slider
                value={[sfxVolume]}
                onValueChange={(value) => setSfxVolume(value[0])}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
                aria-label="Sound effects volume"
              />
            </div>
          </div>
        )}

        {/* Muted State Message */}
        {isMuted && (
          <div className="text-center py-2">
            <div className="text-slate-400 text-xs">
              All audio is currently muted
            </div>
            <div className="text-slate-500 text-xs mt-1">
              Click "Muted" above to re-enable audio
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AudioControls;