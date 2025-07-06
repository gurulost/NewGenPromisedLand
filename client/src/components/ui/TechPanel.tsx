import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { Separator } from "./separator";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { TECHNOLOGIES, getAvailableTechnologies, calculateResearchCost, type Technology } from "@shared/data/technologies";
import { Star, Book, Swords, Church, Map, Lock, CheckCircle, Clock, Sparkles } from "lucide-react";

interface TechPanelProps {
  open: boolean;
  onClose: () => void;
}

// Define tech tree layout positions with proper spacing
const TECH_POSITIONS: Record<string, { x: number; y: number; tier: number }> = {
  // Tier 1 - Starting techs (prerequisites: none) - spread out more
  organization: { x: 1, y: 1, tier: 1 },
  hunting: { x: 3, y: 1, tier: 1 },
  spirituality: { x: 5, y: 1, tier: 1 },
  
  // Tier 2 - Early development - avoid overlapping
  agriculture: { x: 0.5, y: 2.5, tier: 2 },
  bronze_working: { x: 2, y: 2.5, tier: 2 },
  sailing: { x: 3.5, y: 2.5, tier: 2 },
  priesthood: { x: 5.5, y: 2.5, tier: 2 },
  
  // Tier 3 - Advanced - well spaced
  engineering: { x: 1, y: 4, tier: 3 },
  philosophy: { x: 4, y: 4, tier: 3 },
};

type TechStatus = 'researched' | 'available' | 'locked' | 'researching';

export default function TechPanel({ open, onClose }: TechPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [hoveredTech, setHoveredTech] = useState<string | null>(null);
  
  // Always call hooks before any early returns
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const availableTechs = currentPlayer ? getAvailableTechnologies(currentPlayer.researchedTechs) : [];
  const researchedCount = currentPlayer?.researchedTechs.length || 0;
  
  const techStatuses = useMemo(() => {
    if (!currentPlayer) return {};
    
    const statuses: Record<string, TechStatus> = {};
    
    Object.keys(TECHNOLOGIES).forEach(techId => {
      const tech = TECHNOLOGIES[techId];
      const isResearched = currentPlayer.researchedTechs.includes(techId);
      
      if (isResearched) {
        statuses[techId] = 'researched';
      } else {
        // Check if all prerequisites are met
        const hasPrerequisites = tech.prerequisites.every(prereq => 
          currentPlayer.researchedTechs.includes(prereq)
        );
        
        // Check if player can afford the research
        const canAfford = currentPlayer.stars >= tech.cost;
        
        if (hasPrerequisites && canAfford) {
          statuses[techId] = 'available';
        } else {
          statuses[techId] = 'locked';
        }
      }
    });
    
    Object.keys(TECHNOLOGIES).forEach(techId => {
      if (currentPlayer.researchedTechs.includes(techId)) {
        statuses[techId] = 'researched';
      } else if (currentPlayer.currentResearch === techId) {
        statuses[techId] = 'researching';
      } else if (availableTechs.some(tech => tech.id === techId)) {
        statuses[techId] = 'available';
      } else {
        statuses[techId] = 'locked';
      }
    });
    
    return statuses;
  }, [currentPlayer, availableTechs]);
  
  // Early return after all hooks are called
  if (!open || !gameState || !currentPlayer) return null;
  
  const handleResearchTech = (techId: string) => {
    const tech = TECHNOLOGIES[techId];
    if (!tech) return;
    
    const cost = calculateResearchCost(tech, researchedCount);
    
    if (currentPlayer.stars >= cost) {
      dispatch({
        type: 'RESEARCH_TECHNOLOGY',
        payload: {
          playerId: currentPlayer.id,
          technologyId: techId,
        }
      });
    }
  };
  
  const getTechStatusIcon = (status: TechStatus) => {
    switch (status) {
      case 'researched': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'available': return <Sparkles className="w-5 h-5 text-blue-400" />;
      case 'researching': return <Clock className="w-5 h-5 text-yellow-400" />;
      case 'locked': return <Lock className="w-5 h-5 text-gray-400" />;
    }
  };
  
  const getTechStatusStyles = (status: TechStatus) => {
    switch (status) {
      case 'researched': 
        return 'bg-gradient-to-br from-green-500 to-green-600 border-green-400 shadow-green-500/25 shadow-lg text-white';
      case 'available': 
        return 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400 shadow-blue-500/25 shadow-lg text-white hover:shadow-blue-500/40 hover:scale-105 cursor-pointer';
      case 'researching': 
        return 'bg-gradient-to-br from-yellow-500 to-yellow-600 border-yellow-400 shadow-yellow-500/25 shadow-lg text-white animate-pulse';
      case 'locked': 
        return 'bg-gradient-to-br from-gray-600 to-gray-700 border-gray-500 text-gray-300 opacity-60';
    }
  };
  
  const getCategoryIcon = (category: Technology['category']) => {
    switch (category) {
      case 'economic': return <Star className="w-4 h-4" />;
      case 'military': return <Swords className="w-4 h-4" />;
      case 'religious': return <Church className="w-4 h-4" />;
      case 'exploration': return <Map className="w-4 h-4" />;
    }
  };
  
  const getCategoryGradient = (category: Technology['category']) => {
    switch (category) {
      case 'economic': return 'from-yellow-400 to-amber-500';
      case 'military': return 'from-red-500 to-red-600';
      case 'religious': return 'from-blue-500 to-indigo-600';
      case 'exploration': return 'from-green-500 to-emerald-600';
    }
  };
  
  // Connection lines between techs
  const TechConnection = ({ from, to, status }: { from: string; to: string; status: TechStatus }) => {
    const fromPos = TECH_POSITIONS[from];
    const toPos = TECH_POSITIONS[to];
    
    if (!fromPos || !toPos) return null;
    
    const lineColor = status === 'researched' ? 'stroke-green-400' : 
                     status === 'available' ? 'stroke-blue-400' : 'stroke-gray-600';
    
    return (
      <line
        x1={fromPos.x * 220 + 120}
        y1={fromPos.y * 180 + 90}
        x2={toPos.x * 220 + 120}
        y2={toPos.y * 180 + 90}
        className={`${lineColor} stroke-2 opacity-60`}
        strokeDasharray={status === 'locked' ? '5,5' : '0'}
      />
    );
  };
  
  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
      style={{ pointerEvents: 'auto' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-[95%] h-[95%] max-w-7xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-slate-600/50 rounded-2xl shadow-2xl overflow-hidden"
           onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600/50 p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Book className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-cinzel text-2xl font-bold text-white">Technology Tree</h1>
                <p className="text-slate-300 text-sm">Ancient Knowledge & Divine Wisdom</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-slate-700/50 px-4 py-2 rounded-lg">
                <Star className="w-5 h-5 text-yellow-400" />
                <span className="font-semibold text-white text-lg">{currentPlayer.stars}</span>
                <span className="text-slate-300 text-sm">Stars</span>
              </div>
              
              <Button 
                variant="outline" 
                onClick={onClose}
                className="bg-slate-700/50 border-slate-500 text-white hover:bg-slate-600"
              >
                Close
              </Button>
            </div>
          </div>
          
          {/* Current Research Progress */}
          {currentPlayer.currentResearch && (
            <div className="mt-4 p-4 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  <span className="font-medium text-white">
                    Researching: {TECHNOLOGIES[currentPlayer.currentResearch]?.name}
                  </span>
                </div>
                <span className="text-yellow-300 font-semibold">
                  {currentPlayer.researchProgress}% Complete
                </span>
              </div>
              <Progress 
                value={currentPlayer.researchProgress} 
                className="h-3 bg-slate-700"
              />
            </div>
          )}
        </div>
        
        {/* Tech Tree Canvas */}
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-transparent to-slate-800/30" />
          
          <div className="relative w-full h-full overflow-auto p-8 touch-pan-x touch-pan-y" style={{ 
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x pan-y'
          }}>
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-10">
              <svg className="w-full h-full">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
            </div>
            
            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {Object.entries(TECHNOLOGIES).map(([techId, tech]) =>
                tech.prerequisites.map(prereqId => (
                  <TechConnection
                    key={`${prereqId}-${techId}`}
                    from={prereqId}
                    to={techId}
                    status={techStatuses[prereqId] || 'locked'}
                  />
                ))
              )}
            </svg>
            
            {/* Tech Nodes */}
            <div className="relative" style={{ minHeight: '800px', minWidth: '1400px' }}>
              {Object.entries(TECHNOLOGIES).map(([techId, tech]) => {
                const position = TECH_POSITIONS[techId];
                if (!position) return null;
                
                const status = techStatuses[techId] || 'locked';
                const cost = calculateResearchCost(tech, researchedCount);
                const canAfford = currentPlayer.stars >= cost;
                
                return (
                  <div
                    key={techId}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 ${getTechStatusStyles(status)}`}
                    style={{
                      left: `${position.x * 220 + 120}px`,
                      top: `${position.y * 180 + 90}px`,
                      width: '200px',
                      height: '140px',
                    }}
                    onMouseEnter={() => setHoveredTech(techId)}
                    onMouseLeave={() => setHoveredTech(null)}
                    onClick={() => {
                      setSelectedTech(techId);
                    }}
                  >
                    <div className="p-4 h-full flex flex-col justify-between rounded-xl border-2">
                      {/* Tech Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-cinzel font-semibold text-sm leading-tight mb-1">
                            {tech.name}
                          </h3>
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-gradient-to-r ${getCategoryGradient(tech.category)}`}>
                            {getCategoryIcon(tech.category)}
                            {tech.category}
                          </div>
                        </div>
                        <div className="ml-2">
                          {getTechStatusIcon(status)}
                        </div>
                      </div>
                      
                      {/* Tech Footer */}
                      <div className="flex items-center justify-between">
                        {status === 'available' && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4" />
                            <span className="font-bold text-sm">{cost}</span>
                          </div>
                        )}
                        
                        {status === 'researching' && (
                          <div className="text-xs opacity-90">
                            {currentPlayer.researchProgress}%
                          </div>
                        )}
                        
                        {(status === 'researched' || status === 'locked') && (
                          <div className="text-xs opacity-75">
                            Tier {position.tier}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Glow Effect for Available Techs */}
                    {status === 'available' && (
                      <div className="absolute inset-0 bg-blue-400/20 rounded-xl blur-xl -z-10 animate-pulse" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Side Panel for Selected Tech */}
        {selectedTech && (
          <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-b from-slate-800 to-slate-900 border-l border-slate-600/50 p-6 overflow-y-auto">
            <div className="mb-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedTech(null)}
                className="text-slate-300 hover:text-white mb-4"
              >
                ← Back to Tree
              </Button>
              
              <div className="space-y-4">
                <div>
                  <h2 className="font-cinzel text-xl font-bold text-white mb-2">
                    {TECHNOLOGIES[selectedTech].name}
                  </h2>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {TECHNOLOGIES[selectedTech].description}
                  </p>
                </div>
                
                {/* Prerequisites */}
                {TECHNOLOGIES[selectedTech].prerequisites.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-white mb-2">Prerequisites:</h3>
                    <div className="space-y-1">
                      {TECHNOLOGIES[selectedTech].prerequisites.map((prereqId: string) => (
                        <div key={prereqId} className="flex items-center gap-2 text-sm">
                          {techStatuses[prereqId] === 'researched' ? 
                            <CheckCircle className="w-4 h-4 text-green-400" /> :
                            <Lock className="w-4 h-4 text-red-400" />
                          }
                          <span className={techStatuses[prereqId] === 'researched' ? 'text-green-300' : 'text-red-300'}>
                            {TECHNOLOGIES[prereqId]?.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Unlocks */}
                <div>
                  <h3 className="font-semibold text-white mb-2">Unlocks:</h3>
                  <div className="space-y-2">
                    {TECHNOLOGIES[selectedTech].unlocks.units?.map((unit: string) => (
                      <Badge key={unit} variant="outline" className="text-blue-300 border-blue-500/50">
                        Unit: {unit}
                      </Badge>
                    ))}
                    {TECHNOLOGIES[selectedTech].unlocks.improvements?.map((improvement: string) => (
                      <Badge key={improvement} variant="outline" className="text-green-300 border-green-500/50">
                        Improvement: {improvement}
                      </Badge>
                    ))}
                    {TECHNOLOGIES[selectedTech].unlocks.structures?.map((structure: string) => (
                      <Badge key={structure} variant="outline" className="text-yellow-300 border-yellow-500/50">
                        Structure: {structure}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {/* Research Button */}
                {techStatuses[selectedTech] === 'available' && (
                  <Button
                    onClick={() => handleResearchTech(selectedTech)}
                    disabled={currentPlayer.stars < calculateResearchCost(TECHNOLOGIES[selectedTech], researchedCount)}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    Research for {calculateResearchCost(TECHNOLOGIES[selectedTech], researchedCount)} Stars
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}