import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';

describe('Tailwind animation utilities', () => {
  it('defines gradient-radial background utility for animation effects', () => {
    const backgroundImage = (config as any)?.theme?.extend?.backgroundImage;
    expect(backgroundImage).toBeDefined();
    expect(backgroundImage['gradient-radial']).toBe('radial-gradient(var(--tw-gradient-stops))');
  });
});
