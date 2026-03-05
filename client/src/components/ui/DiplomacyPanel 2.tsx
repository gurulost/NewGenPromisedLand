import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

import { Button } from './button';
import { Badge } from './badge';
import { Separator } from './separator';
import { GameState } from '../../../../shared/types/game';
import { TOKENS } from '../../theme/tokens';
import { useHotkeys } from '../../hooks/useHotkeys';
import { useSfxEngine } from '../../hooks/useSfx';
import { StaggeredContent, StaggeredContainer } from '../primitives/StaggeredContent';
import { Swords, Heart, Coins, Crown, Users, TrendingUp } from 'lucide-react';
import {
    areCitiesConnectedByRoad,
    calculateTradeRouteEstablishCostStars,
    calculateTradeRouteStarsPerTurn
} from '@shared/logic/tradeRoutes';

export interface DiplomacyPanelProps {
    gameState: GameState;
    currentPlayerId: string;
    onClose: () => void;
}

type DiplomacyTab = 'war' | 'alliance' | 'trade';

export function DiplomacyPanel({ gameState, currentPlayerId, onClose }: DiplomacyPanelProps) {
    const [activeTab, setActiveTab] = useState<DiplomacyTab>('war');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [selectedFromCity, setSelectedFromCity] = useState<string | null>(null);
    const [selectedToCity, setSelectedToCity] = useState<string | null>(null);
    const [confirmWarTarget, setConfirmWarTarget] = useState<string | null>(null);

    useHotkeys('Escape', onClose);
    const playSfx = useSfxEngine();

    React.useEffect(() => {
        playSfx('panel-open');
    }, [playSfx]);

    const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
    if (!currentPlayer) return null;

    const otherPlayers = gameState.players.filter(p =>
        p.id !== currentPlayerId && !p.isEliminated
    );

    const playerCities = gameState.cities?.filter(city =>
        currentPlayer.citiesOwned.includes(city.id)
    ) || [];

    const handleConfirmWar = (targetPlayerId: string) => {
        setConfirmWarTarget(targetPlayerId);
    };

    const handleDeclareWar = (targetPlayerId: string) => {
        // Dispatch war declaration
        const event = new CustomEvent('diplomacyAction', {
            detail: {
                type: 'DECLARE_WAR',
                payload: { playerId: currentPlayerId, targetPlayerId }
            }
        });
        window.dispatchEvent(event);
        playSfx('cta-click');
        setConfirmWarTarget(null);
        onClose();
    };

    const handleFormAlliance = (targetPlayerId: string) => {
        // Dispatch alliance formation
        const event = new CustomEvent('diplomacyAction', {
            detail: {
                type: 'FORM_ALLIANCE',
                payload: { playerId: currentPlayerId, targetPlayerId }
            }
        });
        window.dispatchEvent(event);
        playSfx('cta-click');
        onClose();
    };

    const handleEstablishTrade = () => {
        if (!selectedFromCity || !selectedToCity) return;

        // Dispatch trade route establishment
        const event = new CustomEvent('diplomacyAction', {
            detail: {
                type: 'ESTABLISH_TRADE_ROUTE',
                payload: {
                    playerId: currentPlayerId,
                    fromCityId: selectedFromCity,
                    toCityId: selectedToCity
                }
            }
        });
        window.dispatchEvent(event);
        playSfx('cta-click');
        onClose();
    };

    return (
        <Transition appear show as={Fragment}>
            <Dialog as="div" className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4" data-ui-layer="modal" onClose={onClose}>
                <Transition.Child
                    as={motion.div}
                    initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black backdrop-blur-md"
                />

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
                        data-ui-layer="modal-content"
                        className="relative z-[var(--z-modal-content)] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl
                       bg-gradient-to-br from-stone-900/95 to-stone-800/90 border border-amber-600/40
                       text-amber-100 shadow-2xl shadow-black/60 p-6"
                    >
                        <StaggeredContainer>
                            {/* Header */}
                            <StaggeredContent>
                                <header className="mb-4 flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h2 className="font-cinzel text-2xl text-amber-200 flex items-center gap-2">
                                            <Users className="w-6 h-6" />
                                            Diplomacy
                                        </h2>
                                        <p className="text-amber-300/80 text-sm mt-1">
                                            Mosiah 29:26 – "...it is not common that the voice of the people desireth anything contrary to that which is right..."
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={onClose}
                                        className="h-10 w-10 rounded-full bg-amber-600/10 p-0 text-amber-300
                                     transition hover:scale-110 hover:bg-amber-600/20 hover:text-amber-100">
                                        ×
                                    </Button>
                                </header>
                            </StaggeredContent>

                            {/* Current Relations Section */}
                            <StaggeredContent>
                                <div className="mb-6 p-3 bg-stone-800/50 border border-stone-700/50 rounded-lg">
                                    <h3 className="text-xs uppercase tracking-wide text-stone-400 mb-2">Current Relations</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {/* Show wars */}
                                        {currentPlayer.atWarWith && currentPlayer.atWarWith.length > 0 ? (
                                            currentPlayer.atWarWith.map((enemyId: string) => {
                                                const enemy = gameState.players.find(p => p.id === enemyId);
                                                return enemy ? (
                                                    <Badge key={enemyId} className="bg-red-900/40 text-red-300 border-red-600/50">
                                                        ⚔️ War: {enemy.name}
                                                    </Badge>
                                                ) : null;
                                            })
                                        ) : null}

                                        {/* Show alliances */}
                                        {currentPlayer.alliedWith && currentPlayer.alliedWith.length > 0 ? (
                                            currentPlayer.alliedWith.map((allyId: string) => {
                                                const ally = gameState.players.find(p => p.id === allyId);
                                                return ally ? (
                                                    <Badge key={allyId} className="bg-blue-900/40 text-blue-300 border-blue-600/50">
                                                        🤝 Alliance: {ally.name}
                                                    </Badge>
                                                ) : null;
                                            })
                                        ) : null}

                                        {/* Show trade routes */}
                                        {currentPlayer.tradeRoutes && currentPlayer.tradeRoutes.length > 0 ? (
                                            <Badge className="bg-amber-900/40 text-amber-300 border-amber-600/50">
                                                📦 {currentPlayer.tradeRoutes.length} Trade Route{currentPlayer.tradeRoutes.length > 1 ? 's' : ''}
                                            </Badge>
                                        ) : null}

                                        {/* Show "No active relations" if empty */}
                                        {(!currentPlayer.atWarWith || currentPlayer.atWarWith.length === 0) &&
                                            (!currentPlayer.alliedWith || currentPlayer.alliedWith.length === 0) &&
                                            (!currentPlayer.tradeRoutes || currentPlayer.tradeRoutes.length === 0) && (
                                                <span className="text-stone-500 text-sm italic">No active diplomatic relations</span>
                                            )}
                                    </div>
                                </div>
                            </StaggeredContent>

                            {/* Tab Navigation */}
                            <StaggeredContent>
                                <div className="flex gap-2 mb-6 border-b border-amber-600/30 pb-2">
                                    <TabButton
                                        active={activeTab === 'war'}
                                        onClick={() => setActiveTab('war')}
                                        icon={<Swords className="w-4 h-4" />}
                                        label="Declare War"
                                        color="red"
                                    />
                                    <TabButton
                                        active={activeTab === 'alliance'}
                                        onClick={() => setActiveTab('alliance')}
                                        icon={<Heart className="w-4 h-4" />}
                                        label="Form Alliance"
                                        color="blue"
                                    />
                                    <TabButton
                                        active={activeTab === 'trade'}
                                        onClick={() => setActiveTab('trade')}
                                        icon={<Coins className="w-4 h-4" />}
                                        label="Trade Routes"
                                        color="gold"
                                    />
                                </div>
                            </StaggeredContent>

                            {/* Tab Content */}
                            {activeTab === 'war' && (
                                <WarTab
                                    otherPlayers={otherPlayers}
                                    currentPlayer={currentPlayer}
                                    confirmWarTarget={confirmWarTarget}
                                    onConfirmWar={handleConfirmWar}
                                    onDeclareWar={handleDeclareWar}
                                    onCancelWar={() => setConfirmWarTarget(null)}
                                />
                            )}

                            {activeTab === 'alliance' && (
                                <AllianceTab
                                    otherPlayers={otherPlayers}
                                    currentPlayer={currentPlayer}
                                    onFormAlliance={handleFormAlliance}
                                />
                            )}

                            {activeTab === 'trade' && (
                                <TradeTab
                                    gameState={gameState}
                                    currentPlayer={currentPlayer}
                                    playerCities={playerCities}
                                    selectedFromCity={selectedFromCity}
                                    selectedToCity={selectedToCity}
                                    onSelectFromCity={setSelectedFromCity}
                                    onSelectToCity={setSelectedToCity}
                                    onEstablishTrade={handleEstablishTrade}
                                />
                            )}
                        </StaggeredContainer>
                    </motion.div>
                </Transition.Child>
            </Dialog>
        </Transition>
    );
}

// Tab Button Component
interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color: 'red' | 'blue' | 'gold';
}

function TabButton({ active, onClick, icon, label, color }: TabButtonProps) {
    const colors = {
        red: active ? 'bg-red-900/60 border-red-600 text-red-200' : 'border-red-900/30 text-red-300/50 hover:text-red-200',
        blue: active ? 'bg-blue-900/60 border-blue-600 text-blue-200' : 'border-blue-900/30 text-blue-300/50 hover:text-blue-200',
        gold: active ? 'bg-amber-900/60 border-amber-600 text-amber-200' : 'border-amber-900/30 text-amber-300/50 hover:text-amber-200'
    };

    return (
        <button
            onClick={onClick}
            className={clsx(
                'px-4 py-2 rounded-lg border transition-all flex items-center gap-2 font-semibold text-sm',
                colors[color]
            )}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}

// War Declaration Tab
function WarTab({ otherPlayers, currentPlayer, confirmWarTarget, onConfirmWar, onDeclareWar, onCancelWar }: any) {
    const targetPlayer = confirmWarTarget ? otherPlayers.find((p: any) => p.id === confirmWarTarget) : null;

    return (
        <StaggeredContent>
            <div className="space-y-4">
                {/* Confirmation Dialog */}
                {confirmWarTarget && targetPlayer && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-red-950/80 border-2 border-red-600 rounded-lg p-6 text-center"
                    >
                        <Swords className="w-12 h-12 text-red-400 mx-auto mb-3" />
                        <h3 className="font-cinzel text-xl font-bold text-red-200 mb-2">
                            Declare War on {targetPlayer.name}?
                        </h3>
                        <p className="text-sm text-amber-100/80 mb-4">
                            This action cannot be undone easily. War brings pride but also internal strife.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button
                                onClick={onCancelWar}
                                className="bg-stone-700 hover:bg-stone-600"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => onDeclareWar(confirmWarTarget)}
                                className="bg-red-700 hover:bg-red-600"
                            >
                                <Swords className="w-4 h-4 mr-2" />
                                Confirm War
                            </Button>
                        </div>
                    </motion.div>
                )}

                {!confirmWarTarget && (
                    <>
                        <div className="bg-red-900/20 border border-red-600/40 rounded-lg p-4">
                            <h3 className="font-cinzel text-lg font-semibold text-red-200 mb-2 flex items-center gap-2">
                                Declare War
                                {currentPlayer.diplomaticCooldowns?.declareWar > 0 && (
                                    <span className="text-xs bg-orange-800/60 text-orange-200 px-2 py-0.5 rounded">
                                        {currentPlayer.diplomaticCooldowns.declareWar} turns cooldown
                                    </span>
                                )}
                            </h3>
                            <p className="text-sm text-amber-100/80 mb-4">
                                Choose a civilization to declare war upon. This will increase your Pride but also cause Internal Dissent.
                            </p>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="text-red-300">Effects: +15 Pride</div>
                                <div className="text-orange-300">Cost: +5 Dissent</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {otherPlayers.map((player: any) => {
                                const alreadyAtWar = currentPlayer.atWarWith?.includes(player.id);
                                const onCooldown = (currentPlayer.diplomaticCooldowns?.declareWar || 0) > 0;
                                const isDisabled = alreadyAtWar || onCooldown;
                                return (
                                    <motion.div
                                        key={player.id}
                                        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
                                        className={clsx(
                                            "p-4 bg-stone-900/40 border rounded-lg transition-all",
                                            isDisabled
                                                ? "border-red-800/50 opacity-60 cursor-not-allowed"
                                                : "border-red-600/30 hover:border-red-600/60 cursor-pointer"
                                        )}
                                        onClick={() => !isDisabled && onConfirmWar(player.id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-semibold text-amber-100 flex items-center gap-2">
                                                    {player.name}
                                                    {alreadyAtWar && (
                                                        <span className="text-xs bg-red-800/50 text-red-300 px-2 py-0.5 rounded">
                                                            At War
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-amber-300/70">Cities: {player.citiesOwned.length}</div>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="bg-red-700 hover:bg-red-600"
                                                disabled={isDisabled}
                                            >
                                                <Swords className="w-4 h-4 mr-2" />
                                                {alreadyAtWar ? 'At War' : onCooldown ? 'Cooldown' : 'Declare War'}
                                            </Button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </StaggeredContent>
    );
}

// Alliance Formation Tab
function AllianceTab({ otherPlayers, currentPlayer, onFormAlliance }: any) {
    const allianceCooldown = currentPlayer.diplomaticCooldowns?.formAlliance || 0;

    return (
        <StaggeredContent>
            <div className="space-y-4">
                <div className="bg-blue-900/20 border border-blue-600/40 rounded-lg p-4">
                    <h3 className="font-cinzel text-lg font-semibold text-blue-200 mb-2 flex items-center gap-2">
                        Form Alliance
                        {allianceCooldown > 0 && (
                            <span className="text-xs bg-cyan-800/60 text-cyan-200 px-2 py-0.5 rounded">
                                {allianceCooldown} turns cooldown
                            </span>
                        )}
                    </h3>
                    <p className="text-sm text-amber-100/80 mb-4">
                        Establish peaceful relations with another civilization. Boosts Faith and reduces dissent.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="text-blue-300">Effects: +10 Faith</div>
                        <div className="text-green-300">Benefit: -10 Dissent</div>
                    </div>
                </div>

                <div className="space-y-2">
                    {otherPlayers.map((player: any) => {
                        const alreadyAllied = currentPlayer.alliedWith?.includes(player.id);
                        const atWar = currentPlayer.atWarWith?.includes(player.id);
                        const onCooldown = allianceCooldown > 0;
                        const canAlly = !alreadyAllied && !atWar && !onCooldown;

                        return (
                            <motion.div
                                key={player.id}
                                whileHover={{ scale: canAlly ? 1.02 : 1 }}
                                className={clsx(
                                    "p-4 bg-stone-900/40 border rounded-lg transition-all",
                                    alreadyAllied
                                        ? "border-blue-600/60 bg-blue-900/20"
                                        : atWar
                                            ? "border-red-800/50 opacity-60 cursor-not-allowed"
                                            : "border-blue-600/30 hover:border-blue-600/60 cursor-pointer"
                                )}
                                onClick={() => canAlly && onFormAlliance(player.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-semibold text-amber-100 flex items-center gap-2">
                                            {player.name}
                                            {alreadyAllied && (
                                                <span className="text-xs bg-blue-800/50 text-blue-300 px-2 py-0.5 rounded">
                                                    Allied
                                                </span>
                                            )}
                                            {atWar && (
                                                <span className="text-xs bg-red-800/50 text-red-300 px-2 py-0.5 rounded">
                                                    At War
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-amber-300/70">Faith: {player.stats.faith}</div>
                                    </div>
                                    <Button
                                        size="sm"
                                        className={alreadyAllied ? "bg-blue-800" : atWar ? "bg-gray-700" : "bg-blue-700 hover:bg-blue-600"}
                                        disabled={!canAlly}
                                    >
                                        <Heart className="w-4 h-4 mr-2" />
                                        {alreadyAllied ? 'Allied' : atWar ? 'At War' : 'Form Alliance'}
                                    </Button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </StaggeredContent>
    );
}

// Trade Routes Tab
function TradeTab({ gameState, currentPlayer, playerCities, selectedFromCity, selectedToCity, onSelectFromCity, onSelectToCity, onEstablishTrade }: any) {
    const allCities = gameState.cities || [];
    const hasTradeTech = (currentPlayer.researchedTechs || []).includes('trade');
    const tradeCooldown = currentPlayer.diplomaticCooldowns?.requestTrade || 0;
    const tradeRoutes = currentPlayer.tradeRoutes || [];
    const maxRoutes = Math.max(1, (currentPlayer.citiesOwned || []).length);

    const fromCity = allCities.find((c: any) => c.id === selectedFromCity);
    const toCity = allCities.find((c: any) => c.id === selectedToCity);
    const isConnected = !!(
        selectedFromCity &&
        selectedToCity &&
        areCitiesConnectedByRoad(gameState, currentPlayer.id, selectedFromCity, selectedToCity)
    );

    const isDuplicatePair = !!(selectedFromCity && selectedToCity && tradeRoutes.some((r: any) =>
        (r.fromCityId === selectedFromCity && r.toCityId === selectedToCity) ||
        (r.fromCityId === selectedToCity && r.toCityId === selectedFromCity)
    ));

    const fromAlreadyHasOutgoing = !!(selectedFromCity && tradeRoutes.some((r: any) => r.fromCityId === selectedFromCity));

    const starsPerTurn =
        selectedFromCity && selectedToCity
            ? calculateTradeRouteStarsPerTurn(gameState, currentPlayer.id, selectedFromCity, selectedToCity)
            : 0;

    const costStars = calculateTradeRouteEstablishCostStars(starsPerTurn);

    const canEstablish =
        hasTradeTech &&
        tradeCooldown === 0 &&
        !!selectedFromCity &&
        !!selectedToCity &&
        !isDuplicatePair &&
        tradeRoutes.length < maxRoutes &&
        !fromAlreadyHasOutgoing &&
        isConnected &&
        currentPlayer.stars >= costStars;

    return (
        <StaggeredContent>
            <div className="space-y-4">
                <div className="bg-amber-900/20 border border-amber-600/40 rounded-lg p-4">
                    <h3 className="font-cinzel text-lg font-semibold text-amber-200 mb-2">Establish Trade Route</h3>
                    <p className="text-sm text-amber-100/80 mb-4">
                        Establish a persistent trade route between your cities. Requires Trade tech and a road connection.
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs text-amber-200/80">
                        <div>Requires: Trade technology</div>
                        <div>Limit: {tradeRoutes.length}/{maxRoutes} routes</div>
                        <div>Cooldown: {tradeCooldown > 0 ? `${tradeCooldown} turns` : 'Ready'}</div>
                        <div>Income: {starsPerTurn > 0 ? `+${starsPerTurn}★/turn` : '—'}</div>
                    </div>
                    {!hasTradeTech && (
                        <div className="mt-3 text-xs text-red-200/90">
                            Research Trade to unlock trade routes.
                        </div>
                    )}
                    {hasTradeTech && selectedFromCity && selectedToCity && !isConnected && (
                        <div className="mt-3 text-xs text-red-200/90">
                            Cities must be connected by roads to trade.
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* From City Selection */}
                    <div>
                        <h4 className="text-sm font-semibold text-amber-200 mb-2">From (Your City)</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {playerCities.map((city: any) => (
                                <div
                                    key={city.id}
                                    onClick={() => onSelectFromCity(city.id)}
                                    className={clsx(
                                        'p-3 rounded-lg border cursor-pointer transition-all',
                                        selectedFromCity === city.id
                                            ? 'bg-amber-700/40 border-amber-600'
                                            : 'bg-stone-900/40 border-amber-900/30 hover:border-amber-600/50'
                                    )}
                                >
                                    <div className="font-semibold text-sm">{city.name}</div>
                                    <div className="text-xs text-amber-300/70">
                                        Pop: {city.population} • Lvl: {city.level}
                                        {tradeRoutes.some((r: any) => r.fromCityId === city.id) && (
                                            <span className="ml-2 text-amber-200/80">(has outgoing route)</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* To City Selection */}
                    <div>
                        <h4 className="text-sm font-semibold text-amber-200 mb-2">To (Your City)</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {playerCities.filter((c: any) => c.id !== selectedFromCity).map((city: any) => (
                                <div
                                    key={city.id}
                                    onClick={() => onSelectToCity(city.id)}
                                    className={clsx(
                                        'p-3 rounded-lg border cursor-pointer transition-all',
                                        selectedToCity === city.id
                                            ? 'bg-amber-700/40 border-amber-600'
                                            : 'bg-stone-900/40 border-amber-900/30 hover:border-amber-600/50'
                                    )}
                                >
                                    <div className="font-semibold text-sm">{city.name}</div>
                                    <div className="text-xs text-amber-300/70">
                                        Pop: {city.population} • Lvl: {city.level}
                                        {selectedFromCity && (
                                            <span className="ml-2">
                                                {selectedFromCity && areCitiesConnectedByRoad(gameState, currentPlayer.id, selectedFromCity, city.id) ? 'Connected' : 'Not connected'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Existing routes */}
                {tradeRoutes.length > 0 && (
                    <div className="bg-stone-900/40 border border-amber-900/30 rounded-lg p-4">
                        <div className="text-sm font-semibold text-amber-200 mb-2">Active Routes</div>
                        <div className="space-y-2 text-xs">
                            {tradeRoutes.map((route: any, idx: number) => {
                                const a = allCities.find((c: any) => c.id === route.fromCityId);
                                const b = allCities.find((c: any) => c.id === route.toCityId);
                                return (
                                    <div key={`${route.fromCityId}_${route.toCityId}_${idx}`} className="flex items-center justify-between">
                                        <div className="text-amber-100/90">
                                            {a?.name || route.fromCityId} → {b?.name || route.toCityId}
                                        </div>
                                        <div className="text-amber-300/80">+{route.starsPerTurn}★/turn</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <Button
                    onClick={onEstablishTrade}
                    disabled={!canEstablish}
                    className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Establish Trade Route {starsPerTurn > 0 ? `(Cost ${costStars}★)` : ''}
                </Button>
            </div>
        </StaggeredContent>
    );
}
