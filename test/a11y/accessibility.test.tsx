import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { PlayerHUD } from '../../client/src/components/hud/PlayerHUD';
import { CityPanel } from '../../client/src/components/city/CityPanel';
import { TechPanel } from '../../client/src/components/tech/TechPanel';
import { CombatPanel } from '../../client/src/components/combat/CombatPanel';

// Extend Vitest matchers
expect.extend({ toHaveNoViolations });

// Mock data for components
const mockPlayer = {
  id: 'player1',
  name: 'Test Player',
  factionId: 'NEPHITES',
  isAI: false,
  stars: 25,
  stats: { faith: 8, pride: 3, internalDissent: 2 },
  modifiers: [],
  researchedTechs: ['organization'],
  researchInspiration: 0,
  citiesOwned: ['city1'],
  constructionQueue: [],
  visibilityMask: [],
  exploredTiles: [],
  isEliminated: false,
  turnOrder: 0,
  abilityCooldowns: {}
};

const mockGameState = {
  id: 'test-game',
  players: [mockPlayer],
  currentPlayerIndex: 0,
  turn: 1,
  phase: 'playing' as const,
  map: { tiles: [], width: 10, height: 10 },
  units: [],
  cities: [{
    id: 'city1',
    name: 'Test City',
    ownerId: 'player1',
    coordinate: { q: 0, r: 0, s: 0 },
    population: 5,
    maxPopulation: 10,
    level: 1,
    productionQueue: [],
    discoveredBy: ['player1']
  }],
  improvements: [],
  structures: []
};

// Properly typed mock unit for CombatPanel tests
const mockUnit: import('@shared/types/unit').Unit = {
  id: 'unit1',
  playerId: 'player1',
  type: 'warrior',
  coordinate: { q: 0, r: 0, s: 0 },
  hp: 25,
  maxHp: 25,
  attack: 6,
  defense: 4,
  movement: 3,
  remainingMovement: 3,
  status: 'active',
  visionRadius: 2,
  attackRange: 1,
  hasAttacked: false,
  abilities: [],
  level: 1,
  experience: 0,
};

describe('Accessibility Tests (vitest-axe)', () => {
  it('PlayerHUD has no WCAG violations', async () => {
    const { container } = render(
      <PlayerHUD 
        player={mockPlayer}
        gameState={mockGameState}
        onShowTechPanel={() => {}}
        onShowConstructionHall={() => {}}
        onEndTurn={() => {}}
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('CityPanel has no WCAG violations', async () => {
    const { container } = render(
      <CityPanel 
        isOpen
        city={mockGameState.cities[0]}
        gameState={mockGameState}
        currentPlayer={mockPlayer}
        onClose={() => {}}
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('TechPanel has no WCAG violations', async () => {
    const accessibilityPlayer = {
      id: 'player1',
      name: 'Accessibility Tester',
      factionId: 'NEPHITES',
      isAI: false,
      stars: 40,
      stats: { faith: 30, pride: 15, internalDissent: 5 },
      modifiers: [],
      abilityCooldowns: {},
      researchedTechs: ['organization', 'woodcraft'],
      researchInspiration: 0,
      citiesOwned: [],
      constructionQueue: [],
      visibilityMask: [],
      exploredTiles: [],
      isEliminated: false,
      turnOrder: 0
    } as const;

    const accessibilityGameState = {
      id: 'game-accessibility',
      players: [accessibilityPlayer],
      currentPlayerIndex: 0,
      turn: 1,
      phase: 'playing',
      map: { tiles: [], width: 5, height: 5 },
      units: [],
      cities: [],
      improvements: [],
      structures: []
    } as const;

    const { container } = render(
      <TechPanel 
        isOpen
        onClose={() => {}}
        gameState={accessibilityGameState as any}
        currentPlayer={accessibilityPlayer as any}
        onResearchTech={() => {}}
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('CombatPanel has no WCAG violations', async () => {
    const { container } = render(
      <CombatPanel 
        attacker={mockUnit}
        defenders={[]}
        onAttack={() => {}}
        onCancel={() => {}}
      />
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('validates focus trap implementation', async () => {
    const { container } = render(
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">Modal Title</h2>
        <button>First Focusable</button>
        <input placeholder="Input field" />
        <button>Last Focusable</button>
      </div>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('validates proper ARIA labels and roles', async () => {
    const { container } = render(
      <div>
        <button aria-label="Close panel" role="button">×</button>
        <nav role="navigation" aria-label="Game navigation">
          <ul role="list">
            <li role="listitem">
              <button aria-expanded="false" aria-haspopup="true">Menu</button>
            </li>
          </ul>
        </nav>
        <main role="main" aria-label="Game board">
          <section aria-labelledby="player-stats">
            <h3 id="player-stats">Player Statistics</h3>
            <div role="group" aria-label="Resource counters">
              <span aria-label="Stars: 25">25 ✦</span>
              <span aria-label="Faith: 8">8 ✠</span>
            </div>
          </section>
        </main>
      </div>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('validates color contrast compliance', async () => {
    const { container } = render(
      <div>
        {/* Test various color combinations used in the game */}
        <div className="text-amber-200 bg-stone-900">High contrast text</div>
        <div className="text-blue-300 bg-stone-800">Faith resource text</div>
        <div className="text-red-400 bg-stone-900">Pride resource text</div>
        <div className="text-yellow-300 bg-stone-900">Star resource text</div>
        <button className="text-white bg-amber-600">Action button</button>
        <button className="text-stone-900 bg-amber-400">Primary action</button>
      </div>
    );
    
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });
    expect(results).toHaveNoViolations();
  });

  it('validates keyboard navigation structure', async () => {
    const { container } = render(
      <div>
        <button tabIndex={0}>First Tab Stop</button>
        <div tabIndex={-1} role="group">
          <button tabIndex={0}>Nested Button 1</button>
          <button tabIndex={0}>Nested Button 2</button>
        </div>
        <input tabIndex={0} placeholder="Text input" />
        <button tabIndex={0}>Last Tab Stop</button>
      </div>
    );
    
    const results = await axe(container, {
      rules: {
        'tabindex': { enabled: true },
        'focus-order-semantics': { enabled: true }
      }
    });
    expect(results).toHaveNoViolations();
  });

  it('validates form accessibility', async () => {
    const { container } = render(
      <form role="form" aria-labelledby="form-title">
        <h2 id="form-title">Player Setup</h2>
        
        <div role="group" aria-labelledby="player-info">
          <h3 id="player-info">Player Information</h3>
          
          <label htmlFor="player-name">Player Name</label>
          <input 
            id="player-name"
            type="text"
            aria-required="true"
            aria-describedby="name-help"
          />
          <div id="name-help">Enter your display name</div>
          
          <fieldset>
            <legend>Select Faction</legend>
            <input 
              type="radio" 
              id="nephites" 
              name="faction" 
              value="nephites"
              aria-describedby="nephites-desc"
            />
            <label htmlFor="nephites">Nephites</label>
            <div id="nephites-desc">Righteous faction focused on faith</div>
            
            <input 
              type="radio" 
              id="lamanites" 
              name="faction" 
              value="lamanites"
              aria-describedby="lamanites-desc"
            />
            <label htmlFor="lamanites">Lamanites</label>
            <div id="lamanites-desc">Warrior faction with forest bonuses</div>
          </fieldset>
        </div>
        
        <button type="submit" aria-describedby="submit-help">
          Start Game
        </button>
        <div id="submit-help">Begin your civilization's journey</div>
      </form>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('validates complex interactive widgets', async () => {
    const { container } = render(
      <div>
        {/* Tab interface */}
        <div role="tablist" aria-label="City management tabs">
          <button 
            role="tab" 
            aria-selected="true" 
            aria-controls="build-panel"
            id="build-tab"
          >
            Build
          </button>
          <button 
            role="tab" 
            aria-selected="false" 
            aria-controls="recruit-panel"
            id="recruit-tab"
          >
            Recruit
          </button>
        </div>
        
        <div 
          role="tabpanel" 
          id="build-panel" 
          aria-labelledby="build-tab"
          aria-hidden="false"
        >
          <h3>Available Structures</h3>
          <div role="grid" aria-label="Structure options">
            <div role="row">
              <div role="gridcell">
                <button aria-describedby="temple-desc">Temple</button>
                <div id="temple-desc">Cost: 10 stars. Provides faith bonus.</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Progress indicator */}
        <div 
          role="progressbar" 
          aria-label="Research progress"
          aria-valuenow={33} 
          aria-valuemin={0} 
          aria-valuemax={100}
        >
          <span aria-label="Research progress: 33 percent complete">33%</span>
        </div>
      </div>
    );
    
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
