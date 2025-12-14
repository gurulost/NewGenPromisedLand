import { useMemo, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { Separator } from "./separator";
import { Input } from "./input";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { TECHNOLOGIES, calculateResearchCost, getAvailableTechnologies, type Technology } from "@shared/data/technologies";
import { Star, Book, Swords, Church, Map, Lock, CheckCircle, Clock, Sparkles, Filter, ArrowUpRight, Search, XCircle, Link as LinkIcon, Home } from "lucide-react";
import { TECH_LAYOUT, CELL_WIDTH, CELL_HEIGHT, COL_GAP, ROW_GAP, CANVAS_PADDING } from "../tech/techLayout";
import { useHaptic } from "../../hooks/useHaptic";

interface TechPanelProps {
  open: boolean;
  onClose: () => void;
}

type TechStatus = "researched" | "available" | "locked" | "researching";
type CategoryFilter = "all" | Technology["category"];

export default function TechPanel({ open, onClose }: TechPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const vibrate = useHaptic();
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CategoryFilter>("all");
  
  // Drag to scroll state - must be before any early returns
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const DRAG_THRESHOLD = 5; // Pixels moved before drag starts

  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const availableTechs = currentPlayer ? getAvailableTechnologies(currentPlayer.researchedTechs) : [];
  const researchedCount = currentPlayer?.researchedTechs.length || 0;
  const normalizedSearch = search.trim().toLowerCase();

  const techStatuses = useMemo(() => {
    if (!currentPlayer) return {};
    const statuses: Record<string, TechStatus> = {};
    Object.keys(TECHNOLOGIES).forEach(techId => {
      if (currentPlayer.researchedTechs.includes(techId)) {
        statuses[techId] = "researched";
      } else if (currentPlayer.currentResearch === techId) {
        statuses[techId] = "researching";
      } else if (availableTechs.some(t => t.id === techId)) {
        statuses[techId] = "available";
      } else {
        statuses[techId] = "locked";
      }
    });
    return statuses;
  }, [currentPlayer, availableTechs]);

  if (!open || !gameState || !currentPlayer) return null;

  const matchesFilter = (techId: string) => {
    const tech = TECHNOLOGIES[techId];
    if (filter !== "all" && tech.category !== filter) return false;
    if (!normalizedSearch) return true;
    return (
      tech.name.toLowerCase().includes(normalizedSearch) ||
      tech.description.toLowerCase().includes(normalizedSearch)
    );
  };

  const handleResearchTech = (techId: string) => {
    const tech = TECHNOLOGIES[techId];
    if (!tech) return;
    const status = techStatuses[techId] || "locked";
    const cost = calculateResearchCost(tech, researchedCount);
    const prerequisitesMet = tech.prerequisites.every(pr => currentPlayer.researchedTechs.includes(pr));
    if (status === "available" && prerequisitesMet && currentPlayer.stars >= cost) {
      vibrate('success'); // Tactical vibration on research
      dispatch({
        type: "RESEARCH_TECHNOLOGY",
        payload: { playerId: currentPlayer.id, technologyId: techId },
      });
    } else {
      vibrate('error'); // Feedback for failed actions
    }
  };

  const getTechStatusIcon = (status: TechStatus) => {
    switch (status) {
      case "researched": return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "available": return <Sparkles className="w-5 h-5 text-blue-400" />;
      case "researching": return <Clock className="w-5 h-5 text-yellow-400" />;
      case "locked": return <Lock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTechStatusStyles = (status: TechStatus) => {
    switch (status) {
      case "researched":
        return "bg-gradient-to-br from-green-900/80 to-green-950/90 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)] text-green-50";
      case "available":
        return "bg-gradient-to-br from-blue-900/80 to-slate-900/90 border-blue-400/60 shadow-[0_0_15px_rgba(59,130,246,0.3)] text-blue-50 hover:scale-105 cursor-pointer hover:border-blue-300";
      case "researching":
        return "bg-gradient-to-br from-amber-900/80 to-amber-950/90 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)] text-amber-50 animate-pulse";
      case "locked":
        return "bg-slate-900/90 border-slate-700 text-slate-500 opacity-80 grayscale";
    }
  };

  const getCategoryIcon = (category: Technology["category"]) => {
    switch (category) {
      case "economic": return <Star className="w-4 h-4" />;
      case "military": return <Swords className="w-4 h-4" />;
      case "religious": return <Church className="w-4 h-4" />;
      case "exploration": return <Map className="w-4 h-4" />;
    }
  };

  const getCategoryGradient = (category: Technology["category"]) => {
    switch (category) {
      case "economic": return "from-yellow-400 to-amber-500";
      case "military": return "from-red-500 to-red-600";
      case "religious": return "from-blue-500 to-indigo-600";
      case "exploration": return "from-green-500 to-emerald-600";
    }
  };

  const ProgressSummary = () => {
    const researched = currentPlayer.researchedTechs.length;
    const total = Object.keys(TECHNOLOGIES).length;
    const pct = Math.min(100, Math.round((researched / total) * 100));
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-100">
            <Sparkles className="w-4 h-4" />
            <span className="font-semibold">Progress</span>
          </div>
          <span className="text-sm text-amber-200/70">{researched} / {total}</span>
        </div>
        <Progress value={pct} className="h-2 bg-slate-700" />
      </div>
    );
  };

  const UnlockBadge = ({ type, name }: { type: 'unit' | 'building' | 'ability' | 'improvement', name: string }) => {
    const getIcon = () => {
      switch (type) {
        case 'unit': return '⚔️';
        case 'building': return '🏛️';
        case 'improvement': return '🔨';
        case 'ability': return '✨';
      }
    };

    // Format name (replace underscores with spaces and capitalize)
    const displayName = name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    return (
      <div className="flex items-center gap-2 p-2 rounded bg-white/5 border border-white/10">
        <span className="text-xl">{getIcon()}</span>
        <span className="text-sm font-medium text-amber-100">{displayName}</span>
      </div>
    );
  };

  const handleTechSelect = (techId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    vibrate('light');
    setSelectedTech(techId);
  };

  const TechNode = ({ techId }: { techId: string }) => {
    const tech = TECHNOLOGIES[techId];
    const pos = TECH_LAYOUT[techId];
    if (!tech || !pos) return null;

    const status = techStatuses[techId] || "locked";
    const x = pos.x * (CELL_WIDTH + COL_GAP) + CANVAS_PADDING;
    const y = pos.y * (CELL_HEIGHT + ROW_GAP) + CANVAS_PADDING;

    const isMatch = matchesFilter(techId);
    if (!isMatch) return null;

    const isSelected = selectedTech === techId;

    return (
      <div
        data-tech-node="true"
        className="absolute transition-all duration-300"
        style={{
          left: x,
          top: y,
          width: CELL_WIDTH,
          height: CELL_HEIGHT,
          touchAction: 'manipulation',
        }}
        onClick={(e) => handleTechSelect(techId, e)}
        onTouchEnd={(e) => {
          if (!isDragging) {
            handleTechSelect(techId, e);
          }
        }}
      >
        <Card
          className={`h-full relative overflow-hidden border-2 ${getTechStatusStyles(status)} cursor-pointer hover:-translate-y-1 hover:shadow-xl transition-all ${isSelected ? 'ring-2 ring-white scale-105 z-10' : ''}`}
        >
          {/* Connecting Nodes (dots) for visual connections */}
          <div className="absolute top-1/2 -left-1 w-2 h-2 bg-current rounded-full opacity-50" />
          <div className="absolute top-1/2 -right-1 w-2 h-2 bg-current rounded-full opacity-50" />

          <CardHeader className="p-3 pb-0">
            <div className="flex justify-between items-start">
              <Badge variant="outline" className="bg-black/30 border-white/20 text-[10px] uppercase tracking-wider mb-1">
                {tech.category}
              </Badge>
              {getTechStatusIcon(status)}
            </div>
            <CardTitle className="text-base leading-tight mt-1">{tech.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-2">
            <p className="text-xs opacity-70 line-clamp-2 mb-2 min-h-[2.5em]">{tech.description}</p>
            <div className="flex items-center justify-between text-xs font-mono bg-black/20 rounded px-2 py-1">
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-amber-400" />
                {calculateResearchCost(tech, researchedCount)}
              </span>
              {status === 'researching' && <span className="text-amber-400 animate-pulse">Researching...</span>}
              {status === 'researched' && <span className="text-green-400">Acquired</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const Connections = () => {
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <defs>
          <linearGradient id="line-gradient-locked" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#475569" />
          </linearGradient>
          <linearGradient id="line-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
          <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
        {Object.keys(TECH_LAYOUT).map(techId => {
          const tech = TECHNOLOGIES[techId];
          const endPos = TECH_LAYOUT[techId];
          if (!tech || !endPos) return null;

          return tech.prerequisites.map(prereqId => {
            const startPos = TECH_LAYOUT[prereqId];
            if (!startPos) return null;

            // Coordinates
            const startX = startPos.x * (CELL_WIDTH + COL_GAP) + CANVAS_PADDING + CELL_WIDTH;
            const startY = startPos.y * (CELL_HEIGHT + ROW_GAP) + CANVAS_PADDING + (CELL_HEIGHT / 2);
            const endX = endPos.x * (CELL_WIDTH + COL_GAP) + CANVAS_PADDING;
            const endY = endPos.y * (CELL_HEIGHT + ROW_GAP) + CANVAS_PADDING + (CELL_HEIGHT / 2);

            // Tech Status
            const isPrereqMet = currentPlayer.researchedTechs.includes(prereqId);
            const isDestinationResearched = currentPlayer.researchedTechs.includes(techId);
            const strokeColor = isDestinationResearched ? "url(#line-gradient-active)" : isPrereqMet ? "#3b82f6" : "#475569";
            const opacity = isPrereqMet ? 0.8 : 0.3;
            const width = isPrereqMet ? 3 : 2;
            const marker = isPrereqMet ? "url(#arrowhead-active)" : "url(#arrowhead)";

            // Curvy path (Bezier)
            const controlPoint1X = startX + (COL_GAP / 2);
            const controlPoint1Y = startY;
            const controlPoint2X = endX - (COL_GAP / 2);
            const controlPoint2Y = endY;

            const d = `M ${startX} ${startY} C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${endX} ${endY}`;

            return (
              <path
                key={`${prereqId}-${techId}`}
                d={d}
                stroke={strokeColor}
                strokeWidth={width}
                fill="none"
                opacity={opacity}
                markerEnd={marker}
              />
            );
          });
        })}
      </svg>
    );
  };

  const detailTech = selectedTech ? TECHNOLOGIES[selectedTech] : null;

  // Drag to scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    // Ignore if clicking on a tech node - let the node handle its own events
    const target = e.target as HTMLElement;
    if (target.closest('[data-tech-node]')) return;
    
    // Don't start dragging yet, just record the starting position
    setIsMouseDown(true);
    setIsDragging(false);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setStartY(e.pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setIsMouseDown(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !containerRef.current) return;
    
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const moveX = Math.abs(x - startX);
    const moveY = Math.abs(y - startY);
    
    // Only start dragging if moved past threshold
    if (!isDragging && (moveX > DRAG_THRESHOLD || moveY > DRAG_THRESHOLD)) {
      setIsDragging(true);
    }
    
    if (isDragging) {
      e.preventDefault();
      const walkX = (x - startX) * 1.5; // Scroll speed multiplier
      const walkY = (y - startY) * 1.5;
      containerRef.current.scrollLeft = scrollLeft - walkX;
      containerRef.current.scrollTop = scrollTop - walkY;
    }
  };

  // Check if event target is a tech node
  const isTechNodeEvent = (e: React.TouchEvent | React.MouseEvent) => {
    const target = e.target as HTMLElement;
    return target.closest('[data-tech-node]') !== null;
  };

  // Touch support for iPad/Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    // Ignore if touching a tech node - let the node handle its own events
    if (isTechNodeEvent(e)) return;
    
    // Don't start dragging yet, just record the starting position
    setIsMouseDown(true);
    setIsDragging(false);
    setStartX(e.touches[0].pageX - containerRef.current.offsetLeft);
    setStartY(e.touches[0].pageY - containerRef.current.offsetTop);
    setScrollLeft(containerRef.current.scrollLeft);
    setScrollTop(containerRef.current.scrollTop);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMouseDown || !containerRef.current) return;
    
    const x = e.touches[0].pageX - containerRef.current.offsetLeft;
    const y = e.touches[0].pageY - containerRef.current.offsetTop;
    const moveX = Math.abs(x - startX);
    const moveY = Math.abs(y - startY);
    
    // Only start dragging if moved past threshold
    if (!isDragging && (moveX > DRAG_THRESHOLD || moveY > DRAG_THRESHOLD)) {
      setIsDragging(true);
    }
    
    if (isDragging) {
      // Prevent default to stop page swipe-back or scaling behavior
      e.preventDefault();
      const walkX = (x - startX) * 1.5;
      const walkY = (y - startY) * 1.5;
      containerRef.current.scrollLeft = scrollLeft - walkX;
      containerRef.current.scrollTop = scrollTop - walkY;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsMouseDown(false);
  };

  // Reset view to default scroll position
  const handleResetView = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 pointer-events-auto p-0 md:p-6"
      style={{ pointerEvents: "auto" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full h-full max-w-[95vw] max-h-[95vh] bg-slate-950 border border-slate-700/50 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-20 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-20 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-amber-600 to-amber-800 rounded-lg shadow-lg border border-amber-500/30">
              <Book className="w-6 h-6 text-amber-50" />
            </div>
            <div>
              <h1 className="font-cinzel text-2xl font-bold text-amber-50 tracking-wide">Sacred Knowledge</h1>
              <div className="flex items-center gap-3 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-400" /> {currentPlayer.stars} Stars Available</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-64">
              <ProgressSummary />
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleResetView} 
              className="hover:bg-slate-800 rounded-full"
              title="Reset View"
            >
              <Home className="w-6 h-6 text-slate-400 hover:text-white transition" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-slate-800 rounded-full">
              <XCircle className="w-8 h-8 text-slate-500 hover:text-white transition" />
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden relative">

          {/* Left: Scrollable Tech Tree Canvas */}
          <div
            ref={containerRef}
            className="flex-1 relative overflow-auto bg-slate-950/50 cursor-grab active:cursor-grabbing custom-scrollbar select-none"
            style={{ touchAction: 'pan-x pan-y' }}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 w-[2000px] h-[1500px]"
              style={{
                backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                opacity: 0.1
              }}
            />

            {/* The Tree Layout */}
            <div className="relative w-[1500px] h-[1000px]">
              <Connections />
              {Object.keys(TECH_LAYOUT).map(techId => (
                <TechNode key={techId} techId={techId} />
              ))}
            </div>
          </div>

          {/* Right: Detail Sidebar */}
          <div className="w-96 bg-slate-900 border-l border-slate-800 shrink-0 flex flex-col shadow-2xl z-20">
            {detailTech ? (
              <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
                {/* Hero Image / Banner */}
                <div className={`h-40 relative bg-gradient-to-br ${getCategoryGradient(detailTech.category)} p-6 flex flex-col justify-end`}>
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute top-4 right-4">
                    {getCategoryIcon(detailTech.category)}
                  </div>
                  <div className="relative z-10">
                    <div className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">{detailTech.category}</div>
                    <h2 className="text-3xl font-bold text-white leading-none">{detailTech.name}</h2>
                  </div>
                </div>

                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                  {/* Description */}
                  <p className="text-slate-300 leading-relaxed italic border-l-2 border-amber-500/30 pl-4 py-1">
                    "{detailTech.description}"
                  </p>

                  {/* Cost & Requirements */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Cost</div>
                      <div className="flex items-center gap-2 text-amber-400 font-mono text-lg">
                        <Star className="w-4 h-4" /> {calculateResearchCost(detailTech, researchedCount)}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                      <div className="text-xs text-slate-500 uppercase font-semibold mb-1">Time</div>
                      <div className="flex items-center gap-2 text-blue-400 font-mono text-lg">
                        <Clock className="w-4 h-4" /> Instant
                      </div>
                    </div>
                  </div>

                  {/* Unlocks Section - The "Reward" Area */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-green-500" /> Unlocks
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {/* Scan for all potential unlocks */}
                      {detailTech.unlocks.units?.map(u => (
                        <UnlockBadge key={u} type="unit" name={u} />
                      ))}
                      {detailTech.unlocks.structures?.map(s => (
                        <UnlockBadge key={s} type="building" name={s} />
                      ))}
                      {detailTech.unlocks.improvements?.map(i => (
                        <UnlockBadge key={i} type="improvement" name={i} />
                      ))}
                      {detailTech.unlocks.abilities?.map(a => (
                        <UnlockBadge key={a} type="ability" name={a} />
                      ))}

                      {/* Fallback if nothing specific listed */}
                      {(!detailTech.unlocks.units?.length && !detailTech.unlocks.structures?.length && !detailTech.unlocks.improvements?.length) && (
                        <div className="text-sm text-slate-500 italic px-2">Advanced functionality</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-6 border-t border-slate-800 bg-slate-900/50">
                  <Button
                    size="lg"
                    disabled={techStatuses[detailTech.id] !== "available"}
                    onClick={() => handleResearchTech(detailTech.id)}
                    className={`w-full text-lg font-bold h-14 shadow-xl active:scale-95 transition-all
                        ${techStatuses[detailTech.id] === "available"
                        ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 border-amber-400/30"
                        : "bg-slate-800 text-slate-500 border-slate-700"}
                      `}
                  >
                    {techStatuses[detailTech.id] === "researched" ? (
                      <span className="flex items-center gap-2"><CheckCircle className="w-6 h-6" /> Research Complete</span>
                    ) : techStatuses[detailTech.id] === "locked" ? (
                      <span className="flex items-center gap-2"><Lock className="w-5 h-5" /> Locked</span>
                    ) : (
                      <span className="flex items-center gap-2">Research Technology</span>
                    )}
                  </Button>
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 border border-slate-700">
                  <Book className="w-8 h-8 opacity-50" />
                </div>
                <h3 className="text-xl font-bold text-slate-400 mb-2">Knowledge Archive</h3>
                <p>Select a technology node from the neural web to view its secrets.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
