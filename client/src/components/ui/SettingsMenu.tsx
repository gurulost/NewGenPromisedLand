import React from 'react';
import { Settings, Volume2, VolumeX, Music, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Button } from './button';
import { Slider } from './slider';
import { Separator } from './separator';
import { useAudioControls } from '../../hooks/useAudioIntegration';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsMenu({ isOpen, onClose }: SettingsMenuProps) {
  const {
    isMuted,
    musicVolume,
    sfxVolume,
    toggleMute,
    setMusicVolume,
    setSfxVolume,
    startBackgroundMusic
  } = useAudioControls();

  const handleMuteToggle = () => {
    const wasMuted = isMuted;
    toggleMute();
    if (wasMuted) {
      startBackgroundMusic();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/40 shadow-2xl shadow-amber-500/20">
        <DialogHeader className="border-b border-amber-500/20 pb-4">
          <DialogTitle className="flex items-center gap-3 text-amber-100 font-cinzel text-xl">
            <Settings className="w-6 h-6 text-amber-400" />
            Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <section>
            <h3 className="text-amber-200 font-semibold text-sm mb-4 uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Audio
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-sm">Master Audio</span>
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
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-4 h-4 mr-1" />
                      Muted
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 mr-1" />
                      On
                    </>
                  )}
                </Button>
              </div>

              {!isMuted && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-300">Music</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {Math.round(musicVolume * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[musicVolume]}
                      onValueChange={(value) => setMusicVolume(value[0])}
                      max={1}
                      min={0}
                      step={0.05}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-yellow-300">Sound Effects</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {Math.round(sfxVolume * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[sfxVolume]}
                      onValueChange={(value) => setSfxVolume(value[0])}
                      max={1}
                      min={0}
                      step={0.05}
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {isMuted && (
                <div className="text-center py-3 bg-slate-800/50 rounded-lg">
                  <p className="text-slate-400 text-sm">
                    Audio is muted. Click the button above to enable.
                  </p>
                </div>
              )}
            </div>
          </section>
          
          <Separator className="bg-amber-500/20" />
          
          <section>
            <h3 className="text-amber-200 font-semibold text-sm mb-3 uppercase tracking-wider">
              Display
            </h3>
            <div className="text-slate-500 text-sm italic bg-slate-800/30 p-3 rounded-lg">
              Additional display options coming soon...
            </div>
          </section>
        </div>

        <div className="flex justify-end pt-4 border-t border-amber-500/20">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-amber-500/40 text-amber-100 hover:bg-amber-500/20"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsMenu;
