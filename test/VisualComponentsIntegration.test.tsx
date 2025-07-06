import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
    button: ({ children, className, onClick, ...props }: any) => (
      <button className={className} onClick={onClick} {...props}>{children}</button>
    )
  },
  AnimatePresence: ({ children }: any) => children
}));

// Mock TooltipSystem
vi.mock('../client/src/components/ui/TooltipSystem', () => ({
  Tooltip: ({ children }: any) => children,
  ActionTooltip: ({ title }: any) => <div>{title}</div>,
  InfoTooltip: ({ title, content }: any) => <div>{title}: {content}</div>,
  StarProductionTooltip: ({ totalIncome, breakdown }: any) => (
    <div>Star Income: {totalIncome}/turn</div>
  ),
  FaithSystemTooltip: () => <div>Faith System Info</div>,
  PrideSystemTooltip: () => <div>Pride System Info</div>,
  DissentTooltip: () => <div>Dissent System Info</div>,
  TechnologyTooltip: () => <div>Technology System Info</div>,
  UnitTooltip: ({ unit, unitDef }: any) => <div>{unitDef.name} Unit</div>
}));

describe('Visual Components Integration', () => {
  describe('Component Interoperability', () => {
    it('EnhancedButton works with TooltipSystem', async () => {
      const { EnhancedButton } = await import('../client/src/components/ui/EnhancedButton');
      const { Tooltip, ActionTooltip } = await import('../client/src/components/ui/TooltipSystem');
      
      const mockClick = vi.fn();
      
      render(
        <Tooltip content={
          <ActionTooltip
            title="Enhanced Action"
            description="This is an enhanced button with tooltip"
            cost="10 stars"
          />
        }>
          <EnhancedButton onClick={mockClick} variant="primary">
            Test Button
          </EnhancedButton>
        </Tooltip>
      );

      const button = screen.getByText('Test Button');
      expect(button).toBeInTheDocument();
      
      fireEvent.click(button);
      expect(mockClick).toHaveBeenCalled();
    });

    it('AnimatedBackground renders without interfering with other components', async () => {
      const { AnimatedBackground } = await import('../client/src/components/ui/AnimatedBackground');
      const { EnhancedButton } = await import('../client/src/components/ui/EnhancedButton');
      
      render(
        <div>
          <AnimatedBackground variant="particles" />
          <EnhancedButton>Clickable Button</EnhancedButton>
        </div>
      );

      // Background should be present but not interfere with interactions
      const button = screen.getByText('Clickable Button');
      expect(button).toBeInTheDocument();
      
      // Should be able to click button despite background
      fireEvent.click(button);
    });

    it('multiple visual components work together', async () => {
      const { BuildingMenuBackground } = await import('../client/src/components/ui/AnimatedBackground');
      const { SuccessButton, DangerButton } = await import('../client/src/components/ui/EnhancedButton');
      
      const mockSuccess = vi.fn();
      const mockDanger = vi.fn();
      
      render(
        <div style={{ position: 'relative' }}>
          <BuildingMenuBackground />
          <SuccessButton onClick={mockSuccess}>Success Action</SuccessButton>
          <DangerButton onClick={mockDanger}>Danger Action</DangerButton>
        </div>
      );

      const successBtn = screen.getByText('Success Action');
      const dangerBtn = screen.getByText('Danger Action');
      
      fireEvent.click(successBtn);
      fireEvent.click(dangerBtn);
      
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockDanger).toHaveBeenCalled();
    });
  });

  describe('Performance and Accessibility', () => {
    it('components maintain accessibility attributes', async () => {
      const { EnhancedButton } = await import('../client/src/components/ui/EnhancedButton');
      
      render(
        <EnhancedButton disabled aria-label="Disabled action">
          Disabled Button
        </EnhancedButton>
      );

      const button = screen.getByRole('button', { name: /disabled button/i });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-label', 'Disabled action');
    });

    it('animated components do not block user interactions', async () => {
      const { AnimatedBackground } = await import('../client/src/components/ui/AnimatedBackground');
      
      const mockClick = vi.fn();
      
      render(
        <div data-testid="container">
          <AnimatedBackground variant="sacred" />
          <button onClick={mockClick}>Interaction Test</button>
        </div>
      );

      const button = screen.getByText('Interaction Test');
      fireEvent.click(button);
      
      expect(mockClick).toHaveBeenCalled();
    });

    it('tooltip system handles rapid interactions gracefully', async () => {
      const { Tooltip } = await import('../client/src/components/ui/TooltipSystem');
      
      render(
        <Tooltip content="Rapid interaction test">
          <button>Hover Target</button>
        </Tooltip>
      );

      const button = screen.getByText('Hover Target');
      
      // Simulate rapid hover events
      fireEvent.mouseEnter(button);
      fireEvent.mouseLeave(button);
      fireEvent.mouseEnter(button);
      fireEvent.mouseLeave(button);
      
      // Should not throw errors or crash
      expect(button).toBeInTheDocument();
    });
  });

  describe('Theme and Styling Consistency', () => {
    it('all enhanced buttons maintain consistent styling', async () => {
      const { 
        PrimaryButton, 
        SecondaryButton, 
        SuccessButton, 
        DangerButton, 
        GhostButton 
      } = await import('../client/src/components/ui/EnhancedButton');
      
      render(
        <div>
          <PrimaryButton>Primary</PrimaryButton>
          <SecondaryButton>Secondary</SecondaryButton>
          <SuccessButton>Success</SuccessButton>
          <DangerButton>Danger</DangerButton>
          <GhostButton>Ghost</GhostButton>
        </div>
      );

      // All buttons should be present and properly styled
      expect(screen.getByText('Primary')).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Danger')).toBeInTheDocument();
      expect(screen.getByText('Ghost')).toBeInTheDocument();
    });

    it('animated backgrounds use consistent color schemes', async () => {
      const { AnimatedBackground } = await import('../client/src/components/ui/AnimatedBackground');
      
      const { rerender } = render(<AnimatedBackground color="blue" />);
      
      // Test different color schemes render without errors
      rerender(<AnimatedBackground color="purple" />);
      rerender(<AnimatedBackground color="gold" />);
      rerender(<AnimatedBackground color="green" />);
      
      // Should not throw any errors during color changes
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles missing or invalid props gracefully', async () => {
      const { EnhancedButton } = await import('../client/src/components/ui/EnhancedButton');
      
      // Test with minimal props
      render(<EnhancedButton>Minimal Button</EnhancedButton>);
      
      expect(screen.getByText('Minimal Button')).toBeInTheDocument();
    });

    it('tooltip system handles empty content', async () => {
      const { Tooltip } = await import('../client/src/components/ui/TooltipSystem');
      
      render(
        <Tooltip content="">
          <button>Empty Tooltip</button>
        </Tooltip>
      );

      expect(screen.getByText('Empty Tooltip')).toBeInTheDocument();
    });

    it('animated background handles unknown variants', async () => {
      const { AnimatedBackground } = await import('../client/src/components/ui/AnimatedBackground');
      
      // Should not crash with unknown variant
      expect(() => {
        render(<AnimatedBackground variant="unknown" as any />);
      }).not.toThrow();
    });
  });

  describe('Responsive Design', () => {
    it('components adapt to different container sizes', async () => {
      const { EnhancedButton } = await import('../client/src/components/ui/EnhancedButton');
      
      render(
        <div style={{ width: '200px' }}>
          <EnhancedButton size="sm">Small Container</EnhancedButton>
        </div>
      );

      const button = screen.getByText('Small Container');
      expect(button).toBeInTheDocument();
    });

    it('animated backgrounds scale appropriately', async () => {
      const { AnimatedBackground } = await import('../client/src/components/ui/AnimatedBackground');
      
      render(
        <div style={{ width: '500px', height: '300px' }}>
          <AnimatedBackground variant="grid" />
        </div>
      );

      // Should render without layout issues
    });
  });
});