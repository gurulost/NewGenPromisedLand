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
import BugReportSupportCallout from "./BugReportSupportCallout";
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

const sharedSelectTriggerTone =
  "h-11 rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200";
const humanSelectTriggerTone =
  "border-slate-500/75 bg-slate-950/78 text-slate-50 data-[placeholder]:text-slate-300/70 focus-visible:border-amber-300/60 focus-visible:ring-amber-400/35 [&>svg]:text-amber-100/60";
const aiSelectTriggerTone =
  "border-jade-600/70 bg-jade-950/78 text-jade-50 data-[placeholder]:text-jade-200/75 focus-visible:border-jade-300/55 focus-visible:ring-jade-400/35 [&>svg]:text-jade-200/70";
const humanSelectContentTone =
  "w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border-slate-500/80 bg-[linear-gradient(180deg,rgba(10,25,56,0.98),rgba(7,18,40,0.98))] text-slate-50 shadow-[0_28px_80px_rgba(2,6,23,0.58)] backdrop-blur-2xl";
const aiSelectContentTone =
  "w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border-jade-500/70 bg-[linear-gradient(180deg,rgba(8,48,28,0.98),rgba(4,29,18,0.98))] text-jade-50 shadow-[0_28px_80px_rgba(2,6,23,0.58)] backdrop-blur-2xl";
const humanSelectItemTone =
  "rounded-xl border border-transparent px-3 py-2.5 text-slate-50 data-[highlighted]:border-amber-300/30 data-[highlighted]:bg-slate-700/95 data-[highlighted]:text-white data-[state=checked]:border-slate-400/35 data-[state=checked]:bg-slate-800/95 data-[state=checked]:text-white";
const aiSelectItemTone =
  "rounded-xl border border-transparent px-3 py-2.5 text-jade-50 data-[highlighted]:border-jade-400/40 data-[highlighted]:bg-jade-800/90 data-[highlighted]:text-jade-50 data-[state=checked]:border-jade-500/40 data-[state=checked]:bg-jade-900/95 data-[state=checked]:text-jade-50";

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
    if (players.length < 8) {
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
      data-testid="player-setup-screen"
      className="w-full h-full p-4 overflow-y-auto relative"
      style={{
        backgroundImage: 'url(/images/mesoamerican_background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.95),rgba(2,6,23,0.78)_32%,rgba(2,6,23,0.92))]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.12),_transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_22%,_rgba(2,6,23,0.3)_100%)]" />

      <div className="relative z-10 min-h-full flex items-center justify-center py-8">
        <div className="w-full max-w-5xl">
          <ContentShell
            size="full"
            shimmerBorder
            showCornerOrnaments
            className="max-w-5xl ring-1 ring-amber-200/10 shadow-[0_42px_140px_rgba(2,6,23,0.72)]"
          >
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
                    <div className="text-xs text-amber-200/60">Unique factions required • Up to 8 seats</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-amber-200">
                    Players {players.length}/8
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
                  )}
                  data-testid="player-setup-ready-count"
                  >
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
                      const toneLabel = player.isAI ? "text-jade-50/95" : "text-amber-100/95";
                      const fieldTone = player.isAI
                        ? "h-11 rounded-xl bg-jade-950/78 border-jade-600/70 text-jade-50 placeholder:text-jade-200/70 caret-jade-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-visible:border-jade-300/55 focus-visible:ring-jade-400/35"
                        : "h-11 rounded-xl bg-slate-950/78 border-slate-500/75 text-slate-50 placeholder:text-slate-300/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-visible:border-amber-300/60 focus-visible:ring-amber-400/35";
                      const triggerTone = player.isAI
                        ? `${sharedSelectTriggerTone} ${aiSelectTriggerTone}`
                        : `${sharedSelectTriggerTone} ${humanSelectTriggerTone}`;
                      const cardTone = player.isAI
                        ? "border-jade-500/45 from-jade-950/72 via-slate-950/84 to-slate-950/94"
                        : "border-amber-500/35 from-slate-950/82 via-slate-950/88 to-slate-950/94";

                      return (
                        <motion.div
                          key={player.id}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: index * 0.1 }}
                          data-testid={`player-setup-card-${player.id}`}
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
                                data-testid={`player-setup-player-type-${player.id}`}
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
                                  data-testid={`player-setup-name-${player.id}`}
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
                                    <SelectTrigger
                                      data-testid={`player-setup-faction-${player.id}`}
                                      className={clsx("flex-1 border", triggerTone)}
                                    >
                                      <SelectValue placeholder="Choose faction" />
                                    </SelectTrigger>
                                    <SelectContent className={clsx(
                                      "border max-h-[min(32rem,var(--radix-select-content-available-height))]",
                                      player.isAI ? aiSelectContentTone : humanSelectContentTone
                                    )}>
                                      {factions.map(faction => {
                                        const FactionIcon = getFactionIcon(faction.id);
                                        const factionTaken = usedFactions.includes(faction.id) && player.factionId !== faction.id;
                                        return (
                                          <SelectItem
                                            key={faction.id}
                                            value={faction.id}
                                            data-testid={`player-setup-faction-option-${faction.id}`}
                                            disabled={factionTaken}
                                            className={clsx(
                                              player.isAI
                                                ? aiSelectItemTone
                                                : humanSelectItemTone,
                                              factionTaken && "opacity-55"
                                            )}
                                          >
                                            <div className="flex w-full items-center gap-3">
                                              <div
                                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                                                style={{
                                                  backgroundColor: `${faction.color}22`,
                                                  borderColor: `${faction.color}66`,
                                                  boxShadow: `inset 0 0 0 1px ${faction.color}18`,
                                                }}
                                              >
                                                {FactionIcon ? (
                                                  <FactionIcon size="sm" style={{ color: faction.color }} />
                                                ) : (
                                                  <div
                                                    className="h-3 w-3 rounded-full"
                                                    style={{ backgroundColor: faction.color }}
                                                  />
                                                )}
                                              </div>
                                              <div className="min-w-0 flex-1">
                                                <div className="truncate font-medium tracking-[0.01em]">
                                                  {faction.name}
                                                </div>
                                                <div className={clsx(
                                                  "truncate text-[11px]",
                                                  player.isAI ? "text-jade-200/72" : "text-slate-300/72"
                                                )}>
                                                  {faction.playstyle}
                                                </div>
                                              </div>
                                              {factionTaken && (
                                                <span className={clsx(
                                                  "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]",
                                                  player.isAI
                                                    ? "border-jade-300/25 bg-jade-400/10 text-jade-100/80"
                                                    : "border-amber-200/20 bg-amber-400/10 text-amber-100/80"
                                                )}>
                                                  Claimed
                                                </span>
                                              )}
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
                                  <Label className="text-jade-100">Difficulty</Label>
                                  <Select
                                    value={player.aiDifficulty}
                                    onValueChange={(value) => updatePlayer(player.id, 'aiDifficulty', value as AIDifficulty)}
                                  >
                                    <SelectTrigger
                                      data-testid={`player-setup-ai-difficulty-${player.id}`}
                                      className={clsx(sharedSelectTriggerTone, aiSelectTriggerTone)}
                                    >
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className={clsx("w-[14rem]", aiSelectContentTone)}>
                                      <SelectItem value="easy" className={clsx(aiSelectItemTone, "text-green-200 data-[highlighted]:text-green-50 data-[state=checked]:text-green-50")}>Easy</SelectItem>
                                      <SelectItem value="normal" className={clsx(aiSelectItemTone, "text-yellow-200 data-[highlighted]:text-yellow-50 data-[state=checked]:text-yellow-50")}>Normal</SelectItem>
                                      <SelectItem value="hard" className={clsx(aiSelectItemTone, "text-red-200 data-[highlighted]:text-red-50 data-[state=checked]:text-red-50")}>Hard</SelectItem>
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

                  {players.length < 8 && (
                    <GlowingButton
                      data-testid="player-setup-add-player"
                      variant="ghost"
                      glowColor="amber"
                      onClick={addPlayer}
                      className="w-full border border-dashed border-amber-400/40 bg-amber-500/5 hover:bg-amber-500/10"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Plus />
                        Add Player (Max 8)
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
                        <SelectTrigger
                          data-testid="player-setup-map-size"
                          className={clsx(sharedSelectTriggerTone, humanSelectTriggerTone)}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={clsx("w-[24rem] max-w-[calc(100vw-2rem)]", humanSelectContentTone)}>
                          {Object.entries(MAP_SIZE_CONFIGS).map(([size, config]) => (
                            <SelectItem
                              key={size}
                              value={size}
                              className={humanSelectItemTone}
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
                    data-testid="player-setup-roster-status"
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
                    <BugReportSupportCallout />

                    <GlowingButton
                      data-testid="player-setup-start-game"
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
                      data-testid="player-setup-back-to-menu"
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
