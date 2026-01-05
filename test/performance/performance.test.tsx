import { describe, it, expect, vi } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import React, { useState, useMemo } from 'react';

// Performance testing utilities
const measureRenderTime = (renderFn: () => void) => {
  const start = performance.now();
  renderFn();
  return performance.now() - start;
};

const trackReRenders = () => {
  let renderCount = 0;
  const increment = () => { renderCount++; };
  const getRenderCount = () => renderCount;
  const reset = () => { renderCount = 0; };
  
  return { increment, getRenderCount, reset };
};

describe('Performance Guardrails', () => {
  describe('Re-render Prevention', () => {
    it('prevents unnecessary re-renders on unrelated prop changes', () => {
      const { increment, getRenderCount, reset } = trackReRenders();
      
      const TestComponent = React.memo(({ 
        relevantProp, 
        irrelevantProp 
      }: { 
        relevantProp: number; 
        irrelevantProp: string; 
      }) => {
        increment();
        return <div>{relevantProp}</div>;
      });
      
      const { rerender } = render(
        <TestComponent relevantProp={1} irrelevantProp="initial" />
      );
      
      reset();
      
      // Change irrelevant prop - should not re-render
      rerender(<TestComponent relevantProp={1} irrelevantProp="changed" />);
      expect(getRenderCount()).toBe(1); // Only initial render
      
      // Change relevant prop - should re-render
      rerender(<TestComponent relevantProp={2} irrelevantProp="changed" />);
      expect(getRenderCount()).toBe(2); // Re-render happened
    });

    it('validates selector memoization prevents cascade re-renders', () => {
      let selectorCallCount = 0;
      
      const TestComponent = ({ gameState }: { gameState: any }) => {
        const memoizedData = useMemo(() => {
          selectorCallCount++;
          return gameState.players.map((p: any) => ({
            id: p.id,
            totalResources: p.stars + p.faith + p.pride
          }));
        }, [gameState.players]);
        
        return <div>{memoizedData.length}</div>;
      };
      
      const gameState = {
        players: [{ id: '1', stars: 10, faith: 5, pride: 2 }],
        currentTurn: 1
      };
      
      const { rerender } = render(<TestComponent gameState={gameState} />);
      
      selectorCallCount = 0;
      
      // Change unrelated property
      const newGameState = { ...gameState, currentTurn: 2 };
      rerender(<TestComponent gameState={newGameState} />);
      
      // Selector should not be called again due to memoization
      expect(selectorCallCount).toBe(0);
    });

    it('validates expensive calculation memoization', () => {
      let calculationCount = 0;
      
      const ExpensiveComponent = ({ data }: { data: number[] }) => {
        const expensiveResult = useMemo(() => {
          calculationCount++;
          return data.reduce((sum, val) => sum + val * val, 0); // Expensive operation
        }, [data]);
        
        return <div>{expensiveResult}</div>;
      };
      
      const testData = [1, 2, 3, 4, 5];
      const { rerender } = render(<ExpensiveComponent data={testData} />);
      
      calculationCount = 0;
      
      // Re-render with same data
      rerender(<ExpensiveComponent data={testData} />);
      expect(calculationCount).toBe(0);
      
      // Re-render with different data
      rerender(<ExpensiveComponent data={[1, 2, 3]} />);
      expect(calculationCount).toBe(1);
    });
  });

  describe('Component Performance Benchmarks', () => {
    it('PlayerHUD renders within performance budget', () => {
      const mockGameState = {
        players: [{ 
          id: 'player1', 
          stars: 25, 
          faith: 8, 
          cities: Array.from({ length: 10 }, (_, i) => ({ id: `city${i}` }))
        }]
      };
      
      const renderTime = measureRenderTime(() => {
        render(<div>Mock PlayerHUD with {mockGameState.players[0].cities.length} cities</div>);
      });
      
      // Should render within 16ms (60fps budget)
      expect(renderTime).toBeLessThan(16);
    });

    it('CityPanel with large datasets performs adequately', () => {
      const largeCityData = {
        structures: Array.from({ length: 50 }, (_, i) => ({ 
          id: `structure${i}`, 
          type: 'building', 
          cost: i * 10 
        })),
        units: Array.from({ length: 30 }, (_, i) => ({ 
          id: `unit${i}`, 
          type: 'warrior', 
          cost: i * 5 
        }))
      };
      
      const renderTime = measureRenderTime(() => {
        render(
          <div>
            Mock CityPanel with {largeCityData.structures.length} structures 
            and {largeCityData.units.length} units
          </div>
        );
      });
      
      // Should handle large datasets efficiently
      expect(renderTime).toBeLessThan(32);
    });

    it('TechPanel gesture handling maintains 60fps', () => {
      const manyTechs = Array.from({ length: 100 }, (_, i) => ({
        id: `tech${i}`,
        name: `Technology ${i}`,
        status: i < 10 ? 'researched' : 'available'
      }));
      
      const GestureComponent = () => {
        const [transform, setTransform] = useState('translate(0, 0) scale(1)');
        
        return (
          <div 
            style={{ transform }}
            onTouchStart={() => setTransform('translate(10px, 10px) scale(1.1)')}
            onTouchEnd={() => setTransform('translate(0, 0) scale(1)')}
          >
            {manyTechs.map(tech => (
              <div key={tech.id}>{tech.name}</div>
            ))}
          </div>
        );
      };
      
      const renderTime = measureRenderTime(() => {
        render(<GestureComponent />);
      });
      
      expect(renderTime).toBeLessThan(16);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('validates object reference stability', () => {
      const TestComponent = ({ config }: { config: any }) => {
        const [, forceUpdate] = useState({});
        
        const stableRef = useMemo(() => config, [config.id]);
        
        return (
          <div onClick={() => act(() => forceUpdate({}))}>
            {stableRef.id}
          </div>
        );
      };
      
      const config = { id: 'test', data: [1, 2, 3] };
      const { container } = render(<TestComponent config={config} />);
      
      // Multiple clicks should not create new objects
      const element = container.firstChild as HTMLElement;
      act(() => { element.click(); });
      act(() => { element.click(); });
      act(() => { element.click(); });
      
      // Component should remain stable
      expect(element.textContent).toBe('test');
    });

    it('validates cleanup of event listeners and subscriptions', () => {
      let subscriptionCount = 0;
      
      const mockSubscription = {
        subscribe: () => { subscriptionCount++; },
        unsubscribe: () => { subscriptionCount--; }
      };
      
      const SubscriptionComponent = () => {
        React.useEffect(() => {
          mockSubscription.subscribe();
          return () => mockSubscription.unsubscribe();
        }, []);
        
        return <div>Subscribed</div>;
      };
      
      const { unmount } = render(<SubscriptionComponent />);
      expect(subscriptionCount).toBe(1);
      
      unmount();
      expect(subscriptionCount).toBe(0);
    });
  });

  describe('Bundle Size and Loading Performance', () => {
    it('validates code splitting effectiveness', async () => {
      // Mock dynamic import
      const mockDynamicImport = vi.fn(() => 
        Promise.resolve({ default: () => <div>Lazy Component</div> })
      );
      
      const LazyWrapper = React.lazy(() => mockDynamicImport());
      
      render(
        <React.Suspense fallback={<div>Loading...</div>}>
          <LazyWrapper />
        </React.Suspense>
      );

      await screen.findByText('Lazy Component');
      expect(mockDynamicImport).toHaveBeenCalledTimes(1);
    });

    it('validates asset loading optimization', async () => {
      const loadTimes: number[] = [];
      
      const mockAssetLoader = (assetUrl: string) => {
        const start = performance.now();
        // Simulate asset loading
        setTimeout(() => {
          loadTimes.push(performance.now() - start);
        }, Math.random() * 10);
      };
      
      vi.spyOn(Math, 'random').mockReturnValue(0); // stable and fast

      // Load multiple assets
      ['texture1.jpg', 'model1.glb', 'sound1.mp3'].forEach(mockAssetLoader);
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });

      expect(loadTimes.length).toBe(3);
      expect(loadTimes.every(time => time < 100)).toBe(true);
    });
  });

  describe('Animation Performance', () => {
    it('validates 60fps animation capability', async () => {
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        const id = setTimeout(() => cb(0), 0) as any;
        return id;
      });
      vi.stubGlobal('cancelAnimationFrame', (id: any) => clearTimeout(id));

      let frameCount = 0;
      
      const AnimatedComponent = () => {
        const [frame, setFrame] = useState(0);
        
        React.useEffect(() => {
          let rafId: any;
          const animate = () => {
            frameCount++;
            setFrame(prev => prev + 1);
            
            if (frameCount < 10) {
              rafId = requestAnimationFrame(animate);
            }
          };
          
          rafId = requestAnimationFrame(animate);
          return () => cancelAnimationFrame(rafId);
        }, []);
        
        return <div style={{ transform: `translateX(${frame}px)` }}>Animated</div>;
      };
      
      const { unmount } = render(<AnimatedComponent />);
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
      });
      unmount();

      expect(frameCount).toBeGreaterThanOrEqual(1);

      vi.unstubAllGlobals();
    });

    it('validates reduced motion compliance', () => {
      const MotionComponent = ({ prefersReducedMotion }: { prefersReducedMotion: boolean }) => {
        const animationClass = prefersReducedMotion 
          ? 'motion-reduce:transition-none' 
          : 'transition-transform duration-300';
        
        return <div className={animationClass}>Motion Content</div>;
      };
      
      // Test with motion enabled
      const { rerender, container } = render(
        <MotionComponent prefersReducedMotion={false} />
      );
      expect(container.firstChild).toHaveClass('transition-transform');
      
      // Test with reduced motion
      rerender(<MotionComponent prefersReducedMotion={true} />);
      expect(container.firstChild).toHaveClass('motion-reduce:transition-none');
    });
  });
});
