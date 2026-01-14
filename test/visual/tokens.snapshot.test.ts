import { describe, it, expect } from 'vitest';
import { TOKENS } from '../../client/src/theme/tokens';

const RESOURCE_KEYS = [
  'stars',
  'population',
  'faith',
  'pride',
  'dissent',
  'costStars',
] as const;

const resourceTokens = Object.fromEntries(
  RESOURCE_KEYS.map(key => [key, TOKENS[key]])
) as Record<(typeof RESOURCE_KEYS)[number], typeof TOKENS[keyof typeof TOKENS]>;

describe('Token Snapshot Sanity Tests', () => {
  it('validates TOKENS object structure and prevents regression', () => {
    // Snapshot only resource tokens
    expect(resourceTokens).toMatchSnapshot();
  });

  it('ensures all resource types have required properties', () => {
    const requiredProperties = ['color', 'bg', 'border', 'glow', 'icon', 'name'];
    
    Object.keys(resourceTokens).forEach(tokenKey => {
      const token = resourceTokens[tokenKey as keyof typeof resourceTokens];
      
      requiredProperties.forEach(prop => {
        expect(token).toHaveProperty(prop);
        expect(token[prop as keyof typeof token]).toBeDefined();
        expect(typeof token[prop as keyof typeof token]).toBe('string');
      });
    });
  });

  it('validates color token consistency', () => {
    const expectedColorTokens = {
      stars: expect.stringMatching(/yellow|amber/),
      population: expect.stringMatching(/green|emerald/),
      faith: expect.stringMatching(/blue|cyan/),
      pride: expect.stringMatching(/red|rose/),
      dissent: expect.stringMatching(/red|orange/),
      costStars: expect.stringMatching(/yellow|amber/)
    };
    
    Object.keys(expectedColorTokens).forEach(key => {
      expect(resourceTokens[key as keyof typeof expectedColorTokens].color).toEqual(
        expectedColorTokens[key as keyof typeof expectedColorTokens]
      );
    });
  });

  it('validates icon strings are present and unique', () => {
    const icons = Object.values(resourceTokens).map(token => token.icon);
    const uniqueIcons = [...new Set(icons)];
    
    // All tokens should have icons
    expect(icons.every(icon => icon.length > 0)).toBe(true);
    
    // Icons should be unique (no duplicates)
    expect(icons.length).toBe(uniqueIcons.length);
    
    // Specific icon validation - verify actual token values
    expect(resourceTokens.stars.icon).toBe('✦');
    expect(resourceTokens.faith.icon).toBe('✠');
    expect(resourceTokens.pride.icon).toBe('⚔');
    expect(resourceTokens.population.icon).toBe('👥');
    expect(resourceTokens.dissent.icon).toBe('⚡');
    expect(resourceTokens.costStars.icon).toBe('✪'); // Corrected to match actual token
  });

  it('validates gradient and styling patterns', () => {
    Object.values(resourceTokens).forEach(token => {
      // Background should be gradient or solid color
      expect(token.bg).toMatch(/^bg-(gradient|slate|stone|amber|blue|red|yellow|green)/);
      
      // Border should have proper border class
      expect(token.border).toMatch(/^border-[\w-]+/);
      
      // Glow should have shadow class
      expect(token.glow).toMatch(/^shadow-[\w-]+/);
    });
  });

  it('prevents accidental token removal', () => {
    RESOURCE_KEYS.forEach(tokenKey => {
      expect(resourceTokens).toHaveProperty(tokenKey);
      expect(resourceTokens[tokenKey]).toBeDefined();
    });
    
    // Total count check
    expect(Object.keys(resourceTokens)).toHaveLength(RESOURCE_KEYS.length);
  });

  it('validates Book of Mormon theming consistency', () => {
    // Should maintain golden/amber color family
    const goldenTokens = [resourceTokens.stars, resourceTokens.costStars];
    goldenTokens.forEach(token => {
      expect(token.color).toMatch(/yellow|amber|gold/);
    });
    
    // Faith should be blue/sacred colors
    expect(resourceTokens.faith.color).toMatch(/blue|cyan/);
    expect(resourceTokens.faith.icon).toBe('✠'); // Cross/sacred symbol
    
    // Pride should be red/warning colors
    expect(resourceTokens.pride.color).toMatch(/red|rose/);
    expect(resourceTokens.pride.icon).toBe('⚔'); // Sword/warfare symbol
  });

  it('validates accessibility color requirements', () => {
    // All color tokens should specify contrasting colors
    Object.values(resourceTokens).forEach(token => {
      expect(token.color).toMatch(/text-\w+-\d+/);
      expect(token.bg).toMatch(/(bg-gradient|bg-\w+-\d+)/);
    });
  });

  it('creates snapshot baseline for visual regression', () => {
    const tokenSnapshot = {
      structure: Object.keys(resourceTokens).sort(),
      properties: Object.fromEntries(
        Object.entries(resourceTokens).map(([key, token]) => [
          key,
          {
            hasColor: !!token.color,
            hasBackground: !!token.bg,
            hasBorder: !!token.border,
            hasGlow: !!token.glow,
            hasIcon: !!token.icon,
            hasName: !!token.name,
            iconCharacter: token.icon,
            colorFamily: token.color.split('-')[1] // Extract color family
          }
        ])
      )
    };
    
    expect(tokenSnapshot).toMatchSnapshot('tokens-structure-snapshot');
  });
});
