import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { RequirementBanner } from '../RequirementBanner';

const stripMotionProps = ({ animate, initial, exit, transition, whileHover, whileTap, layout, layoutId, ...rest }: any) => rest;

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} data-testid="motion-div" {...stripMotionProps(props)}>
        {children}
      </div>
    ),
  },
}));

describe('RequirementBanner', () => {
  it('renders insufficient-stars banner correctly', () => {
    render(
      <RequirementBanner 
        type="insufficient-stars" 
        message="Not enough stars to build" 
      />
    );
    
    expect(screen.getByText('Not enough stars to build')).toBeInTheDocument();
    expect(screen.getByText('⚠')).toBeInTheDocument();
    
    const banner = screen.getByTestId('motion-div');
    expect(banner).toHaveClass('bg-red-900/20', 'border-red-500/30', 'text-red-300');
  });

  it('renders prerequisites banner correctly', () => {
    render(
      <RequirementBanner 
        type="prerequisites" 
        message="Technology required: Advanced Engineering" 
      />
    );
    
    expect(screen.getByText('Technology required: Advanced Engineering')).toBeInTheDocument();
    expect(screen.getByText('🔒')).toBeInTheDocument();
    
    const banner = screen.getByTestId('motion-div');
    expect(banner).toHaveClass('bg-orange-900/20', 'border-orange-500/30', 'text-orange-300');
  });

  it('renders tech-required banner correctly', () => {
    render(
      <RequirementBanner 
        type="tech-required" 
        message="Research Metallurgy first" 
      />
    );
    
    expect(screen.getByText('Research Metallurgy first')).toBeInTheDocument();
    expect(screen.getByText('🔬')).toBeInTheDocument();
    
    const banner = screen.getByTestId('motion-div');
    expect(banner).toHaveClass('bg-blue-900/20', 'border-blue-500/30', 'text-blue-300');
  });

  it('renders info banner correctly', () => {
    render(
      <RequirementBanner 
        type="info" 
        message="This action will consume the resource" 
      />
    );
    
    expect(screen.getByText('This action will consume the resource')).toBeInTheDocument();
    expect(screen.getByText('ℹ')).toBeInTheDocument();
    
    const banner = screen.getByTestId('motion-div');
    expect(banner).toHaveClass('bg-amber-900/20', 'border-amber-500/30', 'text-amber-300');
  });

  it('applies custom className', () => {
    render(
      <RequirementBanner 
        type="info" 
        message="Test message" 
        className="custom-banner-class"
      />
    );
    
    const banner = screen.getByTestId('motion-div');
    expect(banner).toHaveClass('custom-banner-class');
  });

  it('renders with proper accessibility structure', () => {
    render(
      <RequirementBanner 
        type="insufficient-stars" 
        message="Accessibility test message" 
      />
    );
    
    const banner = screen.getByTestId('motion-div');
    expect(banner).toHaveAttribute('class');
    
    // Check that icon and message are properly structured
    const icon = screen.getByText('⚠');
    const message = screen.getByText('Accessibility test message');
    
    expect(icon).toBeInTheDocument();
    expect(message).toBeInTheDocument();
  });
});
