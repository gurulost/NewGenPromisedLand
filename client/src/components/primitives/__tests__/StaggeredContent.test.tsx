import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaggeredContent, StaggeredContainer } from '../StaggeredContent';

// Mock framer-motion to avoid animation complications in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, variants, ...props }: any) => (
      <div className={className} data-testid="motion-div" {...props}>
        {children}
      </div>
    ),
  },
}));

describe('StaggeredContent', () => {
  it('renders children correctly', () => {
    render(
      <StaggeredContent>
        <div>Test Content</div>
      </StaggeredContent>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <StaggeredContent className="custom-class">
        <div>Test Content</div>
      </StaggeredContent>
    );
    
    const motionDiv = screen.getByTestId('motion-div');
    expect(motionDiv).toHaveClass('custom-class');
  });

  it('renders without crashing with no children', () => {
    render(<StaggeredContent />);
    expect(screen.getByTestId('motion-div')).toBeInTheDocument();
  });
});

describe('StaggeredContainer', () => {
  it('renders multiple children with staggered animation setup', () => {
    render(
      <StaggeredContainer>
        <StaggeredContent>
          <div>Child 1</div>
        </StaggeredContent>
        <StaggeredContent>
          <div>Child 2</div>
        </StaggeredContent>
      </StaggeredContainer>
    );
    
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('applies custom delay through className', () => {
    render(
      <StaggeredContainer className="custom-container" delay={0.2}>
        <div>Container Content</div>
      </StaggeredContainer>
    );
    
    const container = screen.getByTestId('motion-div');
    expect(container).toHaveClass('custom-container');
  });
});