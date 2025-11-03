import React, { useMemo } from 'react';
import { Building, Users, Shield } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';

import { PanelShell } from '../primitives/PanelShell';
import { PanelHeader } from '../primitives/PanelHeader';
import { ResourceDeltaBadge } from '../ui/WorldElementPanel';

import { City } from '@shared/types/city';
import { GameState, PlayerState } from '@shared/types/game';
import { getCityValidation, CityValidation } from '../../selectors/city';

interface CityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  city: City;
  gameState: GameState;
  currentPlayer: PlayerState;
}

export function CityPanel({ isOpen, onClose, city, gameState, currentPlayer }: CityPanelProps) {
  // Calculate whether to hide panel (maintain stable hook order)
  const shouldHide = !isOpen || !city;
  
  const cityValidation = useMemo(() => 
    shouldHide ? null : getCityValidation(city, currentPlayer, gameState),
    [city, currentPlayer, gameState, shouldHide]
  );

  // Return null after hooks to maintain Rules of Hooks
  if (shouldHide) {
    return null;
  }

  return (
    <PanelShell 
      isOpen={isOpen} 
      onClose={onClose}
      size="xl"
      aria-labelledby="city-panel-title"
    >
      <PanelHeader
        icon={<Building className="w-5 h-5" />}
        title={city.name}
        description={`Population: ${city.population} • Level ${city.level}`}
        onClose={onClose}
      />

      <Tabs.Root defaultValue="overview" className="w-full">
        <Tabs.List className="grid w-full grid-cols-3 rounded-lg bg-slate-800/50 p-1 mb-6">
          <Tabs.Trigger 
            value="overview" 
            className="rounded-md px-3 py-2 text-sm font-medium text-amber-300/70 
                       transition-all hover:text-amber-200 data-[state=active]:bg-amber-600/20 
                       data-[state=active]:text-amber-100 data-[state=active]:shadow-sm"
          >
            <Users className="w-4 h-4 mr-2" />
            Overview
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="structures"
            className="rounded-md px-3 py-2 text-sm font-medium text-amber-300/70 
                       transition-all hover:text-amber-200 data-[state=active]:bg-amber-600/20 
                       data-[state=active]:text-amber-100 data-[state=active]:shadow-sm"
          >
            <Building className="w-4 h-4 mr-2" />
            Buildings
          </Tabs.Trigger>
          <Tabs.Trigger 
            value="military"
            className="rounded-md px-3 py-2 text-sm font-medium text-amber-300/70 
                       transition-all hover:text-amber-200 data-[state=active]:bg-amber-600/20 
                       data-[state=active]:text-amber-100 data-[state=active]:shadow-sm"
          >
            <Shield className="w-4 h-4 mr-2" />
            Military
          </Tabs.Trigger>
        </Tabs.List>

        <div className="max-h-[calc(90vh-200px)] overflow-y-auto">
          <Tabs.Content value="overview" className="space-y-4">
            <CityOverviewTab city={city} gameState={gameState} />
          </Tabs.Content>
          
          <Tabs.Content value="structures" className="space-y-4">
            <CityStructuresTab 
              city={city} 
              cityValidation={cityValidation}
              currentPlayer={currentPlayer}
            />
          </Tabs.Content>
          
          <Tabs.Content value="military" className="space-y-4">
            <CityMilitaryTab 
              city={city}
              cityValidation={cityValidation}
              currentPlayer={currentPlayer}
            />
          </Tabs.Content>
        </div>
      </Tabs.Root>
    </PanelShell>
  );
}

// Memoized tab components
const CityOverviewTab = React.memo(({ city, gameState }: {
  city: City;
  gameState: GameState;
}) => (
  <div className="grid gap-4 md:grid-cols-2">
    <div className="rounded-lg bg-slate-800/30 p-4 border border-amber-500/20">
      <h3 className="font-cinzel font-semibold text-amber-200 mb-3">City Stats</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-amber-300/80">Population:</span>
          <ResourceDeltaBadge value={city.population} type="population" />
        </div>
        <div className="flex justify-between">
          <span className="text-amber-300/80">Star Production:</span>
          <ResourceDeltaBadge value={city.population} type="stars" />
        </div>
        <div className="flex justify-between">
          <span className="text-amber-300/80">Level:</span>
          <span className="text-amber-100">{city.level}</span>
        </div>
      </div>
    </div>
    
    <div className="rounded-lg bg-slate-800/30 p-4 border border-amber-500/20">
      <h3 className="font-cinzel font-semibold text-amber-200 mb-3">Territory</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-amber-300/80">Controlled Tiles:</span>
          <span className="text-amber-100">-</span>
        </div>
        <div className="flex justify-between">
          <span className="text-amber-300/80">Resources:</span>
          <span className="text-amber-100">3 active</span>
        </div>
      </div>
    </div>
  </div>
));

const CityStructuresTab = React.memo(({ city, cityValidation, currentPlayer }: {
  city: City;
  cityValidation: CityValidation;
  currentPlayer: PlayerState;
}) => {
  const availableStructures = cityValidation.getAvailableStructures();
  
  return (
    <div className="space-y-4">
      <h3 className="font-cinzel font-semibold text-amber-200">Available Structures</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {availableStructures.map(structureId => (
          <StructureCard 
            key={structureId}
            structureId={structureId}
            canAfford={cityValidation.canAffordStructure(structureId)}
            hasPrerequisites={cityValidation.hasStructurePrerequisites(structureId)}
            currentPlayer={currentPlayer}
          />
        ))}
      </div>
    </div>
  );
});

const CityMilitaryTab = React.memo(({ city, cityValidation, currentPlayer }: {
  city: City;
  cityValidation: CityValidation;
  currentPlayer: PlayerState;
}) => (
  <div className="space-y-4">
    <h3 className="font-cinzel font-semibold text-amber-200">Military Units</h3>
    <div className="grid gap-3 md:grid-cols-2">
      <UnitCard 
        name="Warrior"
        cost={5}
        stats={{ attack: 2, defense: 2, health: 10 }}
        canAfford={currentPlayer.stars >= 5}
        hasPrerequisites={true}
        description="Basic melee infantry"
      />
      <UnitCard 
        name="Scout"
        cost={3}
        stats={{ attack: 1, defense: 1, health: 8 }}
        canAfford={currentPlayer.stars >= 3}
        hasPrerequisites={true}
        description="Fast reconnaissance unit"
      />
    </div>
  </div>
));

// Reusable card components following the design system
const StructureCard = React.memo(({ structureId, canAfford, hasPrerequisites, currentPlayer }: {
  structureId: string;
  canAfford: boolean;
  hasPrerequisites: boolean;
  currentPlayer: PlayerState;
}) => {
  // Structure definitions lookup (simplified for demo)
  const structureData = {
    temple: { name: 'Temple', cost: 15, effects: [{ type: 'faith', value: 2 }], description: 'Increases faith generation' },
    market: { name: 'Market', cost: 10, effects: [{ type: 'stars', value: 2 }], description: 'Boosts economic output' },
    barracks: { name: 'Barracks', cost: 12, effects: [{ type: 'military', value: 1 }], description: 'Trains military units' }
  }[structureId] || { name: structureId, cost: 10, effects: [], description: 'Unknown structure' };
  
  return (
    <div className={`rounded-lg border p-4 transition-all ${
      canAfford && hasPrerequisites
        ? 'bg-slate-800/40 border-amber-500/30 hover:border-amber-400/50'
        : 'bg-slate-800/20 border-slate-600/30 opacity-60'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-cinzel font-semibold text-amber-200">{structureData.name}</h4>
        <ResourceDeltaBadge value={structureData.cost} type="costStars" />
      </div>
      <p className="text-xs text-amber-300/70 mb-3">{structureData.description}</p>
      <div className="flex gap-2">
        {structureData.effects.map((effect, index) => (
          <ResourceDeltaBadge 
            key={index} 
            value={effect.value} 
            type={effect.type as any} 
          />
        ))}
      </div>
      {!canAfford && (
        <div className="mt-2 text-xs text-red-300 bg-red-900/20 rounded px-2 py-1 border border-red-500/30">
          Insufficient stars ({currentPlayer.stars}/{structureData.cost})
        </div>
      )}
      {!hasPrerequisites && (
        <div className="mt-2 text-xs text-orange-300 bg-orange-900/20 rounded px-2 py-1 border border-orange-500/30">
          Prerequisites not met
        </div>
      )}
    </div>
  );
});

const UnitCard = React.memo(({ name, cost, stats, canAfford, hasPrerequisites, description }: {
  name: string;
  cost: number;
  stats: { attack: number; defense: number; health: number };
  canAfford: boolean;
  hasPrerequisites: boolean;
  description: string;
}) => (
  <div className={`rounded-lg border p-4 transition-all ${
    canAfford && hasPrerequisites
      ? 'bg-slate-800/40 border-amber-500/30 hover:border-amber-400/50'
      : 'bg-slate-800/20 border-slate-600/30 opacity-60'
  }`}>
    <div className="flex justify-between items-start mb-2">
      <h4 className="font-cinzel font-semibold text-amber-200">{name}</h4>
      <ResourceDeltaBadge value={cost} type="costStars" />
    </div>
    <p className="text-xs text-amber-300/70 mb-3">{description}</p>
    <div className="grid grid-cols-3 gap-2 text-xs">
      <div className="text-center">
        <div className="text-red-300 font-semibold">{stats.attack}</div>
        <div className="text-amber-300/60">ATK</div>
      </div>
      <div className="text-center">
        <div className="text-blue-300 font-semibold">{stats.defense}</div>
        <div className="text-amber-300/60">DEF</div>
      </div>
      <div className="text-center">
        <div className="text-green-300 font-semibold">{stats.health}</div>
        <div className="text-amber-300/60">HP</div>
      </div>
    </div>
    {!canAfford && (
      <div className="mt-2 text-xs text-red-300 bg-red-900/20 rounded px-2 py-1 border border-red-500/30">
        Insufficient stars
      </div>
    )}
  </div>
));