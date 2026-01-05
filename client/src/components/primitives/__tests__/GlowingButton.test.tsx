import { render, screen, fireEvent } from '@testing-library/react';
import { GlowingButton } from '../GlowingButton';

const stripMotionProps = ({ animate, initial, exit, transition, whileHover, whileTap, layout, layoutId, ...rest }: any) => rest;

// Mock framer-motion to simplify motion props in tests
jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, className, onClick, disabled, ...props }: any) => (
      <button
        className={className}
        onClick={onClick}
        disabled={disabled}
        data-testid="glowing-button"
        {...stripMotionProps(props)}
      >
        {children}
      </button>
    ),
  },
}));

// Mock hooks
jest.mock('../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../../../hooks/useSfx', () => ({
  useSfxEngine: () => jest.fn(),
}));

describe('GlowingButton', () => {
  it('renders with basic props', () => {
    render(
      <GlowingButton onClick={() => {}}>
        Click Me
      </GlowingButton>
    );
    
    expect(screen.getByText('Click Me')).toBeInTheDocument();
    expect(screen.getByTestId('glowing-button')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    
    render(
      <GlowingButton onClick={handleClick}>
        Click Me
      </GlowingButton>
    );
    
    fireEvent.click(screen.getByTestId('glowing-button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies disabled state correctly', () => {
    render(
      <GlowingButton onClick={() => {}} disabled>
        Disabled Button
      </GlowingButton>
    );
    
    const button = screen.getByTestId('glowing-button');
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    render(
      <GlowingButton onClick={() => {}} className="custom-button-class">
        Custom Button
      </GlowingButton>
    );
    
    const button = screen.getByTestId('glowing-button');
    expect(button).toHaveClass('custom-button-class');
  });

  it('renders different variants correctly', () => {
    const { rerender } = render(
      <GlowingButton onClick={() => {}} variant="primary">
        Primary Button
      </GlowingButton>
    );
    
    let button = screen.getByTestId('glowing-button');
    expect(button.className).toContain('bg-gradient-to-b');
    expect(button.className).toContain('text-slate-900');
    
    rerender(
      <GlowingButton onClick={() => {}} variant="secondary">
        Secondary Button
      </GlowingButton>
    );
    
    button = screen.getByTestId('glowing-button');
    expect(button.className).toContain('from-slate-800');
    expect(button.className).toContain('text-amber-50');
  });

  it('renders different sizes correctly', () => {
    const { rerender } = render(
      <GlowingButton onClick={() => {}} size="sm">
        Small Button
      </GlowingButton>
    );
    
    let button = screen.getByTestId('glowing-button');
    expect(button.className).toContain('min-h-[40px]');
    
    rerender(
      <GlowingButton onClick={() => {}} size="lg">
        Large Button
      </GlowingButton>
    );
    
    button = screen.getByTestId('glowing-button');
    expect(button.className).toContain('min-h-[48px]');
  });

  it('prevents click when disabled', () => {
    const handleClick = jest.fn();
    
    render(
      <GlowingButton onClick={handleClick} disabled>
        Disabled Button
      </GlowingButton>
    );
    
    fireEvent.click(screen.getByTestId('glowing-button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(
      <GlowingButton onClick={() => {}} aria-label="Accessible button">
        Button Content
      </GlowingButton>
    );
    
    const button = screen.getByTestId('glowing-button');
    expect(button).toHaveAttribute('aria-label', 'Accessible button');
  });

  it('supports touch-friendly sizing', () => {
    render(
      <GlowingButton onClick={() => {}} size="lg">
        Touch Button
      </GlowingButton>
    );
    
    const button = screen.getByTestId('glowing-button');
    // Should have min-h class for 44px+ touch targets
    expect(button.className).toContain('min-h-');
  });
});
