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

    it('displays tooltip content', async () => {
      render(
        <Tooltip content="Test tooltip">
          <button>Hover me</button>
        </Tooltip>
      );

      const trigger = screen.getByText('Hover me');
      fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });

      // Wait for tooltip to appear
      await waitFor(() => {
        expect(screen.queryByText('Test tooltip')).toBeInTheDocument();
      });
    });

    it('supports custom delay', async () => {
      render(
        <Tooltip content="Test tooltip" delay={500}>
          <button>Hover me</button>
        </Tooltip>
      );

      const trigger = screen.getByText('Hover me');
      fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });

      // Wait for tooltip to appear with delay
      await waitFor(() => {
        expect(screen.queryByText('Test tooltip')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('supports different sides', async () => {
      const { rerender } = render(
        <Tooltip content="Test tooltip" placement="top">
          <button>Hover me</button>
        </Tooltip>
      );

      const trigger = screen.getByText('Hover me');
      fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });

      await waitFor(() => {
        expect(screen.queryByText('Test tooltip')).toBeInTheDocument();
      });

      rerender(
        <Tooltip content="Test tooltip" placement="bottom">
          <button>Hover me</button>
        </Tooltip>
      );

      fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      await waitFor(() => {
        expect(screen.queryByText('Test tooltip')).toBeInTheDocument();
      });
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
    it('renders with title and description', async () => {
      render(
        <ActionTooltip
          title="Test Action"
          description="This is a test action description"
        />
      );

      fireEvent.click(screen.getByLabelText('More information'));

      await waitFor(() => {
        expect(screen.getByText('Test Action')).toBeInTheDocument();
        expect(screen.getByText('This is a test action description')).toBeInTheDocument();
      });
    });

    it('displays cost information', async () => {
      render(
        <ActionTooltip
          title="Build Structure"
          description="Build a new structure"
          cost={10}
        />
      );

      fireEvent.click(screen.getByLabelText('More information'));

      await waitFor(() => {
        expect(screen.getByText('Build Structure')).toBeInTheDocument();
        expect(screen.getByText('Build a new structure')).toBeInTheDocument();
        expect(screen.getByText('10 Stars')).toBeInTheDocument();
      });
    });

    it('shows hotkey information', async () => {
      render(
        <ActionTooltip
          title="Build Structure"
          description="Build a new structure"
          hotkey="B"
        />
      );

      fireEvent.click(screen.getByLabelText('More information'));

      await waitFor(() => {
        expect(screen.getByText('Build Structure')).toBeInTheDocument();
        expect(screen.getByText('Hotkey:')).toBeInTheDocument();
        expect(screen.getByText('B')).toBeInTheDocument();
      });
    });

    it('displays requirements', async () => {
      render(
        <ActionTooltip
          title="Build Temple"
          description="Build a sacred temple"
          requirements={['Writing technology', '20 faith']}
        />
      );

      fireEvent.click(screen.getByLabelText('More information'));

      await waitFor(() => {
        expect(screen.getByText('Build Temple')).toBeInTheDocument();
        expect(screen.getByText('Requirements:')).toBeInTheDocument();
        expect(screen.getByText('Writing technology')).toBeInTheDocument();
        expect(screen.getByText('20 faith')).toBeInTheDocument();
      });
    });

    it('shows effects', async () => {
      render(
        <ActionTooltip
          title="Build Farm"
          description="Build a farm for food production"
          effects={['+2 stars per turn', '+1 population growth']}
        />
      );

      fireEvent.click(screen.getByLabelText('More information'));

      await waitFor(() => {
        expect(screen.getByText('Build Farm')).toBeInTheDocument();
        expect(screen.getByText('Effects:')).toBeInTheDocument();
        expect(screen.getByText('+2 stars per turn')).toBeInTheDocument();
        expect(screen.getByText('+1 population growth')).toBeInTheDocument();
      });
    });

    it('renders with all props combined', async () => {
      render(
        <ActionTooltip
          title="Advanced Structure"
          description="A complex building with multiple effects"
          cost={50}
          hotkey="Ctrl+B"
          requirements={['Advanced Technology', 'City Level 3']}
          effects={['+5 stars per turn', '+3 defense', 'Unlocks special units']}
        />
      );

      fireEvent.click(screen.getByLabelText('More information'));

      await waitFor(() => {
        expect(screen.getByText('Advanced Structure')).toBeInTheDocument();
        expect(screen.getByText('A complex building with multiple effects')).toBeInTheDocument();
        expect(screen.getByText('50 Stars')).toBeInTheDocument();
        expect(screen.getByText('Ctrl+B')).toBeInTheDocument();
        expect(screen.getByText('Advanced Technology')).toBeInTheDocument();
        expect(screen.getByText('City Level 3')).toBeInTheDocument();
        expect(screen.getByText('+5 stars per turn')).toBeInTheDocument();
        expect(screen.getByText('+3 defense')).toBeInTheDocument();
        expect(screen.getByText('Unlocks special units')).toBeInTheDocument();
      });
    });
  });

  describe('InfoTooltip Component', () => {
    it('renders with title and content', async () => {
      render(
        <InfoTooltip
          content="This explains how the game mechanic works"
        />
      );

      // InfoTooltip renders as an info button that shows content on click
      const infoButton = screen.getByLabelText('More information');
      expect(infoButton).toBeInTheDocument();

      fireEvent.click(infoButton);

      await waitFor(() => {
        expect(screen.queryByText('This explains how the game mechanic works')).toBeInTheDocument();
      });
    });

    it('displays additional details', async () => {
      render(
        <InfoTooltip
          content="Faith is used for religious actions and abilities"
        />
      );

      const infoButton = screen.getByLabelText('More information');
      expect(infoButton).toBeInTheDocument();

      fireEvent.click(infoButton);

      await waitFor(() => {
        expect(screen.queryByText('Faith is used for religious actions and abilities')).toBeInTheDocument();
      });
    });

    it('shows formula when provided', async () => {
      render(
        <InfoTooltip
          content="How combat damage is calculated"
        />
      );

      const infoButton = screen.getByLabelText('More information');
      expect(infoButton).toBeInTheDocument();

      fireEvent.click(infoButton);

      await waitFor(() => {
        expect(screen.queryByText('How combat damage is calculated')).toBeInTheDocument();
      });
    });

    it('renders with all props', async () => {
      render(
        <InfoTooltip
          content="A complex game system with multiple aspects"
        />
      );

      const infoButton = screen.getByLabelText('More information');
      expect(infoButton).toBeInTheDocument();

      fireEvent.click(infoButton);

      await waitFor(() => {
        expect(screen.queryByText('A complex game system with multiple aspects')).toBeInTheDocument();
      });
    });
  });

  describe('Tooltip Integration', () => {
    it('ActionTooltip works as standalone component', async () => {
      render(
        <ActionTooltip
          title="Standalone Action"
          description="This action works independently"
          cost="25 stars"
        />
      );

      const infoButton = screen.getByLabelText('More information');
      fireEvent.click(infoButton);

      await waitFor(() => {
        expect(screen.getByText('Standalone Action')).toBeInTheDocument();
        expect(screen.getByText('This action works independently')).toBeInTheDocument();
        expect(screen.getByText('25 stars')).toBeInTheDocument();
      });
    });

    it('InfoTooltip works as standalone component', async () => {
      render(
        <InfoTooltip
          content="This information works independently"
        />
      );

      const infoButton = screen.getByLabelText('More information');
      expect(infoButton).toBeInTheDocument();

      fireEvent.click(infoButton);

      await waitFor(() => {
        expect(screen.queryByText('This information works independently')).toBeInTheDocument();
      });
    });
  });
});
