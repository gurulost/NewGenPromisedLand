import { describe, it, expect } from 'vitest';
import { TOKENS } from '../tokens';

describe('Design Tokens', () => {
  it('exports TOKENS object', () => {
    expect(TOKENS).toBeDefined();
    expect(typeof TOKENS).toBe('object');
  });

  it('contains color definitions', () => {
    expect(TOKENS.colors).toBeDefined();
    expect(typeof TOKENS.colors).toBe('object');
  });

  it('contains spacing definitions', () => {
    expect(TOKENS.spacing).toBeDefined();
    expect(typeof TOKENS.spacing).toBe('object');
  });

  it('contains typography definitions', () => {
    expect(TOKENS.typography).toBeDefined();
    expect(typeof TOKENS.typography).toBe('object');
  });

  it('contains animation definitions', () => {
    expect(TOKENS.animations).toBeDefined();
    expect(typeof TOKENS.animations).toBe('object');
  });

  it('has consistent amber theme colors', () => {
    const { colors } = TOKENS;
    
    expect(colors.primary).toContain('amber');
    expect(colors.accent).toBeDefined();
    expect(colors.background).toBeDefined();
  });

  it('has proper Book of Mormon themed values', () => {
    const { typography } = TOKENS;
    
    expect(typography.heading).toContain('Cinzel');
    expect(typography.body).toContain('Inter');
  });

  it('includes proper spacing values for touch targets', () => {
    const { spacing } = TOKENS;
    
    // Should have values that support 44px+ touch targets
    expect(Object.values(spacing)).toContain('44px');
  });

  it('includes animation timing values', () => {
    const { animations } = TOKENS;
    
    expect(animations.duration).toBeDefined();
    expect(animations.easing).toBeDefined();
  });
});