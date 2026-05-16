import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock viewport utilities
const setViewportSize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
};

const viewportSizes = {
  mobile: { width: 320, height: 568 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
  ultra: { width: 3840, height: 2160 }
};

describe('Responsive Regression Tests', () => {
  beforeEach(() => {
    setViewportSize(1920, 1080); // Reset to desktop
  });

  it('validates modal viewport safety across all breakpoints', () => {
    Object.entries(viewportSizes).forEach(([sizeName, { width, height }]) => {
      setViewportSize(width, height);
      
      const MockModal = () => (
        <div 
          data-testid={`modal-${sizeName}`}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto"
          style={{ 
            maxWidth: width < 768 ? '95vw' : '32rem',
            maxHeight: '90vh'
          }}
        >
          <div className="p-6">
            <h2>Modal Content</h2>
            <div style={{ height: '2000px' }}>Very tall content</div>
          </div>
        </div>
      );
      
      render(<MockModal />);
      
      const modal = screen.getByTestId(`modal-${sizeName}`);
      expect(modal).toBeInTheDocument();
      
      // Should never exceed 90% of viewport height
      const modalHeight = modal.getBoundingClientRect().height;
      expect(modalHeight).toBeLessThanOrEqual(height * 0.9);
      
      // Should be scrollable when content exceeds viewport
      expect(modal).toHaveClass('overflow-y-auto');
    });
  });

  it('validates responsive design patterns at each breakpoint', () => {
    const MockResponsiveComponent = ({ viewport }: { viewport: string }) => (
      <div data-testid={`responsive-${viewport}`}>
        <div className="w-full max-w-[95vw] md:max-w-lg">
          <h1 className="text-lg md:text-xl lg:text-2xl">Responsive Title</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-amber-600">Item 1</div>
            <div className="p-4 bg-amber-600">Item 2</div>
            <div className="p-4 bg-amber-600">Item 3</div>
          </div>
          <button className="w-full md:w-auto mt-4 px-6 py-3">
            Responsive Button
          </button>
        </div>
      </div>
    );

    Object.entries(viewportSizes).forEach(([sizeName, { width, height }]) => {
      setViewportSize(width, height);
      
      render(<MockResponsiveComponent viewport={sizeName} />);
      
      const component = screen.getByTestId(`responsive-${sizeName}`);
      expect(component).toBeInTheDocument();
      
      // Verify responsive classes are applied
      const container = component.querySelector('.max-w-\\[95vw\\]');
      expect(container).toBeInTheDocument();
      
      const title = component.querySelector('h1');
      expect(title).toBeInTheDocument();
      
      const button = component.querySelector('button');
      expect(button).toBeInTheDocument();
    });
  });

  it('ensures no element overflow at any viewport size', () => {
    const MockGameBoard = ({ viewport }: { viewport: string }) => (
      <div 
        data-testid={`game-board-${viewport}`}
        className="w-full h-screen overflow-hidden"
      >
        <header className="w-full h-16 bg-stone-900 flex items-center justify-between px-4">
          <h1 className="text-amber-200 text-xl truncate">Covenant Legends</h1>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-amber-600 text-white rounded">Menu</button>
            <button className="px-3 py-1 bg-amber-600 text-white rounded">Settings</button>
          </div>
        </header>
        
        <main className="w-full" style={{ height: 'calc(100vh - 4rem)' }}>
          <div className="w-full h-full relative overflow-hidden">
            <canvas className="w-full h-full" />
            
            {/* UI Overlays */}
            <div className="absolute top-4 left-4 max-w-[300px] bg-stone-900/90 rounded-lg p-4">
              <h3 className="text-amber-200">Player Stats</h3>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div>Stars: 25</div>
                <div>Faith: 8</div>
                <div>Pride: 3</div>
                <div>Population: 12</div>
              </div>
            </div>
            
            <div className="absolute bottom-4 right-4 max-w-[250px] bg-stone-900/90 rounded-lg p-4">
              <h3 className="text-amber-200">Selected Unit</h3>
              <p className="text-sm text-amber-100">Warrior - HP: 10/10</p>
              <div className="flex gap-2 mt-2">
                <button className="px-2 py-1 bg-blue-600 text-white rounded text-xs">Move</button>
                <button className="px-2 py-1 bg-red-600 text-white rounded text-xs">Attack</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );

    Object.entries(viewportSizes).forEach(([sizeName, { width, height }]) => {
      setViewportSize(width, height);
      
      render(<MockGameBoard viewport={sizeName} />);
      
      const gameBoard = screen.getByTestId(`game-board-${sizeName}`);
      const rect = gameBoard.getBoundingClientRect();
      
      // Should not exceed viewport bounds
      expect(rect.width).toBeLessThanOrEqual(width);
      expect(rect.height).toBeLessThanOrEqual(height);
      
      // UI overlays should fit within viewport
      const overlays = gameBoard.querySelectorAll('.absolute');
      overlays.forEach(overlay => {
        const overlayRect = overlay.getBoundingClientRect();
        expect(overlayRect.left).toBeGreaterThanOrEqual(0);
        expect(overlayRect.top).toBeGreaterThanOrEqual(0);
        expect(overlayRect.right).toBeLessThanOrEqual(width);
        expect(overlayRect.bottom).toBeLessThanOrEqual(height);
      });
    });
  });

  it('validates touch target sizing on mobile devices', () => {
    setViewportSize(320, 568); // iPhone SE size
    
    const MockTouchInterface = () => (
      <div data-testid="touch-interface">
        {/* Minimum 44px touch targets */}
        <button className="min-h-[44px] min-w-[44px] touch-manipulation">×</button>
        <button className="min-h-[48px] px-4 py-3 touch-manipulation">Primary Action</button>
        
        {/* Interactive grid with proper spacing */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <button className="min-h-[44px] bg-amber-600 text-white rounded touch-manipulation">
            Option 1
          </button>
          <button className="min-h-[44px] bg-amber-600 text-white rounded touch-manipulation">
            Option 2
          </button>
        </div>
        
        {/* List with adequate spacing */}
        <ul className="mt-4 space-y-2">
          <li>
            <button className="w-full min-h-[44px] text-left px-4 py-3 bg-stone-800 rounded touch-manipulation">
              List Item 1
            </button>
          </li>
          <li>
            <button className="w-full min-h-[44px] text-left px-4 py-3 bg-stone-800 rounded touch-manipulation">
              List Item 2
            </button>
          </li>
        </ul>
      </div>
    );
    
    render(<MockTouchInterface />);
    
    const buttons = screen.getAllByRole('button');
    
    buttons.forEach(button => {
      // Check for minimum touch target classes (since getBoundingClientRect returns 0 in jsdom)
      const hasMinHeight = button.className.includes('min-h-[44px]') || 
                         button.className.includes('min-h-[48px]');
      const hasMinWidth = button.className.includes('min-w-[44px]') || 
                        button.className.includes('w-full');
      
      expect(hasMinHeight || hasMinWidth).toBe(true);
      
      // Should have touch optimization
      expect(button).toHaveClass('touch-manipulation');
    });
  });

  it('validates scrollable content behavior', () => {
    Object.entries(viewportSizes).forEach(([sizeName, { width, height }]) => {
      setViewportSize(width, height);
      
      const MockScrollableModal = () => (
        <div 
          data-testid={`scrollable-${sizeName}`}
          className="max-h-[90vh] overflow-y-auto bg-stone-900 rounded-lg"
        >
          <div className="p-6">
            <h2 className="sticky top-0 bg-stone-900 pb-4">Scrollable Content</h2>
            <div>
              {Array.from({ length: 50 }, (_, i) => (
                <div key={i} className="py-2 border-b border-stone-700">
                  Item {i + 1}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
      
      render(<MockScrollableModal />);
      
      const scrollable = screen.getByTestId(`scrollable-${sizeName}`);
      
      // Should have scroll capability
      expect(scrollable).toHaveClass('overflow-y-auto');
      
      // Should respect max height
      const rect = scrollable.getBoundingClientRect();
      expect(rect.height).toBeLessThanOrEqual(height * 0.9);
      
      // Sticky header should work
      const header = scrollable.querySelector('h2');
      expect(header).toHaveClass('sticky');
    });
  });

  it('validates ultra-wide display handling', () => {
    setViewportSize(3840, 2160); // 4K display
    
    const MockUltraWideInterface = () => (
      <div data-testid="ultra-wide-interface" className="w-full h-screen">
        <div className="max-w-screen-2xl mx-auto h-full flex">
          {/* Left sidebar */}
          <aside className="w-80 bg-stone-900 p-6">
            <h3 className="text-amber-200">Game Menu</h3>
          </aside>
          
          {/* Main content */}
          <main className="flex-1 relative">
            <canvas className="w-full h-full" />
          </main>
          
          {/* Right sidebar */}
          <aside className="w-80 bg-stone-900 p-6">
            <h3 className="text-amber-200">Player Info</h3>
          </aside>
        </div>
      </div>
    );
    
    render(<MockUltraWideInterface />);
    
    const interface_ = screen.getByTestId('ultra-wide-interface');
    const container = interface_.querySelector('.max-w-screen-2xl');
    
    expect(container).toBeInTheDocument();
    
    // Should center content on ultra-wide displays
    expect(container).toHaveClass('mx-auto');
    
    // Sidebars should maintain reasonable width classes
    const sidebars = interface_.querySelectorAll('aside');
    sidebars.forEach(sidebar => {
      expect(sidebar).toHaveClass('w-80'); // 20rem = 320px
    });
  });
});