import { render, screen, fireEvent } from '@testing-library/react';
import { GlowingButton } from '../GlowingButton';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, className, onClick, disabled, ...props }: any) => (
      <button 
        className={className} 
        onClick={onClick} 
        disabled={disabled}
        data-testid="motion-button" 
        {...props}
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
    expect(screen.getByTestId('motion-button')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    
    render(
      <GlowingButton onClick={handleClick}>
        Click Me
      </GlowingButton>
    );
    
    fireEvent.click(screen.getByTestId('motion-button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('applies disabled state correctly', () => {
    render(
      <GlowingButton onClick={() => {}} disabled>
        Disabled Button
      </GlowingButton>
    );
    
    const button = screen.getByTestId('motion-button');
    expect(button).toBeDisabled();
  });

  it('applies custom className', () => {
    render(
      <GlowingButton onClick={() => {}} className="custom-button-class">
        Custom Button
      </GlowingButton>
    );
    
    const button = screen.getByTestId('motion-button');
    expect(button).toHaveClass('custom-button-class');
  });

  it('renders different variants correctly', () => {
    const { rerender } = render(
      <GlowingButton onClick={() => {}} variant="primary">
        Primary Button
      </GlowingButton>
    );
    
    let button = screen.getByTestId('motion-button');
    expect(button).toHaveClass('bg-gradient-to-r', 'from-amber-600', 'to-amber-500');
    
    rerender(
      <GlowingButton onClick={() => {}} variant="secondary">
        Secondary Button
      </GlowingButton>
    );
    
    button = screen.getByTestId('motion-button');
    expect(button).toHaveClass('bg-gradient-to-r', 'from-slate-600', 'to-slate-500');
  });

  it('renders different sizes correctly', () => {
    const { rerender } = render(
      <GlowingButton onClick={() => {}} size="sm">
        Small Button
      </GlowingButton>
    );
    
    let button = screen.getByTestId('motion-button');
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');
    
    rerender(
      <GlowingButton onClick={() => {}} size="lg">
        Large Button
      </GlowingButton>
    );
    
    button = screen.getByTestId('motion-button');
    expect(button).toHaveClass('px-6', 'py-3', 'text-lg');
  });

  it('prevents click when disabled', () => {
    const handleClick = jest.fn();
    
    render(
      <GlowingButton onClick={handleClick} disabled>
        Disabled Button
      </GlowingButton>
    );
    
    fireEvent.click(screen.getByTestId('motion-button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(
      <GlowingButton onClick={() => {}} aria-label="Accessible button">
        Button Content
      </GlowingButton>
    );
    
    const button = screen.getByTestId('motion-button');
    expect(button).toHaveAttribute('aria-label', 'Accessible button');
  });

  it('supports touch-friendly sizing', () => {
    render(
      <GlowingButton onClick={() => {}} size="lg">
        Touch Button
      </GlowingButton>
    );
    
    const button = screen.getByTestId('motion-button');
    // Should have min-h class for 44px+ touch targets
    expect(button.className).toContain('min-h-');
  });
});