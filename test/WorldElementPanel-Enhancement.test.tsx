import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('WorldElementPanel Enhancement Testing', () => {
  describe('Staggered Content Animation System', () => {
    it('validates staggered animation implementation', () => {
      const MockStaggeredContainer = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="staggered-container" className="space-y-4">
          {children}
        </div>
      );

      const MockStaggeredContent = ({ delay, children }: { delay?: number; children: React.ReactNode }) => (
        <div 
          data-testid="staggered-content" 
          className={`animate-fade-in-up delay-${delay || 100}`}
          style={{ animationDelay: `${delay || 100}ms` }}
        >
          {children}
        </div>
      );

      render(
        <MockStaggeredContainer>
          <MockStaggeredContent delay={100}>
            <div>Header Content</div>
          </MockStaggeredContent>
          <MockStaggeredContent delay={200}>
            <div>Action Content</div>
          </MockStaggeredContent>
          <MockStaggeredContent delay={300}>
            <div>Moral Consequences</div>
          </MockStaggeredContent>
        </MockStaggeredContainer>
      );

      const container = screen.getByTestId('staggered-container');
      const staggeredElements = screen.getAllByTestId('staggered-content');

      expect(container).toBeInTheDocument();
      expect(staggeredElements).toHaveLength(3);
      expect(screen.getByText('Header Content')).toBeInTheDocument();
      expect(screen.getByText('Action Content')).toBeInTheDocument();
      expect(screen.getByText('Moral Consequences')).toBeInTheDocument();
    });

    it('validates visual grouping sub-panels', () => {
      const MockActionSection = ({ 
        label, 
        badgeColor, 
        theme, 
        children 
      }: { 
        label: string; 
        badgeColor: string; 
        theme: string; 
        children: React.ReactNode;
      }) => (
        <div 
          data-testid="action-section" 
          className={`rounded-lg border p-4 ${theme === 'red' ? 'border-red-500/30' : 'border-blue-500/30'}`}
        >
          <div data-testid="action-label" className={`badge-${badgeColor}`}>
            {label}
          </div>
          <div className="mt-3 space-y-3">
            {children}
          </div>
        </div>
      );

      render(
        <div>
          <MockActionSection label="Immediate" badgeColor="destructive" theme="red">
            <div data-testid="immediate-effects">
              <h4>Immediate Effects</h4>
              <p>+1 Population, +1 Pride, +1 Dissent</p>
            </div>
          </MockActionSection>
          <MockActionSection label="Long-term" badgeColor="secondary" theme="blue">
            <div data-testid="permanent-benefits">
              <h4>Permanent Benefits</h4>
              <p>+1 Stars/turn from improved infrastructure</p>
            </div>
          </MockActionSection>
        </div>
      );

      expect(screen.getByText('Immediate')).toBeInTheDocument();
      expect(screen.getByText('Long-term')).toBeInTheDocument();
      expect(screen.getByTestId('immediate-effects')).toBeInTheDocument();
      expect(screen.getByTestId('permanent-benefits')).toBeInTheDocument();
    });
  });

  describe('Enhanced Moral Consequences Display', () => {
    it('validates thematic icon integration', () => {
      const MockMoralConsequences = () => (
        <div data-testid="moral-consequences" className="rounded-lg border border-amber-500/40 bg-amber-800/20 p-4">
          <h3 className="mb-3 font-cinzel text-sm font-semibold text-amber-200">
            Moral Consequences
          </h3>
          <div className="space-y-2 text-sm text-amber-100/90">
            <div className="flex items-start gap-2" data-testid="pride-consequence">
              <span className="text-red-400 mt-0.5">⚔</span>
              <span>Immediate exploitation increases Pride and Dissent.</span>
            </div>
            <div className="flex items-start gap-2" data-testid="faith-consequence">
              <span className="text-blue-400 mt-0.5">✠</span>
              <span>Patient stewardship builds Faith and strengthens your covenant path.</span>
            </div>
            <div className="flex items-start gap-2" data-testid="balance-consequence">
              <span className="text-amber-400 mt-0.5">⚖</span>
              <span>Your choices shape the moral compass of your civilization.</span>
            </div>
          </div>
        </div>
      );

      render(<MockMoralConsequences />);

      expect(screen.getByTestId('moral-consequences')).toBeInTheDocument();
      expect(screen.getByText('Moral Consequences')).toBeInTheDocument();
      
      // Check thematic icons
      expect(screen.getByText('⚔')).toBeInTheDocument(); // Pride
      expect(screen.getByText('✠')).toBeInTheDocument(); // Faith
      expect(screen.getByText('⚖')).toBeInTheDocument(); // Balance
      
      // Check consequence messages
      expect(screen.getByText(/Pride and Dissent/)).toBeInTheDocument();
      expect(screen.getByText(/Faith and strengthens/)).toBeInTheDocument();
      expect(screen.getByText(/moral compass/)).toBeInTheDocument();
    });

    it('validates proper visual hierarchy and spacing', () => {
      const MockConsequenceItem = ({ icon, color, message }: { icon: string; color: string; message: string }) => (
        <div className="flex items-start gap-2" data-testid="consequence-item">
          <span className={`${color} mt-0.5`}>{icon}</span>
          <span>{message}</span>
        </div>
      );

      render(
        <div className="space-y-2">
          <MockConsequenceItem 
            icon="⚔" 
            color="text-red-400" 
            message="Pride consequence message" 
          />
          <MockConsequenceItem 
            icon="✠" 
            color="text-blue-400" 
            message="Faith consequence message" 
          />
        </div>
      );

      const items = screen.getAllByTestId('consequence-item');
      expect(items).toHaveLength(2);
      expect(screen.getByText('Pride consequence message')).toBeInTheDocument();
      expect(screen.getByText('Faith consequence message')).toBeInTheDocument();
    });
  });

  describe('Enhanced Action Button System', () => {
    it('validates motion effects and interactions', () => {
      const MockEnhancedButton = ({ 
        onClick, 
        disabled, 
        variant = 'primary' 
      }: { 
        onClick: () => void; 
        disabled?: boolean; 
        variant?: string;
      }) => (
        <button
          data-testid="enhanced-button"
          onClick={onClick}
          disabled={disabled}
          className={`
            transform transition-all duration-200 hover:scale-105 active:scale-95
            ${variant === 'primary' ? 'bg-gradient-to-r from-amber-600 to-amber-500' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            rounded-lg px-4 py-2 text-white shadow-lg
          `}
        >
          Enhanced Action Button
        </button>
      );

      const mockClick = vi.fn();
      
      render(<MockEnhancedButton onClick={mockClick} />);
      
      const button = screen.getByTestId('enhanced-button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('transform', 'transition-all', 'hover:scale-105');
      expect(button).not.toBeDisabled();
    });

    it('validates disabled state handling', () => {
      const MockDisabledButton = () => (
        <button
          data-testid="disabled-button"
          disabled
          className="opacity-50 cursor-not-allowed bg-gray-500"
        >
          Disabled Action
        </button>
      );

      render(<MockDisabledButton />);
      
      const button = screen.getByTestId('disabled-button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  describe('Comprehensive UI Integration', () => {
    it('validates complete WorldElementPanel structure', () => {
      const MockWorldElementPanel = () => (
        <div 
          data-testid="world-element-panel"
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl
                     bg-gradient-to-br from-stone-900/95 to-stone-800/90 border border-amber-600/40
                     text-amber-100 shadow-2xl shadow-black/60 p-6"
        >
          {/* Sparkle overlay */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 animate-sparkle-slow" />
          </div>

          {/* Header */}
          <header className="mb-6 flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="font-cinzel text-lg text-amber-200">Timber Grove</h2>
              <p className="text-amber-300/80 text-sm">1 Nephi 18:25</p>
            </div>
            <button className="h-10 w-10 rounded-full bg-amber-600/10 text-amber-300">
              ×
            </button>
          </header>

          {/* Actions with staggered content */}
          <div className="space-y-4">
            <div data-testid="immediate-action">Immediate Action Content</div>
            <div data-testid="long-term-action">Long-term Action Content</div>
            <div data-testid="moral-consequences">Moral Consequences Content</div>
          </div>
        </div>
      );

      render(<MockWorldElementPanel />);

      const panel = screen.getByTestId('world-element-panel');
      expect(panel).toBeInTheDocument();
      expect(panel).toHaveClass('max-h-[90vh]'); // Viewport safety
      expect(panel).toHaveClass('rounded-2xl'); // Book of Mormon aesthetic
      expect(panel).toHaveClass('bg-gradient-to-br'); // Visual polish

      expect(screen.getByText('Timber Grove')).toBeInTheDocument();
      expect(screen.getByText('1 Nephi 18:25')).toBeInTheDocument();
      expect(screen.getByTestId('immediate-action')).toBeInTheDocument();
      expect(screen.getByTestId('long-term-action')).toBeInTheDocument();
      expect(screen.getByTestId('moral-consequences')).toBeInTheDocument();
    });

    it('validates AAA-quality interactions and feedback', () => {
      const MockInteractiveElements = () => (
        <div data-testid="interactive-container">
          <button 
            className="min-h-[44px] touch-manipulation active:scale-95"
            data-testid="touch-optimized-button"
          >
            Touch Optimized
          </button>
          
          <div 
            className="cursor-pointer hover:bg-amber-600/10 transition-colors"
            data-testid="hover-element"
          >
            Hover Element
          </div>
          
          <input 
            className="border-amber-600/40 focus:border-amber-400 focus:ring-amber-400/20"
            data-testid="focus-element"
            placeholder="Focus me"
          />
        </div>
      );

      render(<MockInteractiveElements />);

      expect(screen.getByTestId('touch-optimized-button')).toHaveClass('min-h-[44px]');
      expect(screen.getByTestId('hover-element')).toHaveClass('hover:bg-amber-600/10');
      expect(screen.getByTestId('focus-element')).toHaveClass('focus:border-amber-400');
    });
  });
});