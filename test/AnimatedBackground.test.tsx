import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { 
  AnimatedBackground,
  MenuBackground,
  GameBackground,
  ModalBackground,
  BuildingMenuBackground
} from '../client/src/components/ui/AnimatedBackground';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, animate, transition, initial, ...props }: any) => (
      <div 
        className={className} 
        style={style}
        data-testid="motion-div"
        data-animate={animate ? JSON.stringify(animate) : undefined}
        {...props}
      >
        {children}
      </div>
    )
  }
}));

// Mock window dimensions for particle calculations
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1920,
});

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 1080,
});

describe('AnimatedBackground Component', () => {
  it('renders particles variant by default', () => {
    render(<AnimatedBackground />);
    
    // Should render particles (multiple motion divs)
    const motionDivs = screen.getAllByTestId('motion-div');
    expect(motionDivs.length).toBeGreaterThan(0);
  });

  it('renders particles variant with correct count based on intensity', () => {
    const { rerender } = render(<AnimatedBackground variant="particles" intensity="low" />);
    let particleDivs = screen.getAllByTestId('motion-div');
    
    rerender(<AnimatedBackground variant="particles" intensity="high" />);
    let highIntensityDivs = screen.getAllByTestId('motion-div');
    
    // High intensity should have more particles than low intensity
    expect(highIntensityDivs.length).toBeGreaterThan(particleDivs.length);
  });

  it('renders grid variant correctly', () => {
    render(<AnimatedBackground variant="grid" />);
    
    const container = screen.getByTestId('motion-div');
    expect(container).toBeInTheDocument();
  });

  it('renders waves variant correctly', () => {
    render(<AnimatedBackground variant="waves" />);
    
    const container = screen.getByTestId('motion-div');
    expect(container).toBeInTheDocument();
    
    // Should have animation data
    expect(container).toHaveAttribute('data-animate');
  });

  it('renders sacred variant correctly', () => {
    render(<AnimatedBackground variant="sacred" />);
    
    // Sacred variant should have multiple geometric elements and orbs
    const elements = screen.getAllByTestId('motion-div');
    expect(elements.length).toBeGreaterThan(5); // Multiple sacred geometry elements + orbs
  });

  it('applies correct color schemes', () => {
    const { rerender } = render(<AnimatedBackground color="blue" />);
    expect(screen.getAllByTestId('motion-div')).toHaveLength > 0;

    rerender(<AnimatedBackground color="purple" />);
    expect(screen.getAllByTestId('motion-div')).toHaveLength > 0;

    rerender(<AnimatedBackground color="gold" />);
    expect(screen.getAllByTestId('motion-div')).toHaveLength > 0;

    rerender(<AnimatedBackground color="green" />);
    expect(screen.getAllByTestId('motion-div')).toHaveLength > 0;
  });

  it('handles different intensity levels', () => {
    const { rerender } = render(<AnimatedBackground intensity="low" />);
    let lowElements = screen.getAllByTestId('motion-div');

    rerender(<AnimatedBackground intensity="medium" />);
    let mediumElements = screen.getAllByTestId('motion-div');

    rerender(<AnimatedBackground intensity="high" />);
    let highElements = screen.getAllByTestId('motion-div');

    expect(lowElements.length).toBeLessThan(mediumElements.length);
    expect(mediumElements.length).toBeLessThan(highElements.length);
  });

  it('returns null for unknown variant', () => {
    render(<AnimatedBackground variant="unknown" as any />);
    
    // Should not render anything for unknown variant
    expect(screen.queryByTestId('motion-div')).not.toBeInTheDocument();
  });

  it('has pointer-events disabled', () => {
    render(<AnimatedBackground />);
    
    const container = screen.getAllByTestId('motion-div')[0].parentElement;
    expect(container).toHaveClass('pointer-events-none');
  });

  it('has overflow hidden', () => {
    render(<AnimatedBackground />);
    
    const container = screen.getAllByTestId('motion-div')[0].parentElement;
    expect(container).toHaveClass('overflow-hidden');
  });
});

describe('Background Presets', () => {
  it('MenuBackground renders correctly', () => {
    render(<MenuBackground />);
    
    // Should render sacred variant with purple color
    expect(screen.getAllByTestId('motion-div')).toHaveLength > 5;
  });

  it('GameBackground renders correctly', () => {
    render(<GameBackground />);
    
    // Should render particles variant with blue color
    expect(screen.getAllByTestId('motion-div')).toHaveLength > 0;
  });

  it('ModalBackground renders correctly', () => {
    render(<ModalBackground />);
    
    // Should render waves variant
    const container = screen.getByTestId('motion-div');
    expect(container).toHaveAttribute('data-animate');
  });

  it('BuildingMenuBackground renders correctly', () => {
    render(<BuildingMenuBackground />);
    
    // Should render grid variant
    expect(screen.getByTestId('motion-div')).toBeInTheDocument();
  });
});

describe('Animation Properties', () => {
  it('particles have random positioning', () => {
    render(<AnimatedBackground variant="particles" intensity="low" />);
    
    const particles = screen.getAllByTestId('motion-div');
    expect(particles.length).toBeGreaterThan(10);
    
    // Each particle should have different positioning (though we can't easily test randomness)
    particles.forEach(particle => {
      expect(particle).toHaveClass('absolute');
    });
  });

  it('sacred geometry elements have rotation animations', () => {
    render(<AnimatedBackground variant="sacred" />);
    
    const elements = screen.getAllByTestId('motion-div');
    
    // At least some elements should have animation data
    const animatedElements = elements.filter(el => el.hasAttribute('data-animate'));
    expect(animatedElements.length).toBeGreaterThan(0);
  });

  it('waves variant has background animation', () => {
    render(<AnimatedBackground variant="waves" />);
    
    const container = screen.getByTestId('motion-div');
    expect(container).toHaveAttribute('data-animate');
    
    const animateData = container.getAttribute('data-animate');
    expect(animateData).toBeTruthy();
  });
});