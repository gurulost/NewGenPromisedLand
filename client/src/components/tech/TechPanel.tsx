import React, { useState, useMemo } from 'react';
import { Book, X, Lock, CheckCircle } from 'lucide-react';
import { useGesture } from '@use-gesture/react';

import { PanelShell } from '../primitives/PanelShell';  
import { PanelHeader } from '../primitives/PanelHeader';
import { GlowingButton } from '../primitives/GlowingButton';
import { ResourceDeltaBadge } from '../ui/WorldElementPanel';

import { GameState, PlayerState } from '@shared/types/game';
import { getTechValidation } from '../../selectors/tech';
import { TECHNOLOGIES } from '@shared/data/technologies';

interface TechPanelProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  currentPlayer: PlayerState;
  onResearchTech: (techId: string) => void;
}

export function TechPanel({ isOpen, onClose, gameState, currentPlayer, onResearchTech }: TechPanelProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  
  const techValidation = useMemo(() => 
    getTechValidation(currentPlayer, gameState),
    [currentPlayer, gameState]
  );

  // Gesture handling for pinch-zoom and pan
  const bind = useGesture({
    onDrag: ({ offset: [x, y] }) => setPosition({ x, y }),
    onPinch: ({ offset: [scale] }) => setZoom(Math.max(0.5, Math.min(2, scale))),
  });

  return (
    <PanelShell 
      isOpen={isOpen} 
      onClose={onClose}
      fullScreen
      aria-labelledby="tech-panel-title"
    >
      <div className="h-full flex flex-col">
        <PanelHeader
          icon={<Book className="w-6 h-6" />}
          title="Sacred Knowledge Tree"
          description="Research technologies inspired by Book of Mormon civilizations"
          onClose={onClose}
        />

        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Tech Tree Visualization */}
          <div className="flex-1 bg-slate-800/30 rounded-lg border border-amber-500/20 overflow-hidden">
            <div 
              {...bind()}
              className="w-full h-full cursor-move select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'center center'
              }}
            >
              <TechTree 
                technologies={TECHNOLOGIES}
                currentPlayer={currentPlayer}
                techValidation={techValidation}
                onSelectTech={setSelectedTech}
                selectedTech={selectedTech}
              />
            </div>
          </div>

          {/* Tech Details Panel */}
          {selectedTech && (
            <div className="w-80 bg-slate-800/40 rounded-lg border border-amber-500/20 p-4">
              <TechDetailsPanel 
                techId={selectedTech}
                currentPlayer={currentPlayer}
                techValidation={techValidation}
                onResearch={onResearchTech}
                onClose={() => setSelectedTech(null)}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-amber-500/20">
          <div className="flex gap-2">
            <GlowingButton
              variant="outline"
              size="sm"
              glowColor="blue"
              onClick={() => setZoom(1)}
            >
              Reset Zoom
            </GlowingButton>
            <GlowingButton
              variant="outline"
              size="sm"
              glowColor="blue"
              onClick={() => setPosition({ x: 0, y: 0 })}
            >
              Center View
            </GlowingButton>
          </div>
          
          <div className="text-sm text-amber-300/70">
            Drag to pan • Pinch to zoom • Click tech for details
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

const TechTree = React.memo(({ technologies, currentPlayer, techValidation, onSelectTech, selectedTech }: {
  technologies: any;
  currentPlayer: PlayerState;
  techValidation: any;
  onSelectTech: (techId: string) => void;
  selectedTech: string | null;
}) => (
  <div className="relative w-full h-full min-w-[1200px] min-h-[800px] p-8">
    {/* Tech nodes would be positioned based on techLayout.ts */}
    <div className="grid grid-cols-4 gap-8 h-full">
      {Object.entries(technologies).map(([techId, tech]: [string, any]) => (
        <TechNode
          key={techId}
          techId={techId}
          tech={tech}
          isResearched={currentPlayer.researchedTechs.includes(techId)}
          canResearch={techValidation.canResearch(techId)}
          isSelected={selectedTech === techId}
          onClick={() => onSelectTech(techId)}
        />
      ))}
    </div>
  </div>
));

const TechNode = React.memo(({ techId, tech, isResearched, canResearch, isSelected, onClick }: {
  techId: string;
  tech: any;
  isResearched: boolean;
  canResearch: boolean;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <div 
    className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all duration-200 ${
      isResearched 
        ? 'bg-green-900/30 border-green-400/60 shadow-green-400/25' 
        : canResearch
        ? 'bg-amber-900/30 border-amber-400/60 hover:border-amber-300/80 shadow-amber-400/25'
        : 'bg-slate-800/30 border-slate-600/40 opacity-60'
    } ${
      isSelected ? 'ring-2 ring-amber-400 scale-105' : ''
    }`}
    onClick={onClick}
  >
    {/* Status Icon */}
    <div className="absolute -top-2 -right-2">
      {isResearched ? (
        <CheckCircle className="w-6 h-6 text-green-400 bg-slate-900 rounded-full" />
      ) : !canResearch ? (
        <Lock className="w-5 h-5 text-slate-400 bg-slate-900 rounded-full p-1" />
      ) : null}
    </div>
    
    <h4 className="font-cinzel font-semibold text-amber-200 mb-2 text-sm">
      {tech.name}
    </h4>
    
    <p className="text-xs text-amber-300/70 line-clamp-3">
      {tech.description}
    </p>
    
    {!isResearched && (
      <div className="mt-3 flex justify-center">
        <ResourceDeltaBadge value={tech.cost} type="costStars" />
      </div>
    )}
  </div>
));

const TechDetailsPanel = React.memo(({ techId, currentPlayer, techValidation, onResearch, onClose }: {
  techId: string;
  currentPlayer: PlayerState;
  techValidation: any;
  onResearch: (techId: string) => void;
  onClose: () => void;
}) => {
  const tech = TECHNOLOGIES[techId as keyof typeof TECHNOLOGIES];
  const isResearched = currentPlayer.researchedTechs.includes(techId);
  const canResearch = techValidation.canResearch(techId);
  
  if (!tech) return null;
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <h3 className="font-cinzel font-bold text-amber-200 text-lg">{tech.name}</h3>
        <button
          onClick={onClose}
          className="text-amber-300 hover:text-amber-100 transition-colors"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <p className="text-sm text-amber-300/80 leading-relaxed">
        {tech.description}
      </p>
      
      {tech.description && (
        <div className="bg-blue-900/20 rounded-lg p-3 border border-blue-500/20">
          <p className="text-xs text-blue-200 italic">
            Additional details about this technology...
          </p>
        </div>
      )}
      
      {tech.unlocks && Object.values(tech.unlocks).some(arr => arr && arr.length > 0) && (
        <div>
          <h4 className="font-cinzel font-semibold text-amber-200 mb-2">Unlocks:</h4>
          <ul className="space-y-1">
            {Object.entries(tech.unlocks).map(([category, items]) => 
              items && items.length > 0 ? items.map((item: string, index: number) => (
                <li key={`${category}-${index}`} className="text-sm text-amber-300/70 flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  {item} ({category})
                </li>
              )) : null
            ).flat().filter(Boolean)}
          </ul>
        </div>
      )}
      
      {!isResearched && (
        <div className="space-y-3 pt-4 border-t border-amber-500/20">
          <div className="flex justify-between items-center">
            <span className="text-sm text-amber-300">Research Cost:</span>
            <ResourceDeltaBadge value={tech.cost} type="costStars" />
          </div>
          
          <GlowingButton
            variant="default"
            className="w-full"
            glowColor="amber"
            intensity="high"
            disabled={!canResearch}
            onClick={() => onResearch(techId)}
            soundEffect="cta-click"
          >
            {canResearch ? 'Research Technology' : 'Requirements Not Met'}
          </GlowingButton>
          
          {!canResearch && (
            <div className="text-xs text-red-300 bg-red-900/20 rounded px-3 py-2 border border-red-500/30">
              Prerequisites not met or insufficient stars
            </div>
          )}
        </div>
      )}
    </div>
  );
});