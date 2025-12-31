import React, { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSfxEngine } from '../../hooks/useSfx';
import { Button } from './button';
import { TOKENS } from '../../theme/tokens';
import { getRarityColor, getRewardIcon, RuinsReward } from '../../../../shared/data/ruinsRewards';

interface RuinsRewardPanelProps {
    reward: RuinsReward | null;
    onClose: () => void;
}

export function RuinsRewardPanel({ reward, onClose }: RuinsRewardPanelProps) {
    const playSfx = useSfxEngine();
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        if (reward) {
            playSfx('panel-open');
            // Delay showing content slightly for dramatic effect
            setTimeout(() => setShowContent(true), 300);
        }
    }, [reward, playSfx]);

    if (!reward) return null;

    const rarityColor = getRarityColor(reward.rarity);
    const icon = getRewardIcon(reward.type);

    return (
        <Transition appear show={!!reward} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
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
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 border-2 border-amber-600/50 p-6 text-left align-middle shadow-xl transition-all">

                                {/* Header with animated icon */}
                                <div className="flex flex-col items-center justify-center mb-6">
                                    <motion.div
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
                                        className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-600/20 to-stone-800 border-2 border-amber-500/30 flex items-center justify-center text-6xl shadow-inner mb-4"
                                    >
                                        {icon}
                                    </motion.div>

                                    <Dialog.Title
                                        as="h3"
                                        className={`text-2xl font-cinzel font-bold ${rarityColor} mb-1`}
                                    >
                                        {reward.name}
                                    </Dialog.Title>

                                    <div className={`text-xs uppercase tracking-widest font-bold ${rarityColor} opacity-70`}>
                                        {reward.rarity} Discovery
                                    </div>
                                </div>

                                {/* Reward Description */}
                                <AnimatePresence>
                                    {showContent && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                            className="text-center space-y-4"
                                        >
                                            <p className="text-amber-100/90 italic text-lg leading-relaxed">
                                                "{reward.description}"
                                            </p>

                                            {reward.scripture && (
                                                <div className="bg-amber-900/20 border border-amber-800/30 p-3 rounded-lg mt-4">
                                                    <p className="text-amber-200/70 text-sm font-serif">
                                                        {reward.scripture}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Rewards breakdown */}
                                            <div className="grid grid-cols-2 gap-3 mt-6">
                                                {reward.stars && (
                                                    <RewardBadge label="Stars" value={`+${reward.stars}`} color="text-amber-400 bg-amber-900/20 border-amber-600/30" />
                                                )}
                                                {reward.faith && (
                                                    <RewardBadge label="Faith" value={`+${reward.faith}`} color="text-blue-400 bg-blue-900/20 border-blue-600/30" />
                                                )}
                                                {reward.techBoost && (
                                                    <RewardBadge label="Knowledge" value={`+${reward.techBoost}`} color="text-cyan-400 bg-cyan-900/20 border-cyan-600/30" />
                                                )}
                                                {reward.techName && (
                                                    <RewardBadge label="Technology" value={reward.techName} color="text-cyan-300 bg-cyan-900/20 border-cyan-600/30" />
                                                )}
                                                {reward.population && (
                                                    <RewardBadge label="Population" value={`+${reward.population}`} color="text-emerald-400 bg-emerald-900/20 border-emerald-600/30" />
                                                )}
                                                {reward.unitType && (
                                                    <RewardBadge
                                                        label="Unit"
                                                        value={reward.unitName || reward.unitType || 'Recruited'}
                                                        color="text-red-400 bg-red-900/20 border-red-600/30"
                                                    />
                                                )}
                                                {reward.healAmount && (
                                                    <RewardBadge label="Healing" value={`+${reward.healAmount} HP`} color="text-green-400 bg-green-900/20 border-green-600/30" />
                                                )}
                                                {reward.visionTurns && (
                                                    <RewardBadge label="Vision" value={`+${reward.visionTurns} Turns`} color="text-purple-400 bg-purple-900/20 border-purple-600/30" />
                                                )}
                                                {reward.reveal && (
                                                    <RewardBadge label="Revelation" value={reward.reveal} color="text-indigo-300 bg-indigo-900/20 border-indigo-600/30" />
                                                )}
                                                {/* Curses */}
                                                {reward.dissent && (
                                                    <RewardBadge label="Dissent" value={`+${reward.dissent}`} color="text-red-500 bg-red-950/40 border-red-800/50" />
                                                )}
                                                {reward.pride && (
                                                    <RewardBadge label="Pride" value={`+${reward.pride}`} color="text-purple-500 bg-purple-950/40 border-purple-800/50" />
                                                )}
                                            </div>

                                            <div className="mt-8">
                                                <Button
                                                    onClick={() => {
                                                        playSfx('cta-click');
                                                        onClose();
                                                    }}
                                                    className="w-full bg-amber-700 hover:bg-amber-600 text-amber-100 font-bold py-3 text-lg shadow-lg shadow-amber-900/20"
                                                >
                                                    Claim Reward
                                                </Button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

function RewardBadge({ label, value, color }: { label: string, value: string, color: string }) {
    return (
        <div className={`px-3 py-2 rounded border ${color} flex flex-col items-center justify-center`}>
            <span className="text-xs opacity-70 uppercase tracking-wide mb-1">{label}</span>
            <span className="font-bold text-lg">{value}</span>
        </div>
    );
}
