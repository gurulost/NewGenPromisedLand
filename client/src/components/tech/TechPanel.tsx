import React, { useState, useMemo, useEffect } from 'react';
import { Book, X, Lock, CheckCircle } from 'lucide-react';
import { useGesture } from '@use-gesture/react';

import { PanelShell } from '../primitives/PanelShell';  
import { PanelHeader } from '../primitives/PanelHeader';
import { GlowingButton } from '../primitives/GlowingButton';
import { ResourceDeltaBadge } from '../ui/WorldElementPanel';

import { GameState, PlayerState } from '@shared/types/game';
import { getTechValidation } from '../../selectors/tech';
import { TECHNOLOGIES, type Technology } from '@shared/data/technologies';
import { getTechnology, getTechCostDetails, playerHasTechPrerequisites } from '@shared/logic/technologyHelpers';
import { UNIT_DEFINITIONS } from '@shared/data/units';
import { IMPROVEMENT_DEFINITIONS, STRUCTURE_DEFINITIONS } from '@shared/types/city';
import { ABILITIES } from '@shared/data/abilities';
import { getTechCoordinates, TECH_CANVAS_SIZE, TECH_COLUMN_LABELS, TECH_LAYOUT_CONSTANTS, TECH_TIER_LABELS } from './techLayout';

const formatTechName = (techId: string) => getTechnology(techId)?.name ?? techId.replace(/_/g, ' ');

const resolveUnlockName = (category: keyof Technology['unlocks'], itemId: string): string => {
  switch (category) {
    case 'units':
      return UNIT_DEFINITIONS[itemId as keyof typeof UNIT_DEFINITIONS]?.name ?? itemId.replace(/_/g, ' ');
    case 'improvements':
      return IMPROVEMENT_DEFINITIONS[itemId as keyof typeof IMPROVEMENT_DEFINITIONS]?.name ?? itemId.replace(/_/g, ' ');
    case 'structures':
      return STRUCTURE_DEFINITIONS[itemId as keyof typeof STRUCTURE_DEFINITIONS]?.name ?? itemId.replace(/_/g, ' ');
    case 'abilities':
      return ABILITIES[itemId]?.name ?? itemId.replace(/_/g, ' ');
    default:
      return itemId.replace(/_/g, ' ');
  }
};

const buildUnlockList = (tech: Technology) => {
  const entries: Array<{ label: string; category: keyof Technology['unlocks'] }> = [];
  (Object.entries(tech.unlocks) as Array<[keyof Technology['unlocks'], string[] | undefined]>)
    .forEach(([category, items]) => {
      if (!items) return;
      items.forEach(item => {
        entries.push({
          label: resolveUnlockName(category, item),
          category,
        });
      });
    });
  return entries;
};

interface TechPanelProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  currentPlayer: PlayerState;
  onResearchTech: (techId: string) => void;
}

export function TechPanel({ isOpen, onClose, gameState, currentPlayer, onResearchTech }: TechPanelProps) {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  
  const techValidation = useMemo(() => 
    getTechValidation(currentPlayer, gameState),
    [currentPlayer, gameState]
  );

  // Gesture handling for pinch-zoom and pan
  const bind = useGesture({
    onDrag: ({ offset: [x, y] }) => setPosition({ x, y }),
    onPinch: ({ offset: [scale] }) => setZoom(Math.max(0.5, Math.min(2, scale))),
  });

  return (
    <PanelShell 
      isOpen={isOpen} 
      onClose={onClose}
      fullScreen
      aria-labelledby="tech-panel-title"
    >
      <div className="h-full flex flex-col">
        <PanelHeader
          icon={<Book className="w-6 h-6" />}
          title="Sacred Knowledge Tree"
          description="Research technologies inspired by Book of Mormon civilizations"
          onClose={onClose}
        />

        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Tech Tree Visualization */}
          <div className="flex-1 bg-slate-800/30 rounded-lg border border-amber-500/20 overflow-hidden">
            <div 
              {...bind()}
              className="w-full h-full cursor-move select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'center center'
              }}
            >
              <TechTree 
                technologies={TECHNOLOGIES}
                currentPlayer={currentPlayer}
                techValidation={techValidation}
                onSelectTech={setSelectedTech}
                selectedTech={selectedTech}
              />
            </div>
          </div>

          {/* Tech Details Panel */}
          {selectedTech && (
            <div className="w-80 bg-slate-800/40 rounded-lg border border-amber-500/20 p-4">
              <TechDetailsPanel 
                techId={selectedTech}
                currentPlayer={currentPlayer}
                techValidation={techValidation}
                onResearch={onResearchTech}
                onClose={() => setSelectedTech(null)}
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-amber-500/20">
          <div className="flex gap-2">
            <GlowingButton
              variant="outline"
              size="sm"
              glowColor="blue"
              onClick={() => setZoom(1)}
            >
              Reset Zoom
            </GlowingButton>
            <GlowingButton
              variant="outline"
              size="sm"
              glowColor="blue"
              onClick={() => setPosition({ x: 0, y: 0 })}
            >
              Center View
            </GlowingButton>
          </div>
          
          <div className="text-sm text-amber-300/70">
            Drag to pan • Pinch to zoom • Click tech for details
          </div>
        </div>
      </div>
    </PanelShell>
  );
}

const TechTree = React.memo(
  ({
    technologies,
    currentPlayer,
    techValidation,
    onSelectTech,
    selectedTech,
  }: {
    technologies: Record<string, Technology>;
    currentPlayer: PlayerState;
    techValidation: any;
    onSelectTech: (techId: string) => void;
    selectedTech: string | null;
  }) => {
    const coordinateMap = useMemo(() => {
      const entries: Record<string, NonNullable<ReturnType<typeof getTechCoordinates>>> = {};
      Object.keys(technologies).forEach(techId => {
        const coordinates = getTechCoordinates(techId);
        if (coordinates) {
          entries[techId] = coordinates;
        }
      });
      return entries;
    }, [technologies]);

    const missingTechIds = useMemo(() => {
      return Object.keys(technologies).filter(techId => !coordinateMap[techId]);
    }, [technologies, coordinateMap]);

    const isDevEnvironment =
      (typeof import.meta !== 'undefined' &&
        (import.meta as any).env &&
        typeof (import.meta as any).env.DEV !== 'undefined'
        ? Boolean((import.meta as any).env.DEV)
        : (typeof process !== 'undefined'
            ? process.env.NODE_ENV !== 'production'
            : false));

    useEffect(() => {
      if (missingTechIds.length > 0 && isDevEnvironment) {
      }
    }, [missingTechIds, isDevEnvironment]);

    const researchedSignature = currentPlayer.researchedTechs.join('|');
    const researchedSet = useMemo(
      () => new Set(currentPlayer.researchedTechs),
      [researchedSignature]
    );

    const techEntries = useMemo(() => {
      const entries: Array<{
        techId: string;
        tech: Technology;
        coords: NonNullable<ReturnType<typeof getTechCoordinates>>;
        cost: number;
        discount: number;
        baseCost: number;
        prerequisites: Array<{ id: string; name: string; satisfied: boolean }>;
        isResearched: boolean;
        canResearch: boolean;
        tierLabel: string;
      }> = [];

      for (const [techId, tech] of Object.entries(technologies)) {
        const coords = coordinateMap[techId];
        if (!coords) continue;

        const costDetails = getTechCostDetails(tech, currentPlayer);
        const prerequisites = tech.prerequisites.map(prereqId => ({
          id: prereqId,
          name: formatTechName(prereqId),
          satisfied: researchedSet.has(prereqId),
        }));

        entries.push({
          techId,
          tech,
          coords,
          cost: costDetails.finalCost,
          discount: costDetails.discount,
          baseCost: costDetails.baseCost,
          prerequisites,
          isResearched: researchedSet.has(techId),
          canResearch: techValidation.canResearch(techId),
          tierLabel: TECH_TIER_LABELS[coords.tier]?.short ?? `Tier ${coords.tier}`,
        });
      }

      return entries.sort((a, b) => {
        if (a.coords.column !== b.coords.column) {
          return a.coords.column - b.coords.column;
        }
        return a.coords.row - b.coords.row;
      });
    }, [technologies, coordinateMap, currentPlayer, techValidation, researchedSet]);

    const connectorPaths: React.ReactNode[] = [];
    techEntries.forEach(entry => {
      entry.tech.prerequisites.forEach(prereqId => {
        const source = coordinateMap[prereqId];
        if (!source) return;

        const startX = source.x + TECH_LAYOUT_CONSTANTS.nodeWidth;
        const startY = source.y + TECH_LAYOUT_CONSTANTS.nodeHeight / 2;
        const endX = entry.coords.x;
        const endY = entry.coords.y + TECH_LAYOUT_CONSTANTS.nodeHeight / 2;
        const midX = (startX + endX) / 2;

        const satisfied = researchedSet.has(prereqId);
        const targetStudied = researchedSet.has(entry.techId);
        const highlighted = selectedTech === entry.techId || selectedTech === prereqId;

        connectorPaths.push(
          <path
            key={`${prereqId}->${entry.techId}`}
            d={`M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`}
            stroke={
              targetStudied
                ? 'rgba(16, 185, 129, 0.75)'
                : satisfied
                ? 'rgba(251, 191, 36, 0.65)'
                : 'rgba(148, 163, 184, 0.35)'
            }
            strokeWidth={highlighted ? 3 : 2}
            strokeDasharray={satisfied ? '0' : '6 6'}
            fill="none"
            className="transition-all duration-200"
          />
        );
      });
    });

    const columnOffset = (TECH_LAYOUT_CONSTANTS.columnSpacing - TECH_LAYOUT_CONSTANTS.nodeWidth) / 2;

    return (
      <div
        className="relative"
        style={{ width: TECH_CANVAS_SIZE.width, height: TECH_CANVAS_SIZE.height }}
      >
        <div className="absolute inset-0 pointer-events-none z-0">
          {Object.entries(TECH_COLUMN_LABELS).map(([columnKey, label]) => {
            const columnIndex = Number(columnKey);
            const left =
              TECH_LAYOUT_CONSTANTS.originX +
              columnIndex * TECH_LAYOUT_CONSTANTS.columnSpacing -
              columnOffset;

            return (
              <div
                key={columnKey}
                className="absolute top-0 bottom-0 bg-amber-500/5 border-amber-500/10 rounded-xl"
                style={{
                  left,
                  width: TECH_LAYOUT_CONSTANTS.columnSpacing,
                  borderLeft: `1px solid rgba(251,191,36,0.12)`,
                  borderRight: `1px solid rgba(251,191,36,0.12)`,
                }}
              >
                <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
          viewBox={`0 0 ${TECH_CANVAS_SIZE.width} ${TECH_CANVAS_SIZE.height}`}
        >
          {connectorPaths}
        </svg>

        {missingTechIds.length > 0 && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-red-900/80 border border-red-400/60 text-xs text-red-100 shadow-lg z-30"
            role="status"
          >
            Missing layout entries for {missingTechIds.length} technology
            {missingTechIds.length === 1 ? '' : 'ies'}. Update `techLayout.ts` so every tech renders on
            the tree.
          </div>
        )}

        {techEntries.map(entry => (
          <TechNode
            key={entry.techId}
            techId={entry.techId}
            tech={entry.tech}
            isResearched={entry.isResearched}
            canResearch={entry.canResearch}
            isSelected={selectedTech === entry.techId}
            onClick={() => onSelectTech(entry.techId)}
            cost={entry.cost}
            baseCost={entry.baseCost}
            discount={entry.discount}
            prerequisites={entry.prerequisites}
            tierLabel={entry.tierLabel}
            style={{
              position: 'absolute',
              left: entry.coords.x,
              top: entry.coords.y,
              width: TECH_LAYOUT_CONSTANTS.nodeWidth,
              minHeight: TECH_LAYOUT_CONSTANTS.nodeHeight,
            }}
          />
        ))}
      </div>
    );
  }
);

const TechNode = React.memo(
  ({
    techId,
    tech,
    isResearched,
    canResearch,
    isSelected,
    onClick,
    cost,
    discount,
    baseCost,
    prerequisites,
    tierLabel,
    style,
  }: {
    techId: string;
    tech: Technology;
    isResearched: boolean;
    canResearch: boolean;
    isSelected: boolean;
    onClick: () => void;
    cost: number;
    discount: number;
    baseCost: number;
    discount: number;
    baseCost: number;
    prerequisites: Array<{ id: string; name: string; satisfied: boolean }>;
    tierLabel: string;
    style: React.CSSProperties;
  }) => (
    <div
      role="button"
      tabIndex={0}
      data-testid="tech-node"
      data-tech-id={techId}
      aria-pressed={isSelected}
      aria-disabled={!canResearch && !isResearched}
      onClick={onClick}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      style={{ ...style, zIndex: isSelected ? 25 : 20 }}
      className={`group relative rounded-xl border-2 p-4 cursor-pointer transition-all duration-200 backdrop-blur-sm ${
        isResearched
          ? 'bg-emerald-900/25 border-emerald-400/60 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
          : canResearch
          ? 'bg-amber-900/25 border-amber-400/60 hover:border-amber-300/80 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
          : 'bg-slate-800/30 border-slate-600/50 opacity-70'
      } ${isSelected ? 'ring-2 ring-amber-400 scale-[1.03]' : ''} focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300`}
    >
      <span className="absolute top-2 left-3 text-[10px] uppercase tracking-[0.25em] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/20 text-amber-200/80">
        {tierLabel}
      </span>

      <div className="absolute -top-2 -right-2">
        {isResearched ? (
          <CheckCircle className="w-6 h-6 text-emerald-400 bg-slate-900 rounded-full shadow-lg" />
        ) : !canResearch ? (
          <Lock className="w-5 h-5 text-slate-300 bg-slate-900/90 rounded-full p-1" />
        ) : null}
      </div>

      <h4 className="font-cinzel font-semibold text-amber-200 mb-2 text-sm pr-6">
        {tech.name}
      </h4>

      <p className="text-xs text-amber-200/70 line-clamp-3 leading-relaxed">
        {tech.description}
      </p>

      {prerequisites.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {prerequisites.map(prereq => (
            <span
              key={prereq.id}
              className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border transition-colors ${
                prereq.satisfied
                  ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-100'
                  : 'bg-slate-900/50 border-slate-500/50 text-slate-300'
              }`}
            >
              {prereq.name}
            </span>
          ))}
        </div>
      )}

      {!isResearched && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-center">
            <ResourceDeltaBadge value={cost} type="costStars" />
          </div>
          {discount > 0 && (
            <p className="text-[10px] text-emerald-200/70 text-center uppercase tracking-[0.2em]">
              -{discount} inspiration (base {baseCost})
            </p>
          )}
        </div>
      )}
    </div>
  )
);

const TechDetailsPanel = React.memo(({ techId, currentPlayer, techValidation, onResearch, onClose }: {
  techId: string;
  currentPlayer: PlayerState;
  techValidation: any;
  onResearch: (techId: string) => void;
  onClose: () => void;
}) => {
  const tech = getTechnology(techId as keyof typeof TECHNOLOGIES);
  if (!tech) return null;
  
  const coordinates = getTechCoordinates(techId);
  const tierLongLabel = coordinates ? TECH_TIER_LABELS[coordinates.tier]?.long : null;
  const isResearched = currentPlayer.researchedTechs.includes(techId);
  const canResearch = techValidation.canResearch(techId);
  const { baseCost, discount, finalCost } = getTechCostDetails(tech, currentPlayer);
  const prerequisites = tech.prerequisites.map(prereqId => ({
    id: prereqId,
    name: formatTechName(prereqId),
    satisfied: currentPlayer.researchedTechs.includes(prereqId),
  }));
  const unlockEntries = buildUnlockList(tech);
  const hasPrerequisitesMet = playerHasTechPrerequisites(currentPlayer, tech);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start gap-3">
        <div>
          {tierLongLabel && (
            <p className="text-[11px] uppercase tracking-[0.25em] text-amber-300/70 mb-1">
              {tierLongLabel}
            </p>
          )}
          <h3 className="font-cinzel font-bold text-amber-200 text-lg leading-tight">{tech.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-amber-300 hover:text-amber-100 transition-colors"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <p className="text-sm text-amber-300/80 leading-relaxed">
        {tech.description}
      </p>

      {prerequisites.length > 0 && (
        <div>
          <h4 className="font-cinzel font-semibold text-amber-200 mb-2">Prerequisites</h4>
          <ul className="space-y-1">
            {prerequisites.map(prereq => (
              <li
                key={prereq.id}
                className={`text-sm flex items-center gap-2 ${
                  prereq.satisfied ? 'text-emerald-200' : 'text-slate-300'
                }`}
              >
                {prereq.satisfied ? (
                  <CheckCircle className="w-3 h-3 text-emerald-300" />
                ) : (
                  <Lock className="w-3 h-3 text-slate-400" />
                )}
                {prereq.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {unlockEntries.length > 0 && (
        <div>
          <h4 className="font-cinzel font-semibold text-amber-200 mb-2">Unlocks:</h4>
          <ul className="space-y-1">
            {unlockEntries.map((entry, index) => (
              <li key={`${entry.category}-${index}`} className="text-sm text-amber-300/70 flex items-center gap-2">
                <CheckCircle className="w-3 h-3 text-green-400" />
                {entry.label} ({entry.category})
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {!isResearched && (
        <div className="space-y-3 pt-4 border-t border-amber-500/20">
          <div className="flex justify-between items-center">
            <span className="text-sm text-amber-300">Research Cost:</span>
            <div className="flex flex-col items-end gap-1">
              <ResourceDeltaBadge value={finalCost} type="costStars" />
              {discount > 0 && (
                <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-200/70">
                  Saved {discount} (base {baseCost})
                </span>
              )}
            </div>
          </div>
          
          <GlowingButton
            variant="default"
            className="w-full"
            glowColor="amber"
            intensity="high"
            disabled={!canResearch}
            onClick={() => onResearch(techId)}
            soundEffect="cta-click"
          >
            {canResearch ? `Research for ${finalCost} Stars` : 'Requirements Not Met'}
          </GlowingButton>
          
          {!canResearch && (
            <div className="text-xs text-red-300 bg-red-900/20 rounded px-3 py-2 border border-red-500/30">
              {hasPrerequisitesMet ? 'Insufficient stars for this technology.' : 'Prerequisites not met.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
