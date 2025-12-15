import React, { Fragment, useMemo } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { Button } from './button';
import { Badge } from './badge';
import { Separator } from './separator';
import { HexCoordinate } from '../../../../shared/types/coordinates';
import { VILLAGE_ACTIONS, canAffordVillageAction, VillageActionDefinition } from '../../../../shared/data/villageActions';
import { GameState } from '../../../../shared/types/game';

import { TOKENS } from '../../theme/tokens';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useSfxEngine } from '../../hooks/useSfx';
import { StaggeredContent, StaggeredContainer } from '../primitives/StaggeredContent';
import { ResourceDeltaBadge } from './WorldElementPanel';

export interface VillageCapturePanelProps {
    gameState: GameState;
    playerId: string;
    unitId: string;
    coordinate: HexCoordinate;
    onAction: (actionType: 'conquer' | 'convert') => void;
    onClose: () => void;
}

export function VillageCapturePanel(props: VillageCapturePanelProps) {
    const { gameState, playerId, onAction, onClose } = props;
    const player = gameState.players.find(p => p.id === playerId);

    useHotkeys('Escape', onClose);
    const playSfx = useSfxEngine();

    // Play panel open sound
    React.useEffect(() => {
        playSfx('panel-open');
    }, [playSfx]);

    if (!player) return null;

    const conquerAction = VILLAGE_ACTIONS.conquer;
    const convertAction = VILLAGE_ACTIONS.convert;

    const canConquer = canAffordVillageAction(conquerAction, { faith: player.stats.faith, stars: player.stars });
    const canConvert = canAffordVillageAction(convertAction, { faith: player.stats.faith, stars: player.stars });

    const formatCost = (action: VillageActionDefinition) => {
        const parts: string[] = [];
        if (action.requirements.stars > 0) parts.push(`${action.requirements.stars} Stars`);
        if (action.requirements.faith > 0) parts.push(`${action.requirements.faith} Faith`);
        return parts.length ? parts.join(', ') : 'Free';
    };

    const formatMoralImpact = (action: VillageActionDefinition) => {
        const parts: string[] = [];
        if (action.moralImpact.pride) parts.push(`${action.moralImpact.pride > 0 ? '+' : ''}${action.moralImpact.pride} Pride`);
        if (action.moralImpact.dissent) parts.push(`${action.moralImpact.dissent > 0 ? '+' : ''}${action.moralImpact.dissent} Dissent`);
        if (action.moralImpact.faith) parts.push(`${action.moralImpact.faith > 0 ? '+' : ''}${action.moralImpact.faith} Faith`);
        return parts.length ? parts.join(', ') : 'None';
    };

    return (
        <Transition appear show as={Fragment}>
            <Dialog as="div" className="fixed inset-0 z-50 flex items-center justify-center p-4"
                onClose={onClose}>
                {/* Backdrop */}
                <Transition.Child
                    as={motion.div}
                    initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black backdrop-blur-md"
                />

                {/* Panel */}
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                >
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl
                       bg-gradient-to-br from-stone-900/95 to-stone-800/90 border border-amber-600/40
                       text-amber-100 shadow-2xl shadow-black/60 p-6"
                    >
                        {/* Particle sparkle overlay */}
                        <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,white,transparent)]">
                            <div className="absolute inset-0 animate-sparkle-slow" />
                        </div>

                        <StaggeredContainer>
                            {/* HEADER */}
                            <StaggeredContent>
                                <header className="mb-6 flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h2 className="font-cinzel text-2xl text-amber-200">Unclaimed Village</h2>
                                        <p className="text-amber-300/80 text-sm mt-1">Mosiah 7:21-22 – "...ye shall be brought into bondage, and no one shall deliver you..."</p>
                                        <p className="mt-3 text-amber-300/90 text-sm">
                                            Your unit has discovered a neutral settlement. How will you claim it?
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="icon" aria-label="Close panel"
                                        onClick={onClose}
                                        className="h-10 w-10 rounded-full bg-amber-600/10 p-0 text-amber-300
                                   transition hover:scale-110 hover:bg-amber-600/20 hover:text-amber-100">
                                        ×
                                    </Button>
                                </header>
                            </StaggeredContent>

                            {/* MORAL CHOICE MESSAGE */}
                            <StaggeredContent>
                                <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-800/20 p-4">
                                    <h3 className="mb-2 font-cinzel text-sm font-semibold text-amber-200">
                                        A Choice That Defines Your Path
                                    </h3>
                                    <p className="text-sm text-amber-100/90">
                                        Will you take by force or win through faith? Your decision shapes your civilization's moral compass
                                        and determines the legacy you leave behind.
                                    </p>
                                </div>
                            </StaggeredContent>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* CONQUER ACTION */}
                                <StaggeredContent>
                                    <VillageActionCard
                                        action={conquerAction}
                                        canAfford={canConquer}
                                        player={player}
                                        onExecute={() => onAction('conquer')}
                                        theme="red"
                                    />
                                </StaggeredContent>

                                {/* CONVERT ACTION */}
                                <StaggeredContent>
                                    <VillageActionCard
                                        action={convertAction}
                                        canAfford={canConvert}
                                        player={player}
                                        onExecute={() => onAction('convert')}
                                        theme="blue"
                                    />
                                </StaggeredContent>
                            </div>

                            {/* COMPARISON TABLE */}
                            <StaggeredContent>
                                <div className="mt-6 rounded-lg border border-amber-600/30 bg-stone-900/40 p-4">
                                    <h3 className="mb-3 font-cinzel text-sm font-semibold text-amber-200">Quick Comparison</h3>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div className="text-amber-300/70"></div>
                                        <div className="text-center font-semibold text-red-300">Conquer</div>
                                        <div className="text-center font-semibold text-blue-300">Convert</div>

                                        <div className="text-amber-300/70">Cost</div>
                                        <div className="text-center text-green-300">{formatCost(conquerAction)}</div>
                                        <div className="text-center text-amber-300">{formatCost(convertAction)}</div>

                                        <div className="text-amber-300/70">Immediate Stars</div>
                                        <div className="text-center text-amber-300">+{conquerAction.immediateRewards.stars}</div>
                                        <div className="text-center text-amber-300">+{convertAction.immediateRewards.stars}</div>

                                        <div className="text-amber-300/70">Ongoing Benefit</div>
                                        <div className="text-center text-gray-400">None</div>
                                        <div className="text-center text-green-300">
                                            {convertAction.ongoingRewards.starsPerTurn ? `+${convertAction.ongoingRewards.starsPerTurn} ⭐/turn` : 'None'}
                                        </div>

                                        <div className="text-amber-300/70">Moral Impact</div>
                                        <div className="text-center text-red-300">{formatMoralImpact(conquerAction)}</div>
                                        <div className="text-center text-blue-300">{formatMoralImpact(convertAction)}</div>
                                    </div>
                                </div>
                            </StaggeredContent>
                        </StaggeredContainer>
                    </motion.div>
                </Transition.Child>
            </Dialog>
        </Transition>
    );
}

/** Village Action Card Component */
interface VillageActionCardProps {
    action: VillageActionDefinition;
    canAfford: boolean;
    player: any;
    onExecute: () => void;
    theme: 'red' | 'blue';
}

function VillageActionCard({ action, canAfford, player, onExecute, theme }: VillageActionCardProps) {
    const isConquer = theme === 'red';
    const playSfx = useSfxEngine();

    return (
        <section className={clsx(
            'rounded-xl border-2 p-5 transition-all duration-200',
            isConquer
                ? 'border-red-600/50 bg-gradient-to-br from-red-900/30 to-red-800/20'
                : 'border-blue-600/50 bg-gradient-to-br from-blue-900/30 to-blue-800/20'
        )}>
            {/* Header */}
            <div className="mb-4">
                <Badge
                    className={clsx(
                        'px-3 py-1 font-semibold mb-2',
                        isConquer
                            ? 'bg-red-900/60 text-red-200 border border-red-600/50'
                            : 'bg-blue-900/60 text-blue-200 border border-blue-600/50'
                    )}
                >
                    {isConquer ? '⚔' : '✠'} {action.name}
                </Badge>
                <p className="text-sm text-amber-100/80 mt-2">{action.description}</p>
                <p className="text-xs text-amber-300/60 mt-1 italic">{action.summary}</p>
            </div>

            {/* Requirements */}
            {action.requirements.faith > 0 && (
                <div className="mb-3">
                    <h4 className="text-xs font-semibold text-amber-200 mb-2">COST</h4>
                    <ResourceDeltaBadge value={action.requirements.faith} type="faith" label="Faith Cost" />
                </div>
            )}

            {/* Immediate Rewards */}
            <div className="mb-3">
                <h4 className="text-xs font-semibold text-amber-200 mb-2">IMMEDIATE REWARDS</h4>
                <div className="flex flex-wrap gap-2">
                    <ResourceDeltaBadge value={action.immediateRewards.stars} type="stars" />
                    <ResourceDeltaBadge value={action.immediateRewards.population} type="population" />
                </div>
            </div>

            {/* Ongoing Benefits */}
            {action.ongoingRewards.starsPerTurn && (
                <div className="mb-3">
                    <h4 className="text-xs font-semibold text-amber-200 mb-2">PERMANENT BENEFITS</h4>
                    <div className="flex flex-wrap gap-2">
                        <motion.div
                            whileHover={{ scale: 1.08 }}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm bg-amber-900/30 border-amber-600/50"
                        >
                            <span className="text-amber-400 font-bold text-sm">+{action.ongoingRewards.starsPerTurn} ⭐/turn</span>
                        </motion.div>
                    </div>
                </div>
            )}

            {/* Moral Impact */}
            <div className="mb-4">
                <h4 className="text-xs font-semibold text-amber-200 mb-2">MORAL IMPACT</h4>
                <div className="flex flex-wrap gap-2">
                    {action.moralImpact.pride > 0 && <ResourceDeltaBadge value={action.moralImpact.pride} type="pride" />}
                    {action.moralImpact.faith > 0 && <ResourceDeltaBadge value={action.moralImpact.faith} type="faith" />}
                    {action.moralImpact.dissent > 0 && <ResourceDeltaBadge value={action.moralImpact.dissent} type="dissent" />}
                </div>
            </div>

            {/* Action Button */}
            <motion.div
                whileHover={canAfford ? { scale: 1.02 } : {}}
                whileTap={canAfford ? { scale: 0.98 } : {}}
            >
                <Button
                    onClick={() => {
                        if (canAfford) {
                            playSfx('cta-click');
                            onExecute();
                        }
                    }}
                    disabled={!canAfford}
                    size="lg"
                    className={clsx(
                        'w-full font-semibold shadow-xl transition-all duration-200 min-h-[48px] touch-manipulation',
                        isConquer
                            ? 'bg-gradient-to-r from-red-800 to-red-700 md:hover:from-red-700 md:hover:to-red-600 border border-red-600/50 shadow-red-500/25'
                            : 'bg-gradient-to-r from-blue-800 to-blue-700 md:hover:from-blue-700 md:hover:to-blue-600 border border-blue-600/50 shadow-blue-500/25',
                        !canAfford && 'cursor-not-allowed opacity-50 grayscale'
                    )}
                >
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-lg">{isConquer ? '⚔' : '✠'}</span>
                        <span>{action.name}</span>
                    </div>
                </Button>
            </motion.div>

            {/* Insufficient resources message */}
            {!canAfford && (
                <p className="mt-2 text-xs text-red-300 text-center">
                    Insufficient Faith (need {action.requirements.faith})
                </p>
            )}
        </section>
    );
}
