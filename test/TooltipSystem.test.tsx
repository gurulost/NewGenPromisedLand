import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tooltip, ActionTooltip, InfoTooltip } from '../client/src/components/ui/TooltipSystem';

// Mock Radix UI Tooltip
vi.mock('@radix-ui/react-tooltip', () => ({
  Provider: ({ children }: any) => children,
  Root: ({ children }: any) => children,
  Trigger: ({ children, asChild, ...props }: any) => 
    asChild ? children : <button {...props}>{children}</button>,
  Portal: ({ children }: any) => children,
  Content: ({ children, className, ...props }: any) => (
    <div className={className} data-testid="tooltip-content" {...props}>
      {children}
    </div>
  )
}));

describe('TooltipSystem Components', () => {
  describe('Tooltip Component', () => {
    it('renders trigger element', () => {
      render(
        <Tooltip content="Test tooltip">
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.getByText('Hover me')).toBeInTheDocument();
    });

    it('displays tooltip content', () => {
      render(
        <Tooltip content="Test tooltip">
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
      expect(screen.getByText('Test tooltip')).toBeInTheDocument();
    });

    it('supports custom delay', () => {
      render(
        <Tooltip content="Test tooltip" delay={500}>
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.getByText('Test tooltip')).toBeInTheDocument();
    });

    it('supports different sides', () => {
      const { rerender } = render(
        <Tooltip content="Test tooltip" side="top">
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();

      rerender(
        <Tooltip content="Test tooltip" side="bottom">
          <button>Hover me</button>
        </Tooltip>
      );

      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
    });

    it('can be disabled', () => {
      render(
        <Tooltip content="Test tooltip" disabled>
          <button>Hover me</button>
        </Tooltip>
      );

      // When disabled, tooltip content should not be rendered
      expect(screen.queryByTestId('tooltip-content')).not.toBeInTheDocument();
    });
  });

  describe('ActionTooltip Component', () => {
    it('renders with title and description', () => {
      render(
        <ActionTooltip
          title="Test Action"
          description="This is a test action description"
        />
      );

      expect(screen.getByText('Test Action')).toBeInTheDocument();
      expect(screen.getByText('This is a test action description')).toBeInTheDocument();
    });

    it('displays cost information', () => {
      render(
        <ActionTooltip
          title="Build Structure"
          description="Build a new structure"
          cost="10 stars, 5 faith"
        />
      );

      expect(screen.getByText('Build Structure')).toBeInTheDocument();
      expect(screen.getByText('Build a new structure')).toBeInTheDocument();
      expect(screen.getByText('10 stars, 5 faith')).toBeInTheDocument();
    });

    it('shows hotkey information', () => {
      render(
        <ActionTooltip
          title="Build Structure"
          description="Build a new structure"
          hotkey="B"
        />
      );

      expect(screen.getByText('Build Structure')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('displays requirements', () => {
      render(
        <ActionTooltip
          title="Build Temple"
          description="Build a sacred temple"
          requirements={['Writing technology', '20 faith']}
        />
      );

      expect(screen.getByText('Build Temple')).toBeInTheDocument();
      expect(screen.getByText('Writing technology')).toBeInTheDocument();
      expect(screen.getByText('20 faith')).toBeInTheDocument();
    });

    it('shows effects', () => {
      render(
        <ActionTooltip
          title="Build Farm"
          description="Build a farm for food production"
          effects={['+2 stars per turn', '+1 population growth']}
        />
      );

      expect(screen.getByText('Build Farm')).toBeInTheDocument();
      expect(screen.getByText('+2 stars per turn')).toBeInTheDocument();
      expect(screen.getByText('+1 population growth')).toBeInTheDocument();
    });

    it('renders with all props combined', () => {
      render(
        <ActionTooltip
          title="Advanced Structure"
          description="A complex building with multiple effects"
          cost="50 stars, 30 faith"
          hotkey="Ctrl+B"
          requirements={['Advanced Technology', 'City Level 3']}
          effects={['+5 stars per turn', '+3 defense', 'Unlocks special units']}
        />
      );

      expect(screen.getByText('Advanced Structure')).toBeInTheDocument();
      expect(screen.getByText('A complex building with multiple effects')).toBeInTheDocument();
      expect(screen.getByText('50 stars, 30 faith')).toBeInTheDocument();
      expect(screen.getByText('Ctrl+B')).toBeInTheDocument();
      expect(screen.getByText('Advanced Technology')).toBeInTheDocument();
      expect(screen.getByText('City Level 3')).toBeInTheDocument();
      expect(screen.getByText('+5 stars per turn')).toBeInTheDocument();
      expect(screen.getByText('+3 defense')).toBeInTheDocument();
      expect(screen.getByText('Unlocks special units')).toBeInTheDocument();
    });
  });

  describe('InfoTooltip Component', () => {
    it('renders with title and content', () => {
      render(
        <InfoTooltip
          title="Game Mechanic"
          content="This explains how the game mechanic works"
        />
      );

      expect(screen.getByText('Game Mechanic')).toBeInTheDocument();
      expect(screen.getByText('This explains how the game mechanic works')).toBeInTheDocument();
    });

    it('displays additional details', () => {
      render(
        <InfoTooltip
          title="Faith System"
          content="Faith is used for religious actions and abilities"
          details={['Generated by temples', 'Used for conversion', 'Required for some units']}
        />
      );

      expect(screen.getByText('Faith System')).toBeInTheDocument();
      expect(screen.getByText('Faith is used for religious actions and abilities')).toBeInTheDocument();
      expect(screen.getByText('Generated by temples')).toBeInTheDocument();
      expect(screen.getByText('Used for conversion')).toBeInTheDocument();
      expect(screen.getByText('Required for some units')).toBeInTheDocument();
    });

    it('shows formula when provided', () => {
      render(
        <InfoTooltip
          title="Combat Calculation"
          content="How combat damage is calculated"
          formula="Damage = (Attack - Defense) * Modifiers"
        />
      );

      expect(screen.getByText('Combat Calculation')).toBeInTheDocument();
      expect(screen.getByText('How combat damage is calculated')).toBeInTheDocument();
      expect(screen.getByText('Damage = (Attack - Defense) * Modifiers')).toBeInTheDocument();
    });

    it('renders with all props', () => {
      render(
        <InfoTooltip
          title="Complex System"
          content="A complex game system with multiple aspects"
          details={['Detail 1', 'Detail 2', 'Detail 3']}
          formula="Result = Input * Multiplier + Base"
        />
      );

      expect(screen.getByText('Complex System')).toBeInTheDocument();
      expect(screen.getByText('A complex game system with multiple aspects')).toBeInTheDocument();
      expect(screen.getByText('Detail 1')).toBeInTheDocument();
      expect(screen.getByText('Detail 2')).toBeInTheDocument();
      expect(screen.getByText('Detail 3')).toBeInTheDocument();
      expect(screen.getByText('Result = Input * Multiplier + Base')).toBeInTheDocument();
    });
  });

  describe('Tooltip Integration', () => {
    it('ActionTooltip works within Tooltip wrapper', () => {
      render(
        <Tooltip
          content={
            <ActionTooltip
              title="Integrated Action"
              description="This action is inside a tooltip"
              cost="25 stars"
            />
          }
        >
          <button>Action Button</button>
        </Tooltip>
      );

      expect(screen.getByText('Action Button')).toBeInTheDocument();
      expect(screen.getByText('Integrated Action')).toBeInTheDocument();
      expect(screen.getByText('This action is inside a tooltip')).toBeInTheDocument();
      expect(screen.getByText('25 stars')).toBeInTheDocument();
    });

    it('InfoTooltip works within Tooltip wrapper', () => {
      render(
        <Tooltip
          content={
            <InfoTooltip
              title="Integrated Info"
              content="This information is inside a tooltip"
              details={['Detail A', 'Detail B']}
            />
          }
        >
          <button>Info Button</button>
        </Tooltip>
      );

      expect(screen.getByText('Info Button')).toBeInTheDocument();
      expect(screen.getByText('Integrated Info')).toBeInTheDocument();
      expect(screen.getByText('This information is inside a tooltip')).toBeInTheDocument();
      expect(screen.getByText('Detail A')).toBeInTheDocument();
      expect(screen.getByText('Detail B')).toBeInTheDocument();
    });
  });
});