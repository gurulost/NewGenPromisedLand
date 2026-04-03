import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Church,
  Crown,
  Eye,
  Home,
  Landmark,
  RotateCw,
  ScrollText,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";

import { Badge } from "./badge";
import { Separator } from "./separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { useLocalGame } from "../../lib/stores/useLocalGame";
import { getFaction } from "@shared/data/factions";
import { coerceFactionId } from "@shared/types/factionId";
import { GlowingButton } from "../primitives/GlowingButton";
import { AvatarBadge } from "../primitives/AvatarBadge";
import { useHotkeys } from "../../hooks/useHotkeys";
import {
  getCampaignChronicle,
  getFinalStats,
  getPowerProfile,
  getRankedPlayers,
  getVictoryDecisiveMoment,
  getVictoryFocusCity,
  getVictoryMetricCards,
  getVictoryTheme,
  type VictoryLogEntry,
  type VictoryType,
} from "../../lib/victoryPresentation";

interface VictoryScreenProps {
  winnerId: string;
  victoryType: VictoryType;
  onPlayAgain: () => void;
  onMainMenu: () => void;
  onContinueToMap?: () => void;
  gameLogEntries?: VictoryLogEntry[];
}

function getVictoryIcon(type: VictoryType) {
  switch (type) {
    case "faith":
      return <Church className="h-7 w-7 text-sky-300" />;
    case "territorial":
      return <Crown className="h-7 w-7 text-violet-300" />;
    case "elimination":
      return <Shield className="h-7 w-7 text-rose-300" />;
    case "economic":
      return <Star className="h-7 w-7 text-amber-300" />;
    case "cultural":
      return <Users className="h-7 w-7 text-emerald-300" />;
    case "domination":
      return <Trophy className="h-7 w-7 text-orange-300" />;
  }
}

function MetricRail({
  label,
  value,
  detail,
  progress,
  accentColor,
}: {
  label: string;
  value: string;
  detail: string;
  progress: number;
  accentColor: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-amber-50">{value}</div>
        </div>
        <Sparkles className="mt-1 h-4 w-4 text-amber-200/60" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(8, Math.round(progress * 100))}%`,
            background: `linear-gradient(90deg, ${accentColor}, rgba(255,255,255,0.95))`,
            boxShadow: `0 0 18px ${accentColor}`,
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${Math.max(8, Math.round(progress * 100))}%` }}
          transition={{ duration: 0.75, ease: "easeOut" }}
        />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-amber-100/68">{detail}</p>
    </div>
  );
}

function PowerProfileChart({
  data,
  accentColor,
}: {
  data: ReturnType<typeof getPowerProfile>;
  accentColor: string;
}) {
  const geometry = useMemo(() => {
    if (data.length === 0) return null;

    const width = 420;
    const height = 180;
    const left = 36;
    const right = 384;
    const baseline = 136;
    const top = 36;
    const step = (right - left) / Math.max(1, data.length - 1);

    const winnerPoints = data.map((point, index) => {
      const ratio = point.winnerValue / point.scaleMax;
      return {
        x: left + step * index,
        y: baseline - (baseline - top) * ratio,
      };
    });
    const runnerPoints = data.map((point, index) => {
      const ratio = point.runnerUpValue / point.scaleMax;
      return {
        x: left + step * index,
        y: baseline - (baseline - top) * ratio,
      };
    });

    const toPath = (points: Array<{ x: number; y: number }>) =>
      points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

    return {
      width,
      height,
      baseline,
      labels: data.map((point, index) => ({ x: left + step * index, label: point.label })),
      winnerPath: toPath(winnerPoints),
      runnerPath: toPath(runnerPoints),
      winnerPoints,
      runnerPoints,
    };
  }, [data]);

  if (!geometry) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">Balance Of Power</div>
          <div className="mt-1 text-lg font-cinzel text-amber-50">Final Power Profile</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-amber-100/70">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
            Winner
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-white/55" />
            Runner-up
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/6 bg-slate-950/40">
        <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} className="h-56 w-full">
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = geometry.baseline - (geometry.baseline - 36) * ratio;
            return (
              <line
                key={ratio}
                x1="28"
                x2="392"
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 8"
              />
            );
          })}

          <path d={geometry.runnerPath} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" />
          <path d={geometry.winnerPath} fill="none" stroke={accentColor} strokeWidth="4" strokeLinecap="round" />

          {geometry.runnerPoints.map((point, index) => (
            <circle key={`runner-${index}`} cx={point.x} cy={point.y} r="4" fill="rgba(255,255,255,0.75)" />
          ))}
          {geometry.winnerPoints.map((point, index) => (
            <circle key={`winner-${index}`} cx={point.x} cy={point.y} r="5" fill={accentColor} />
          ))}

          {geometry.labels.map((label) => (
            <text
              key={label.label}
              x={label.x}
              y="164"
              fill="rgba(254,243,199,0.8)"
              fontSize="11"
              textAnchor="middle"
              style={{ letterSpacing: "0.18em", textTransform: "uppercase" }}
            >
              {label.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function VictoryScreen({
  winnerId,
  victoryType,
  onPlayAgain,
  onMainMenu,
  onContinueToMap,
  gameLogEntries = [],
}: VictoryScreenProps) {
  const { gameState } = useLocalGame();
  const [activeTab, setActiveTab] = useState("summary");

  useHotkeys("Escape", onContinueToMap ?? onMainMenu);
  useHotkeys("KeyB", onMainMenu);

  if (!gameState) return null;

  const winner = gameState.players.find((player) => player.id === winnerId);
  if (!winner) return null;

  const theme = getVictoryTheme(victoryType);
  const winnerFactionId = coerceFactionId(winner.factionId) ?? "NEPHITES";
  const faction = getFaction(winnerFactionId);
  const focusCity = getVictoryFocusCity(gameState, winnerId);
  const finalStats = getFinalStats(gameState, winnerId);
  const metricCards = getVictoryMetricCards(gameState, winnerId, victoryType);
  const rankedPlayers = getRankedPlayers(gameState, winnerId);
  const decisiveMoment = getVictoryDecisiveMoment(gameState, winnerId, victoryType, gameLogEntries);
  const chronicle = getCampaignChronicle(gameState, winnerId, victoryType, gameLogEntries);
  const powerProfile = getPowerProfile(gameState, winnerId);

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal-backdrop)] overflow-y-auto bg-black/55 backdrop-blur-md pointer-events-auto"
      data-ui-layer="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Victory report"
    >
      <div className="min-h-full px-3 py-4 sm:px-6 sm:py-6">
        <div
          className={`relative mx-auto max-w-6xl overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br ${theme.heroClass} shadow-[0_36px_120px_-48px_rgba(0,0,0,0.9)]`}
          data-ui-layer="modal-content"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_45%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),transparent_28%,rgba(0,0,0,0.14))]" />

          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`pointer-events-none absolute rounded-full bg-gradient-to-br ${theme.glowClass} blur-3xl`}
              style={{
                height: 260 + index * 80,
                width: 260 + index * 80,
                right: -50 + index * 38,
                top: -40 + index * 48,
                opacity: 0.85 - index * 0.2,
              }}
            />
          ))}

          <div className="relative z-10 p-4 sm:p-6 lg:p-8">
            <div className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={`${theme.badgeClass} rounded-full px-4 py-2 text-xs uppercase tracking-[0.3em]`}>
                    {theme.banner}
                  </Badge>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs uppercase tracking-[0.26em] text-amber-100/70">
                    {getVictoryIcon(victoryType)}
                    {theme.title}
                  </div>
                </div>

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <AvatarBadge
                    playerId={winner.id}
                    playerName={winner.name}
                    factionId={winnerFactionId}
                    size="large"
                    className="shadow-[0_0_50px_rgba(255,255,255,0.12)]"
                  />
                  <div className="space-y-3">
                    <div className="text-[11px] uppercase tracking-[0.36em] text-amber-200/60">
                      Victory in the Promised Land
                    </div>
                    <div className="space-y-2">
                      <h2 className="font-cinzel text-4xl font-semibold tracking-wide text-amber-50 sm:text-5xl">
                        {winner.name} Victorious!
                      </h2>
                      <div className="text-lg text-amber-100/82 sm:text-xl">{faction.name}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <div className="rounded-[26px] border border-white/10 bg-black/24 p-5 backdrop-blur-sm">
                    <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">Final Verdict</div>
                    <p className="mt-3 text-lg leading-relaxed text-amber-50/94">{theme.description}</p>
                    <p className="mt-4 text-sm leading-relaxed text-amber-100/72">{decisiveMoment}</p>
                  </div>

                  <div
                    className="rounded-[26px] border border-white/10 bg-black/24 p-5 text-left backdrop-blur-sm"
                    style={{ boxShadow: `0 0 0 1px ${theme.accentSoft} inset` }}
                  >
                    <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">World Focus</div>
                    <div className="mt-3 font-cinzel text-2xl text-amber-50">
                      {focusCity?.name ?? "The victorious heartland"}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-amber-100/72">
                      The camera and celebration effects center here first before the final ledger opens.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[26px] border border-white/10 bg-black/24 p-5 backdrop-blur-sm">
                  <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">Final Statistics</div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {finalStats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3"
                      >
                        <div className={`text-2xl font-semibold ${stat.tone}`}>{stat.value}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.2em] text-amber-100/55">
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <TabsList className="grid h-auto w-full grid-cols-3 gap-2 rounded-2xl bg-black/20 p-1 lg:w-[520px]">
                    <TabsTrigger value="summary" className="rounded-xl bg-transparent py-2.5 text-amber-100/75 data-[state=active]:bg-white/10 data-[state=active]:text-amber-50">
                      <span className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Summary
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="chronicle" className="rounded-xl bg-transparent py-2.5 text-amber-100/75 data-[state=active]:bg-white/10 data-[state=active]:text-amber-50">
                      <span className="flex items-center gap-2">
                        <ScrollText className="h-4 w-4" />
                        Chronicle
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="standings" className="rounded-xl bg-transparent py-2.5 text-amber-100/75 data-[state=active]:bg-white/10 data-[state=active]:text-amber-50">
                      <span className="flex items-center gap-2">
                        <Landmark className="h-4 w-4" />
                        Standings
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="summary" className="mt-4 space-y-5">
                  <div className="grid gap-5 lg:grid-cols-[0.96fr_1.04fr]">
                    <div className="space-y-4 rounded-[26px] border border-white/10 bg-black/18 p-5 backdrop-blur-sm">
                      <div>
                        <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">How Victory Was Achieved</div>
                        <div className="mt-1 text-lg font-cinzel text-amber-50">The winning condition made visible</div>
                      </div>
                      <div className="grid gap-3">
                        {metricCards.map((card) => (
                          <MetricRail
                            key={card.key}
                            label={card.label}
                            value={card.value}
                            detail={card.detail}
                            progress={card.progress}
                            accentColor={theme.accentColor}
                          />
                        ))}
                      </div>
                    </div>

                    <PowerProfileChart data={powerProfile} accentColor={theme.accentColor} />
                  </div>

                  <div className="rounded-[26px] border border-white/10 bg-black/18 p-5 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">Final Rankings</div>
                        <div className="mt-1 text-lg font-cinzel text-amber-50">Who controlled the late game</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {rankedPlayers.map((entry, index) => {
                        const playerFactionId = coerceFactionId(entry.player.factionId) ?? "NEPHITES";
                        const playerFaction = getFaction(playerFactionId);
                        return (
                          <div
                            key={entry.player.id}
                            className={`flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                              entry.isWinner
                                ? "border-amber-300/22 bg-amber-400/10"
                                : "border-white/8 bg-slate-950/35"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 text-lg font-semibold text-amber-100">#{index + 1}</div>
                              <AvatarBadge
                                playerId={entry.player.id}
                                playerName={entry.player.name}
                                factionId={playerFactionId}
                                size="small"
                              />
                              <div>
                                <div className="font-semibold text-amber-50">{entry.player.name}</div>
                                <div className="text-xs uppercase tracking-[0.22em] text-amber-100/55">
                                  {playerFaction.name}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-3 text-xs uppercase tracking-[0.18em] text-amber-100/60 sm:text-right">
                              <div>
                                <div className="text-base text-amber-50">{entry.player.citiesOwned.length}</div>
                                Cities
                              </div>
                              <div>
                                <div className="text-base text-amber-50">{entry.player.stats.faith}</div>
                                Faith
                              </div>
                              <div>
                                <div className="text-base text-amber-50">{entry.player.researchedTechs.length}</div>
                                Techs
                              </div>
                              <div>
                                <div className="text-base text-amber-50">{entry.unitsRemaining}</div>
                                Units
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="chronicle" className="mt-4">
                  <div className="rounded-[26px] border border-white/10 bg-black/18 p-5 backdrop-blur-sm">
                    <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">Campaign Chronicle</div>
                    <div className="mt-1 text-lg font-cinzel text-amber-50">The closing arc of the match</div>
                    <div className="mt-5 space-y-3">
                      {chronicle.map((entry, index) => (
                        <div key={`${entry.id}-${index}`} className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-100/72">
                              Turn {entry.turn}
                            </Badge>
                            <div className="text-sm font-semibold text-amber-50">{entry.playerName}</div>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-amber-100/74">{entry.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="standings" className="mt-4">
                  <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[26px] border border-white/10 bg-black/18 p-5 backdrop-blur-sm">
                      <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">Victory Seat</div>
                      <div className="mt-1 text-lg font-cinzel text-amber-50">{focusCity?.name ?? "The victorious heartland"}</div>
                      <p className="mt-3 text-sm leading-relaxed text-amber-100/72">
                        Highest population and production made this the natural focal point for the endgame reveal.
                      </p>

                      <Separator className="my-5 bg-white/10" />

                      <div className="space-y-3">
                        {[
                          {
                            label: "Most populous winner city",
                            value: focusCity?.population ?? 0,
                            detail: "Population pressure often signals where the winner's momentum became irreversible.",
                          },
                          {
                            label: "Total winner score",
                            value: rankedPlayers[0]?.score ?? 0,
                            detail: "A composite of cities, faith, research, units, and treasury at match end.",
                          },
                          {
                            label: "Cities in winner network",
                            value: winner.citiesOwned.length,
                            detail: "The final connected empire that supported the closing push.",
                          },
                        ].map((item) => (
                          <div key={item.label} className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-amber-200/55">{item.label}</div>
                            <div className="mt-2 text-2xl font-semibold text-amber-50">{item.value}</div>
                            <p className="mt-2 text-sm leading-relaxed text-amber-100/68">{item.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[26px] border border-white/10 bg-black/18 p-5 backdrop-blur-sm">
                      <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">Faction Comparison</div>
                      <div className="mt-1 text-lg font-cinzel text-amber-50">Late-game ledger by faction</div>
                      <div className="mt-4 space-y-3">
                        {rankedPlayers.map((entry) => {
                          const playerFactionId = coerceFactionId(entry.player.factionId) ?? "NEPHITES";
                          const playerFaction = getFaction(playerFactionId);
                          return (
                            <div key={entry.player.id} className="rounded-2xl border border-white/8 bg-slate-950/35 p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="font-semibold text-amber-50">{entry.player.name}</div>
                                  <div className="mt-1 text-xs uppercase tracking-[0.22em] text-amber-100/55">
                                    {playerFaction.name}
                                  </div>
                                </div>
                                {entry.isWinner && (
                                  <Badge className="rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-amber-100">
                                    Winner
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-amber-100/72 sm:grid-cols-4">
                                <div>Population {entry.population}</div>
                                <div>Faith {entry.player.stats.faith}</div>
                                <div>Stars {entry.player.stars}</div>
                                <div>Units {entry.unitsRemaining}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/10 bg-black/22 p-4 backdrop-blur-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="text-xs uppercase tracking-[0.26em] text-amber-200/60">Postgame Options</div>
                  <div className="mt-1 text-sm leading-relaxed text-amber-100/72">
                    Review the final world, start a fresh match immediately, or return to the main menu.
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {onContinueToMap && (
                    <GlowingButton
                      onClick={onContinueToMap}
                      variant="secondary"
                      glowColor="blue"
                      size="lg"
                      className="sm:min-w-[200px]"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Eye className="h-5 w-5" />
                        Continue To Map
                      </span>
                    </GlowingButton>
                  )}
                  <GlowingButton onClick={onPlayAgain} glowColor="amber" size="lg" className="sm:min-w-[180px]">
                    <span className="flex items-center justify-center gap-2">
                      <RotateCw className="h-5 w-5" />
                      Play Again
                    </span>
                  </GlowingButton>
                  <GlowingButton
                    onClick={onMainMenu}
                    variant="secondary"
                    glowColor="slate"
                    size="lg"
                    className="sm:min-w-[180px]"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Home className="h-5 w-5" />
                      Main Menu
                    </span>
                  </GlowingButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
