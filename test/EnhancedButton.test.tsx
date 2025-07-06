import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Hammer } from 'lucide-react';
import { 
  EnhancedButton, 
  PrimaryButton, 
  SecondaryButton, 
  SuccessButton, 
  DangerButton, 
  GhostButton 
} from '../client/src/components/ui/EnhancedButton';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, className, onClick, whileHover, whileTap, animate, transition, ...props }: any) => (
      <button 
        className={className} 
        onClick={onClick} 
        data-testid="enhanced-button"
        {...props}
      >
        {children}
      </button>
    ),
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>{children}</div>
    )
  }
}));

describe('EnhancedButton Component', () => {
  it('renders with basic props', () => {
    render(<EnhancedButton>Test Button</EnhancedButton>);
    
    expect(screen.getByText('Test Button')).toBeInTheDocument();
    expect(screen.getByTestId('enhanced-button')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const mockClick = vi.fn();
    const user = userEvent.setup();
    
    render(<EnhancedButton onClick={mockClick}>Click Me</EnhancedButton>);
    
    await user.click(screen.getByText('Click Me'));
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('renders with different variants', () => {
    const { rerender } = render(<EnhancedButton variant="primary">Primary</EnhancedButton>);
    expect(screen.getByText('Primary')).toBeInTheDocument();

    rerender(<EnhancedButton variant="secondary">Secondary</EnhancedButton>);
    expect(screen.getByText('Secondary')).toBeInTheDocument();

    rerender(<EnhancedButton variant="success">Success</EnhancedButton>);
    expect(screen.getByText('Success')).toBeInTheDocument();

    rerender(<EnhancedButton variant="danger">Danger</EnhancedButton>);
    expect(screen.getByText('Danger')).toBeInTheDocument();

    rerender(<EnhancedButton variant="warning">Warning</EnhancedButton>);
    expect(screen.getByText('Warning')).toBeInTheDocument();

    rerender(<EnhancedButton variant="ghost">Ghost</EnhancedButton>);
    expect(screen.getByText('Ghost')).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<EnhancedButton size="sm">Small</EnhancedButton>);
    expect(screen.getByText('Small')).toBeInTheDocument();

    rerender(<EnhancedButton size="md">Medium</EnhancedButton>);
    expect(screen.getByText('Medium')).toBeInTheDocument();

    rerender(<EnhancedButton size="lg">Large</EnhancedButton>);
    expect(screen.getByText('Large')).toBeInTheDocument();
  });

  it('handles disabled state', () => {
    const mockClick = vi.fn();
    
    render(<EnhancedButton disabled onClick={mockClick}>Disabled</EnhancedButton>);
    
    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<EnhancedButton loading>Loading</EnhancedButton>);
    
    expect(screen.getByText('Loading')).toBeInTheDocument();
    // Loading spinner should be present
  });

  it('renders with icon', () => {
    render(<EnhancedButton icon={Hammer}>With Icon</EnhancedButton>);
    
    expect(screen.getByText('With Icon')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<EnhancedButton className="custom-class">Custom</EnhancedButton>);
    
    const button = screen.getByTestId('enhanced-button');
    expect(button).toHaveClass('custom-class');
  });

  it('handles glow effect', () => {
    render(<EnhancedButton glow>Glowing</EnhancedButton>);
    
    expect(screen.getByText('Glowing')).toBeInTheDocument();
  });

  it('handles pulse effect', () => {
    render(<EnhancedButton pulse>Pulsing</EnhancedButton>);
    
    expect(screen.getByText('Pulsing')).toBeInTheDocument();
  });

  it('does not trigger click when loading', () => {
    const mockClick = vi.fn();
    
    render(<EnhancedButton loading onClick={mockClick}>Loading Button</EnhancedButton>);
    
    const button = screen.getByText('Loading Button');
    fireEvent.click(button);
    
    expect(mockClick).not.toHaveBeenCalled();
  });
});

describe('Button Presets', () => {
  it('PrimaryButton renders correctly', () => {
    render(<PrimaryButton>Primary</PrimaryButton>);
    expect(screen.getByText('Primary')).toBeInTheDocument();
  });

  it('SecondaryButton renders correctly', () => {
    render(<SecondaryButton>Secondary</SecondaryButton>);
    expect(screen.getByText('Secondary')).toBeInTheDocument();
  });

  it('SuccessButton renders correctly', () => {
    render(<SuccessButton>Success</SuccessButton>);
    expect(screen.getByText('Success')).toBeInTheDocument();
  });

  it('DangerButton renders correctly', () => {
    render(<DangerButton>Danger</DangerButton>);
    expect(screen.getByText('Danger')).toBeInTheDocument();
  });

  it('GhostButton renders correctly', () => {
    render(<GhostButton>Ghost</GhostButton>);
    expect(screen.getByText('Ghost')).toBeInTheDocument();
  });

  it('preset buttons handle props correctly', async () => {
    const mockClick = vi.fn();
    const user = userEvent.setup();
    
    render(<PrimaryButton onClick={mockClick} icon={Hammer}>Test</PrimaryButton>);
    
    await user.click(screen.getByText('Test'));
    expect(mockClick).toHaveBeenCalled();
  });

  it('preset buttons can be disabled', () => {
    render(<SuccessButton disabled>Disabled Success</SuccessButton>);
    
    const button = screen.getByText('Disabled Success');
    expect(button).toBeDisabled();
  });
});