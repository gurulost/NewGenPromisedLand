import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Progress } from "./progress";
import { Separator } from "./separator";
import { Input } from "./input";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { TECHNOLOGIES, calculateResearchCost, getAvailableTechnologies, type Technology } from "@shared/data/technologies";
import { Star, Book, Swords, Church, Map, Lock, CheckCircle, Clock, Sparkles, Filter, ArrowUpRight, Search, XCircle, Link as LinkIcon } from "lucide-react";

interface TechPanelProps {
  open: boolean;
  onClose: () => void;
}

type TechStatus = "researched" | "available" | "locked" | "researching";
type CategoryFilter = "all" | Technology["category"];

const TIERS = [
  { id: 1, title: "Foundations", accent: "from-amber-300/40 via-amber-500/10 to-transparent", motif: "bg-gradient-to-br from-amber-500/10 to-transparent" },
  { id: 2, title: "Growth", accent: "from-emerald-300/40 via-emerald-500/10 to-transparent", motif: "bg-gradient-to-br from-emerald-500/10 to-transparent" },
  { id: 3, title: "Mastery", accent: "from-indigo-300/40 via-indigo-500/10 to-transparent", motif: "bg-gradient-to-br from-indigo-500/10 to-transparent" },
];

export default function TechPanel({ open, onClose }: TechPanelProps) {
  const { gameState, dispatch } = useLocalGame();
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [hoveredTech, setHoveredTech] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CategoryFilter>("all");
  
  const currentPlayer = gameState?.players[gameState.currentPlayerIndex];
  const availableTechs = currentPlayer ? getAvailableTechnologies(currentPlayer.researchedTechs) : [];
  const researchedCount = currentPlayer?.researchedTechs.length || 0;
  const normalizedSearch = search.trim().toLowerCase();

  const tieredTechs = useMemo(() => {
    const byTier: Record<number, Technology[]> = { 1: [], 2: [], 3: [] };
    Object.values(TECHNOLOGIES).forEach(tech => {
      const tier = (tech as any).tier || tech.prerequisites.length + 1;
      if (!byTier[tier]) byTier[tier] = [];
      byTier[tier].push(tech);
    });
    return byTier;
  }, []);

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

  const matchesFilter = (tech: Technology) => {
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
      dispatch({
        type: "RESEARCH_TECHNOLOGY",
        payload: { playerId: currentPlayer.id, technologyId: techId },
      });
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
        return "bg-gradient-to-br from-green-500 to-green-600 border-green-400 shadow-green-500/25 shadow-lg text-white";
      case "available": 
        return "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400 shadow-blue-500/25 shadow-lg text-white hover:shadow-blue-500/40 hover:scale-105 cursor-pointer";
      case "researching": 
        return "bg-gradient-to-br from-yellow-500 to-yellow-600 border-yellow-400 shadow-yellow-500/25 shadow-lg text-white animate-pulse";
      case "locked": 
        return "bg-gradient-to-br from-gray-600 to-gray-700 border-gray-500 text-gray-300 opacity-60";
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

  const Legend = () => (
    <div className="flex flex-wrap gap-3 text-xs text-amber-100/70">
      <LegendPill color="bg-green-500" label="Researched" />
      <LegendPill color="bg-blue-500" label="Available" />
      <LegendPill color="bg-yellow-500" label="Researching" />
      <LegendPill color="bg-slate-600" label="Locked" />
    </div>
  );

  const LegendPill = ({ color, label }: { color: string; label: string }) => (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/70 border border-slate-700">
      <span className={`w-3 h-3 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  );

  const FilterPills = () => (
    <div className="flex flex-wrap gap-2">
      {["all", "economic", "military", "religious", "exploration"].map(cat => (
        <button
          key={cat}
          onClick={() => setFilter(cat as CategoryFilter)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
            filter === cat
              ? "border-amber-400 bg-amber-500/20 text-amber-100"
              : "border-slate-600 bg-slate-800/60 text-slate-200 hover:border-amber-400/60"
          }`}
        >
          {cat === "all" ? "All" : cat[0].toUpperCase() + cat.slice(1)}
        </button>
      ))}
    </div>
  );

  const TechCard = ({ tech }: { tech: Technology }) => {
    const status = techStatuses[tech.id] || "locked";
    const cost = calculateResearchCost(tech, researchedCount);
    const prereqsMet = tech.prerequisites.every(pr => currentPlayer.researchedTechs.includes(pr));
    const canAfford = currentPlayer.stars >= cost;
    const actionable = status === "available" && prereqsMet && canAfford;
    const prereqBadges = tech.prerequisites.map(pr => ({
      id: pr,
      name: TECHNOLOGIES[pr]?.name || pr,
      met: currentPlayer.researchedTechs.includes(pr),
    }));

    return (
      <Card
        key={tech.id}
        className={`relative overflow-hidden border ${getTechStatusStyles(status)} transition hover:translate-y-[-2px]`}
        onMouseEnter={() => setHoveredTech(tech.id)}
        onMouseLeave={() => setHoveredTech(null)}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-20 pointer-events-none" />
        <CardHeader className="pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getTechStatusIcon(status)}
            <CardTitle className="text-lg">{tech.name}</CardTitle>
          </div>
          <Badge variant="outline" className="bg-black/20 border-white/10">
            {getCategoryIcon(tech.category)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-white/80 leading-relaxed min-h-[48px]">{tech.description}</p>
          <div className="flex items-center gap-3 text-xs text-white/80">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-black/30">
              <Star className="w-3 h-3" /> {cost} stars
            </span>
            {tech.prerequisites.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-black/30">
                <Lock className="w-3 h-3" /> {tech.prerequisites.length} prereq{tech.prerequisites.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {prereqBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {prereqBadges.map(pr => (
                <Badge
                  key={pr.id}
                  variant="outline"
                  className={`border ${pr.met ? "border-green-400 text-green-200" : "border-slate-600 text-slate-300"} bg-black/20`}
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  {pr.name}
                </Badge>
              ))}
            </div>
          )}
          <Button
            disabled={!actionable}
            onClick={() => handleResearchTech(tech.id)}
            className="w-full flex items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4" />
            {actionable ? "Research" : status === "researched" ? "Completed" : "Locked"}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const detailTech = selectedTech ? TECHNOLOGIES[selectedTech] : hoveredTech ? TECHNOLOGIES[hoveredTech] : null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto p-4"
      style={{ pointerEvents: "auto" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full h-full max-w-7xl max-h-[90vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_left,#fde68a_0%,transparent_30%)]" />
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_bottom_right,#a78bfa_0%,transparent_35%)]" />
        </div>
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-900/20 to-amber-800/20 border-b border-amber-500/20 p-6">
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-600 to-amber-700 rounded-lg shadow-lg shadow-amber-500/25">
                <Book className="w-7 h-7 text-amber-100" />
              </div>
              <div>
                <h1 className="font-cinzel text-2xl font-bold text-amber-100">Sacred Knowledge Tree</h1>
                <p className="text-amber-300/70 text-sm">Book of Mormon Technologies</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-amber-500/40 text-amber-200 bg-amber-500/10">
                <Star className="w-4 h-4 mr-2" />
                Stars: {currentPlayer.stars}
              </Badge>
              
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 rounded-lg border border-slate-700">
                <Filter className="w-4 h-4 text-amber-200" />
                <span className="text-sm text-amber-100">Filter by category</span>
              </div>
              <FilterPills />
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative w-64">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search technologies..."
                  className="pl-9 bg-slate-800 border-slate-700 text-white"
                />
                <Search className="w-4 h-4 text-amber-200 absolute left-3 top-1/2 -translate-y-1/2" />
                {search && (
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-200"
                    onClick={() => setSearch("")}
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex-1">
                <ProgressSummary />
              </div>
            </div>
            <Legend />
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-6 p-6 h-[calc(90vh-96px)] relative z-10">
          {/* Tiered tree */}
          <div className="col-span-2 overflow-y-auto pr-2 space-y-6">
            {TIERS.map(tier => (
              <div key={tier.id} className={`space-y-3 rounded-xl border border-amber-500/10 p-3 relative overflow-hidden`}>
                <div className={`absolute inset-0 pointer-events-none ${tier.accent}`} />
                <div className="flex items-center justify-between">
                  <h2 className="text-amber-100 font-semibold flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-amber-300/70">Tier {tier.id}</span>
                    <span className="text-lg">{tier.title}</span>
                  </h2>
                  <Separator className="flex-1 ml-3 bg-amber-500/30" />
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                  {(tieredTechs[tier.id] || [])
                    .filter(matchesFilter)
                    .map(tech => (
                      <TechCard key={tech.id} tech={tech} />
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Detail sidebar */}
          <div className="col-span-1">
            <Card className="h-full bg-slate-800/60 border-amber-500/20">
              <CardHeader>
                <CardTitle className="text-amber-100">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!detailTech && (
                  <p className="text-sm text-slate-300">
                    Hover or select a technology to see its details, prerequisites, and benefits.
                  </p>
                )}
                {detailTech && (
                  <>
                    <div className="flex items-center gap-3">
                      <Badge className={`bg-${getCategoryGradient(detailTech.category)} text-white border-white/10`}>
                        {getCategoryIcon(detailTech.category)}
                      </Badge>
                      <h3 className="text-lg font-semibold text-amber-100">{detailTech.name}</h3>
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed">{detailTech.description}</p>
                    <div className="space-y-2 text-sm text-amber-100/80">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4" />
                        <span>Cost: {calculateResearchCost(detailTech, researchedCount)} stars</span>
                      </div>
                      <div>
                        <div className="font-semibold text-amber-200">Prerequisites</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {detailTech.prerequisites.length === 0 && (
                            <Badge variant="outline" className="text-slate-200 border-slate-600">None</Badge>
                          )}
                          {detailTech.prerequisites.map(pr => (
                            <Badge
                              key={pr}
                              variant="outline"
                              className={`border ${currentPlayer.researchedTechs.includes(pr) ? "border-green-400 text-green-200" : "border-slate-600 text-slate-300"}`}
                            >
                              {TECHNOLOGIES[pr]?.name || pr}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-amber-200">Unlocks</div>
                        <div className="space-y-2 mt-2">
                          {detailTech.unlocks.units && detailTech.unlocks.units.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <Swords className="w-3 h-3 text-red-400" />
                              <span className="text-xs text-slate-400 mr-1">Units:</span>
                              {detailTech.unlocks.units.map(unit => (
                                <Badge key={unit} variant="outline" className="text-xs border-red-400/50 text-red-200 bg-red-500/10">
                                  {unit.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {detailTech.unlocks.improvements && detailTech.unlocks.improvements.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <Map className="w-3 h-3 text-green-400" />
                              <span className="text-xs text-slate-400 mr-1">Improvements:</span>
                              {detailTech.unlocks.improvements.map(imp => (
                                <Badge key={imp} variant="outline" className="text-xs border-green-400/50 text-green-200 bg-green-500/10">
                                  {imp.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {detailTech.unlocks.structures && detailTech.unlocks.structures.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <Church className="w-3 h-3 text-blue-400" />
                              <span className="text-xs text-slate-400 mr-1">Buildings:</span>
                              {detailTech.unlocks.structures.map(struct => (
                                <Badge key={struct} variant="outline" className="text-xs border-blue-400/50 text-blue-200 bg-blue-500/10">
                                  {struct.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {detailTech.unlocks.abilities && detailTech.unlocks.abilities.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <Sparkles className="w-3 h-3 text-purple-400" />
                              <span className="text-xs text-slate-400 mr-1">Abilities:</span>
                              {detailTech.unlocks.abilities.map(ability => (
                                <Badge key={ability} variant="outline" className="text-xs border-purple-400/50 text-purple-200 bg-purple-500/10">
                                  {ability.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {(!detailTech.unlocks.units?.length && !detailTech.unlocks.improvements?.length && 
                            !detailTech.unlocks.structures?.length && !detailTech.unlocks.abilities?.length) && (
                            <p className="text-xs text-slate-400">No direct unlocks</p>
                          )}
                        </div>
                      </div>
                      
                      {/* Technologies this unlocks */}
                      {(() => {
                        const unlockedTechs = Object.values(TECHNOLOGIES).filter(
                          tech => tech.prerequisites.includes(detailTech.id)
                        );
                        if (unlockedTechs.length === 0) return null;
                        return (
                          <div className="pt-2 border-t border-amber-500/20">
                            <div className="font-semibold text-amber-200 flex items-center gap-2">
                              <ArrowUpRight className="w-4 h-4" />
                              Leads To
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {unlockedTechs.map(tech => (
                                <button
                                  key={tech.id}
                                  onClick={() => setSelectedTech(tech.id)}
                                  className="group flex items-center gap-1 px-2 py-1 rounded bg-slate-700/50 border border-slate-600 hover:border-amber-400/50 transition text-left"
                                >
                                  {getCategoryIcon(tech.category)}
                                  <span className="text-xs text-amber-100 group-hover:text-amber-200">{tech.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <Button
                      disabled={techStatuses[detailTech.id] !== "available"}
                      onClick={() => handleResearchTech(detailTech.id)}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {techStatuses[detailTech.id] === "researched" ? "Completed" : "Research"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
