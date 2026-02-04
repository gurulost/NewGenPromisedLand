import { useRef, useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Input } from "./input";
import { Label } from "./label";
import { X, Plus, Users, Map, ArrowLeft, Play, Bot, User, CheckCircle2, AlertTriangle } from "lucide-react";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getAllFactions } from "@shared/data/factions";
import { FactionId } from "@shared/types/faction";
import { MAP_SIZE_CONFIGS, MapSize } from "@shared/utils/mapGenerator";
import { ContentShell } from "../primitives/ContentShell";
import { PanelHeader } from "../primitives/PanelHeader";
import { GlowingButton } from "../primitives/GlowingButton";
import { StepFretDivider } from "../primitives/StepFretDivider";
import { getFactionIcon, TempleIcon } from "../primitives/ThematicIcons";
import { useHotkeys } from "../../hooks/useHotkeys";
import { usePerformanceMode } from "../../hooks/usePerformanceMode";

export type AIDifficulty = 'easy' | 'normal' | 'hard';

interface PlayerSetupData {
  id: string;
  name: string;
  factionId: FactionId | null;
  isAI: boolean;
  aiDifficulty: AIDifficulty;
  aiPrefixAuto: boolean;
}

export default function PlayerSetup() {
  const { setGamePhase, startLocalGame } = useLocalGame();
  const [players, setPlayers] = useState<PlayerSetupData[]>([
    { id: '1', name: 'Player 1', factionId: null, isAI: false, aiDifficulty: 'normal', aiPrefixAuto: false },
    { id: '2', name: 'AI Opponent', factionId: null, isAI: true, aiDifficulty: 'normal', aiPrefixAuto: true },
  ]);
  const [selectedMapSize, setSelectedMapSize] = useState<MapSize>('normal');
  const nextIdRef = useRef(3);

  const factions = getAllFactions();
  const usedFactions = players.map(p => p.factionId).filter(Boolean);
  const perfMode = usePerformanceMode();

  useHotkeys('Escape', () => setGamePhase('menu'));

  // Helper function to get recommended player count for each map size
  const getRecommendedPlayers = (mapSize: MapSize): string => {
    switch (mapSize) {
      case 'tiny': return '2 players';
      case 'small': return '2-3 players';
      case 'normal': return '3-4 players';
      case 'large': return '4-6 players';
      case 'huge': return '6-8 players';
      default: return '2-4 players';
    }
  };

  const normalizeAiName = (name: string) => name.replace(/^AI\s+/i, '').trim();

  const buildAiName = (name: string) => {
    const trimmed = name.trim();
    if (/^AI\s+/i.test(trimmed)) {
      return { name: trimmed, auto: false };
    }
    const cleaned = normalizeAiName(trimmed);
    return { name: cleaned ? `AI ${cleaned}` : 'AI Player', auto: true };
  };

  const addPlayer = () => {
    if (players.length < 6) {
      const nextNumber = nextIdRef.current;
      nextIdRef.current += 1;
      setPlayers([...players, {
        id: nextNumber.toString(),
        name: `AI Player ${nextNumber}`,
        factionId: null,
        isAI: true,
        aiDifficulty: 'normal',
        aiPrefixAuto: true,
      }]);
    }
  };

  const removePlayer = (id: string) => {
    if (players.length > 2) {
      setPlayers(players.filter(p => p.id !== id));
    }
  };

  const updatePlayer = (id: string, field: keyof PlayerSetupData, value: string | boolean) => {
    setPlayers(players.map(p =>
      p.id === id
        ? field === 'name'
          ? { ...p, name: value as string, aiPrefixAuto: false }
          : { ...p, [field]: value }
        : p
    ));
  };

  const togglePlayerType = (id: string) => {
    setPlayers(players.map(p => {
      if (p.id !== id) return p;
      const nextIsAI = !p.isAI;
      if (nextIsAI) {
        const { name, auto } = buildAiName(p.name);
        return { ...p, isAI: true, name, aiPrefixAuto: auto };
      }
      const nextName = p.aiPrefixAuto ? normalizeAiName(p.name) : p.name;
      return { ...p, isAI: false, name: nextName, aiPrefixAuto: false };
    }));
  };

  const canStart = players.length >= 2 &&
    players.every(p => p.name.trim() && p.factionId) &&
    new Set(players.map(p => p.factionId)).size === players.length;

  const handleStartGame = () => {
    if (canStart) {
      startLocalGame(players.map((p, index) => ({
        id: p.id,
        name: p.name,
        factionId: p.factionId!,
        turnOrder: index,
        isAI: p.isAI,
        aiDifficulty: p.aiDifficulty
      })), selectedMapSize);
    }
  };

  const mapConfig = MAP_SIZE_CONFIGS[selectedMapSize];
  const aiCount = players.filter(p => p.isAI).length;
  const humanCount = players.length - aiCount;
  const readyCount = players.filter(p => p.name.trim() && p.factionId).length;
  const missingNames = players.filter(p => !p.name.trim()).length;
  const missingFactions = players.filter(p => !p.factionId).length;
  const assignedFactionCount = players.filter(p => p.factionId).length;
  const uniqueFactionCount = new Set(players.map(p => p.factionId).filter(Boolean)).size;
  const duplicateFactions = uniqueFactionCount !== assignedFactionCount;

  const rosterIssues: string[] = [];
  if (missingNames > 0) {
    rosterIssues.push(`Provide names for ${missingNames} player${missingNames > 1 ? 's' : ''}.`);
  }
  if (missingFactions > 0) {
    rosterIssues.push(`Select factions for ${missingFactions} player${missingFactions > 1 ? 's' : ''}.`);
  }
  if (duplicateFactions) {
    rosterIssues.push('Each player needs a unique faction.');
  }

  return (
    <div
      className="w-full h-full p-4 overflow-y-auto relative"
      style={{
        backgroundImage: 'url(/images/mesoamerican_background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/55 to-slate-950/85" />
      <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_60%)]" />

      <div className="relative z-10 min-h-full flex items-center justify-center py-8">
        <div className="w-full max-w-5xl">
          <ContentShell size="full" shimmerBorder showCornerOrnaments className="max-w-5xl">
            <div className="p-6 lg:p-8 space-y-6">
              <PanelHeader
                icon={<Users />}
                title="Local Game Setup"
                description="Configure players for pass-and-play mode"
                animated
              />

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-slate-900/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
                    <TempleIcon size="sm" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-amber-200/70 font-cinzel">Match Ledger</div>
                    <div className="text-xs text-amber-200/60">Unique factions required • Up to 6 seats</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-200">
                    Players {players.length}/6
                  </span>
                  <span className="rounded-full border border-slate-500/40 bg-slate-900/60 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-100/80">
                    Humans {humanCount}
                  </span>
                  <span className="rounded-full border border-jade-400/40 bg-jade-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-jade-200">
                    AI {aiCount}
                  </span>
                  <span className={clsx(
                    "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em]",
                    canStart
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                      : "border-rose-400/40 bg-rose-500/10 text-rose-200"
                  )}>
                    Ready {readyCount}/{players.length}
                  </span>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.6fr_36px_1fr]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.35em] text-amber-200/70 font-cinzel">Player Roster</div>
                      <div className="text-xs text-amber-200/60">Assign names, factions, and AI difficulty</div>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-xs text-amber-200/70">
                      <Map className="h-4 w-4" />
                      {mapConfig.name} • {mapConfig.tiles} tiles
                    </div>
                  </div>

                  <StepFretDivider size="sm" />

                  <div className="space-y-4">
                    {players.map((player, index) => {
                      const playerReady = Boolean(player.name.trim() && player.factionId);
                      const toneLabel = player.isAI ? "text-jade-200" : "text-amber-200";
                      const fieldTone = player.isAI
                        ? "bg-jade-950/40 border-jade-600/50 text-white placeholder:text-jade-200/50 focus-visible:ring-jade-400/40"
                        : "bg-slate-900/60 border-slate-600/70 text-white placeholder:text-slate-400 focus-visible:ring-amber-400/40";
                      const triggerTone = player.isAI
                        ? "bg-jade-950/50 border-jade-600/60 text-white focus-visible:ring-jade-400/40"
                        : "bg-slate-900/70 border-slate-600/70 text-white focus-visible:ring-amber-400/40";
                      const cardTone = player.isAI
                        ? "border-jade-500/40 from-jade-950/50 via-slate-900/70 to-slate-950/90"
                        : "border-amber-500/30 from-slate-950/70 via-slate-900/70 to-slate-950/90";

                      return (
                        <motion.div
                          key={player.id}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className={clsx(
                            "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 md:p-5 transition-all duration-300",
                            cardTone,
                            player.isAI
                              ? "hover:shadow-[0_0_30px_rgba(34,197,94,0.25)]"
                              : "hover:shadow-[0_0_30px_rgba(251,191,36,0.2)]"
                          )}
                        >
                          <div
                            className={clsx(
                              "pointer-events-none absolute inset-0 opacity-40",
                              player.isAI
                                ? "bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.25),_transparent_55%)]"
                                : "bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_55%)]"
                            )}
                            aria-hidden="true"
                          />

                          {player.isAI && perfMode === 'high' && (
                            <div
                              className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden"
                              aria-hidden="true"
                            >
                              <div className="absolute inset-[-1px] rounded-2xl animate-gold-shimmer opacity-30" />
                            </div>
                          )}

                          <div className="relative z-10 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={clsx(
                                    "flex h-11 w-11 items-center justify-center rounded-xl border text-[11px] font-cinzel tracking-[0.25em]",
                                    player.isAI
                                      ? "border-jade-400/50 bg-jade-500/15 text-jade-100"
                                      : "border-amber-400/40 bg-amber-500/15 text-amber-100"
                                  )}
                                >
                                  {(index + 1).toString().padStart(2, '0')}
                                </div>
                                <div>
                                  <div className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60">Seat</div>
                                  <div className="text-xs text-amber-100/80">
                                    {player.isAI ? 'Automaton' : 'Human'} Player
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={clsx(
                                    "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.2em]",
                                    playerReady
                                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                                      : "border-rose-400/40 bg-rose-500/10 text-rose-200"
                                  )}
                                >
                                  {playerReady ? 'Ready' : 'Needs Info'}
                                </span>

                                {players.length > 2 && (
                                  <GlowingButton
                                    variant="ghost"
                                    glowColor="red"
                                    size="sm"
                                    onClick={() => removePlayer(player.id)}
                                    aria-label="Remove player"
                                    className="h-9 w-9 rounded-full border border-red-500/40 p-0 text-red-200 hover:border-red-400 hover:text-white"
                                  >
                                    <X className="h-4 w-4" />
                                  </GlowingButton>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                onClick={() => togglePlayerType(player.id)}
                                className={clsx(
                                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.25em] transition-all",
                                  player.isAI
                                    ? 'border-jade-400/40 bg-jade-500/15 text-jade-100 hover:bg-jade-500/25'
                                    : 'border-amber-400/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
                                )}
                                title={player.isAI ? 'Switch to Human' : 'Switch to AI'}
                                aria-pressed={player.isAI}
                              >
                                {player.isAI ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                {player.isAI ? 'AI' : 'Human'}
                              </button>

                              <div className={clsx(
                                "rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.25em]",
                                player.isAI
                                  ? "border-jade-400/30 bg-jade-500/10 text-jade-200"
                                  : "border-slate-500/40 bg-slate-900/60 text-amber-100/70"
                              )}>
                                {player.isAI ? 'Adaptive' : 'Pass-and-Play'}
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-[1.1fr_1.2fr_auto]">
                              <div className="space-y-2">
                                <Label htmlFor={`name-${player.id}`} className={toneLabel}>Player Name</Label>
                                <Input
                                  id={`name-${player.id}`}
                                  value={player.name}
                                  onChange={(e) => updatePlayer(player.id, 'name', e.target.value)}
                                  className={clsx("border text-white", fieldTone)}
                                  placeholder="Enter player name"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`faction-${player.id}`} className={toneLabel}>Faction</Label>
                                <div className="flex items-center gap-2">
                                  {player.factionId && (() => {
                                    const FactionIcon = getFactionIcon(player.factionId);
                                    const faction = factions.find(f => f.id === player.factionId);
                                    return FactionIcon ? (
                                      <div
                                        className="flex items-center justify-center w-9 h-9 rounded-lg border border-slate-500/50"
                                        style={{ backgroundColor: faction?.color + '33' }}
                                      >
                                        <FactionIcon size="md" className="opacity-80" style={{ color: faction?.color }} />
                                      </div>
                                    ) : null;
                                  })()}
                                  <Select
                                    value={player.factionId || ""}
                                    onValueChange={(value) => updatePlayer(player.id, 'factionId', value)}
                                  >
                                    <SelectTrigger className={clsx("flex-1 border", triggerTone)}>
                                      <SelectValue placeholder="Choose faction" />
                                    </SelectTrigger>
                                    <SelectContent className={clsx(
                                      "border",
                                      player.isAI ? "bg-jade-950 border-jade-600/70" : "bg-slate-900 border-slate-600"
                                    )}>
                                      {factions.map(faction => {
                                        const FactionIcon = getFactionIcon(faction.id);
                                        return (
                                          <SelectItem
                                            key={faction.id}
                                            value={faction.id}
                                            disabled={usedFactions.includes(faction.id) && player.factionId !== faction.id}
                                            className="text-white hover:bg-slate-700"
                                          >
                                            <div className="flex items-center gap-2">
                                              {FactionIcon ? (
                                                <FactionIcon size="sm" style={{ color: faction.color }} />
                                              ) : (
                                                <div
                                                  className="w-3 h-3 rounded-full"
                                                  style={{ backgroundColor: faction.color }}
                                                />
                                              )}
                                              {faction.name}
                                            </div>
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {player.isAI && (
                                <div className="space-y-2 md:w-32">
                                  <Label className="text-jade-200">Difficulty</Label>
                                  <Select
                                    value={player.aiDifficulty}
                                    onValueChange={(value) => updatePlayer(player.id, 'aiDifficulty', value as AIDifficulty)}
                                  >
                                    <SelectTrigger className="bg-jade-950/60 border-jade-500 text-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-jade-950 border-jade-500">
                                      <SelectItem value="easy" className="text-green-300 hover:bg-jade-800">Easy</SelectItem>
                                      <SelectItem value="normal" className="text-yellow-300 hover:bg-jade-800">Normal</SelectItem>
                                      <SelectItem value="hard" className="text-red-300 hover:bg-jade-800">Hard</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>

                  {players.length < 6 && (
                    <GlowingButton
                      variant="ghost"
                      glowColor="amber"
                      onClick={addPlayer}
                      className="w-full border border-dashed border-amber-400/40 bg-amber-500/5 hover:bg-amber-500/10"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Plus />
                        Add Player (Max 6)
                      </span>
                    </GlowingButton>
                  )}
                </div>

                <div className="hidden lg:flex justify-center">
                  <StepFretDivider orientation="vertical" className="h-full min-h-[420px]" />
                </div>

                <div className="space-y-5">
                  <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900/60 p-4">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_transparent_65%)]" />
                    <div className="relative space-y-3">
                      <div className="flex items-center gap-2 text-amber-200">
                        <Map className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-[0.3em] font-cinzel">Map Size</span>
                      </div>
                      <Select value={selectedMapSize} onValueChange={(value: MapSize) => setSelectedMapSize(value)}>
                        <SelectTrigger className="bg-slate-900/70 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-600">
                          {Object.entries(MAP_SIZE_CONFIGS).map(([size, config]) => (
                            <SelectItem
                              key={size}
                              value={size}
                              className="text-white hover:bg-slate-700"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{config.name}</span>
                                <span className="text-xs text-slate-400">
                                  {config.tiles} tiles • Recommended for {getRecommendedPlayers(size as MapSize)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
                          {mapConfig.tiles} tiles
                        </span>
                        <span className="rounded-full border border-slate-500/40 bg-slate-900/60 px-2.5 py-1 text-amber-100/80">
                          Recommended {getRecommendedPlayers(selectedMapSize)}
                        </span>
                      </div>

                      <p className="text-xs text-amber-200/60">
                        Selected: {mapConfig.name} map with {mapConfig.tiles} tiles
                      </p>
                    </div>
                  </div>

                  <StepFretDivider size="sm" className="hidden lg:block" />

                  <div
                    className={clsx(
                      "relative overflow-hidden rounded-2xl border p-4",
                      canStart
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-rose-400/40 bg-rose-500/10"
                    )}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]" />
                    <div className="relative space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {canStart ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-rose-300" />
                          )}
                          <span className="text-xs uppercase tracking-[0.3em] font-cinzel">
                            Roster Status
                          </span>
                        </div>
                        <span className="text-xs text-amber-100/70">{readyCount}/{players.length} ready</span>
                      </div>

                      {canStart ? (
                        <p className="text-xs text-emerald-200">
                          All seats are ready. Unique factions assigned.
                        </p>
                      ) : (
                        <div className="space-y-1 text-xs text-rose-200">
                          {rosterIssues.map((issue, idx) => (
                            <p key={idx}>{issue}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <GlowingButton
                      onClick={handleStartGame}
                      disabled={!canStart}
                      className="w-full"
                      size="lg"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Play />
                        Start Game
                      </span>
                    </GlowingButton>

                    <GlowingButton
                      variant="secondary"
                      onClick={() => setGamePhase('menu')}
                      className="w-full"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <ArrowLeft />
                        Back to Menu
                      </span>
                    </GlowingButton>

                    <div className="text-center text-xs text-amber-200/60">
                      Tip: Press Escape to return to the main menu.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ContentShell>
        </div>
      </div>
    </div>
  );
}
