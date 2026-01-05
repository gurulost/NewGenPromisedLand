import { Fragment, useEffect, useMemo, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Coins, Compass, Info, Sparkles, Star, Swords } from 'lucide-react';
import { Button } from './button';
import { useSfxEngine } from '../../hooks/useSfx';
import { TECHNOLOGIES, type Technology } from '@shared/data/technologies';
import { UNIT_DEFINITIONS } from '@shared/data/units';
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from '@shared/types/city';
import { ABILITIES } from '@shared/data/abilities';
import { GAME_RULES } from '@shared/data/gameRules';

interface TechDiscoveryPanelProps {
  techId: string | null;
  onClose: () => void;
}

type UnlockGroup = {
  label: string;
  icon: JSX.Element;
  items: string[];
};

const CATEGORY_STYLES: Record<Technology['category'], { accent: string; glow: string; icon: JSX.Element }> = {
  economic: {
    accent: 'from-amber-500/30 via-emerald-400/10 to-transparent',
    glow: 'shadow-amber-500/30',
    icon: <Coins className="h-7 w-7" />,
  },
  military: {
    accent: 'from-red-500/30 via-amber-400/10 to-transparent',
    glow: 'shadow-red-500/30',
    icon: <Swords className="h-7 w-7" />,
  },
  religious: {
    accent: 'from-sky-500/30 via-indigo-400/10 to-transparent',
    glow: 'shadow-sky-500/30',
    icon: <Sparkles className="h-7 w-7" />,
  },
  exploration: {
    accent: 'from-teal-400/30 via-cyan-300/10 to-transparent',
    glow: 'shadow-teal-400/30',
    icon: <Compass className="h-7 w-7" />,
  },
};

const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

const resolveAbilityName = (abilityId: string) => {
  const direct = ABILITIES[abilityId as keyof typeof ABILITIES];
  if (direct?.name) return direct.name;
  const lower = abilityId.toLowerCase();
  const match = Object.values(ABILITIES).find(
    (ability) => ability.id.toLowerCase() === lower || ability.name.toLowerCase() === lower
  );
  return match?.name ?? titleCase(abilityId);
};

const formatBenefit = (value: string) => (value.includes('_') || value.includes('-') ? titleCase(value) : value);

export function TechDiscoveryPanel({ techId, onClose }: TechDiscoveryPanelProps) {
  const playSfx = useSfxEngine();
  const [showContent, setShowContent] = useState(false);
  const tech = techId ? TECHNOLOGIES[techId] : null;

  const unlockGroups = useMemo<UnlockGroup[]>(() => {
    if (!tech) return [];
    const units = (tech.unlocks.units || []).map((id) => UNIT_DEFINITIONS[id as keyof typeof UNIT_DEFINITIONS]?.name ?? titleCase(id));
    const improvements = (tech.unlocks.improvements || []).map((id) => IMPROVEMENT_DEFINITIONS[id as keyof typeof IMPROVEMENT_DEFINITIONS]?.name ?? titleCase(id));
    const structures = (tech.unlocks.structures || []).map((id) => STRUCTURE_DEFINITIONS[id as keyof typeof STRUCTURE_DEFINITIONS]?.name ?? titleCase(id));
    const abilities = (tech.unlocks.abilities || []).map(resolveAbilityName);
    const benefits = (tech.unlocks.benefits || []).map(formatBenefit);
    const hasSlinger = tech.unlocks.units?.includes('slinger');
    const hasCatapult = tech.unlocks.units?.includes('catapult');
    const hasFortress = tech.unlocks.structures?.includes('fortress');
    const rules: string[] = [];
    if (hasSlinger || hasCatapult) {
      rules.push('Ranged: forests reduce damage by 1');
    }
    if (hasCatapult) {
      rules.push('Siege: range 2-3, cannot fire adjacent; deploy first');
    }
    if (hasFortress) {
      rules.push(`Fortress: -${GAME_RULES.combat.fortificationBonus} ranged damage taken`);
    }

    return [
      { label: 'Units', icon: <Swords className="h-4 w-4" />, items: units },
      { label: 'Improvements', icon: <Coins className="h-4 w-4" />, items: improvements },
      { label: 'Structures', icon: <BookOpen className="h-4 w-4" />, items: structures },
      { label: 'Abilities', icon: <Sparkles className="h-4 w-4" />, items: abilities },
      { label: 'Benefits', icon: <Star className="h-4 w-4" />, items: benefits },
      { label: 'Rules', icon: <Info className="h-4 w-4" />, items: rules },
    ].filter((group) => group.items.length > 0);
  }, [tech]);

  useEffect(() => {
    if (!tech) return;
    playSfx('tech-discovery');
    setShowContent(false);
    const timer = window.setTimeout(() => setShowContent(true), 180);
    return () => window.clearTimeout(timer);
  }, [tech, playSfx]);

  if (!tech) return null;

  const categoryStyle = CATEGORY_STYLES[tech.category];
  const hasUnlocks = unlockGroups.length > 0;

  return (
    <Transition appear show={!!tech} as={Fragment}>
      <Dialog as="div" className="relative z-[190]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 text-left shadow-2xl">
                <div className={`absolute -inset-8 bg-gradient-to-r ${categoryStyle.accent} opacity-70 blur-2xl`} />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_50%)]" />
                <motion.div
                  className="absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full border border-amber-300/20 bg-amber-200/10"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                />

                <div className="relative z-10">
                  <div className="flex items-center justify-center">
                    <motion.div
                      className={`flex h-20 w-20 items-center justify-center rounded-full border border-amber-400/40 bg-gradient-to-br from-amber-500/30 to-slate-900 shadow-2xl ${categoryStyle.glow}`}
                      initial={{ scale: 0.6, rotate: -25 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 140, damping: 14 }}
                    >
                      <div className="text-amber-200">{categoryStyle.icon}</div>
                    </motion.div>
                  </div>

                  <div className="mt-4 text-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1 text-xs uppercase tracking-[0.3em] text-amber-200/80">
                      <Sparkles className="h-3 w-3" />
                      Tech Unlocked
                    </span>
                    <Dialog.Title className="mt-3 text-3xl font-cinzel font-semibold text-amber-100">
                      {tech.name}
                    </Dialog.Title>
                    <p className="mt-2 text-sm text-amber-100/70">
                      {tech.description}
                    </p>
                  </div>

                  <AnimatePresence>
                    {showContent && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className="mt-6 space-y-4"
                      >
                        <div className="rounded-2xl border border-amber-500/20 bg-slate-900/60 p-5 shadow-inner">
                          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-200">
                            <BookOpen className="h-4 w-4" />
                            New Knowledge
                          </div>
                          {hasUnlocks ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                              {unlockGroups.map((group) => (
                                <div key={group.label} className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
                                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-slate-300">
                                    {group.icon}
                                    {group.label}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {group.items.map((item) => (
                                      <span
                                        key={item}
                                        className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.25)]"
                                      >
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-4 text-sm text-slate-200">
                              This knowledge sharpens your strategy and deepens your people. No new assets unlock, but the era advances.
                            </div>
                          )}
                        </div>

                        <div className="flex justify-center">
                          <Button
                            onClick={onClose}
                            className="w-full max-w-xs bg-amber-600 text-amber-100 shadow-lg shadow-amber-900/30 hover:bg-amber-500"
                          >
                            Continue
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
