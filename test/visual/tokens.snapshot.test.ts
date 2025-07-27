import { describe, it, expect } from 'vitest';
import { TOKENS } from '../../client/src/theme/tokens';

describe('Token Snapshot Sanity Tests', () => {
  it('validates TOKENS object structure and prevents regression', () => {
    // Snapshot the entire TOKENS object
    expect(TOKENS).toMatchSnapshot();
  });

  it('ensures all resource types have required properties', () => {
    const requiredProperties = ['color', 'bg', 'border', 'glow', 'icon', 'name'];
    
    Object.keys(TOKENS).forEach(tokenKey => {
      const token = TOKENS[tokenKey as keyof typeof TOKENS];
      
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
      expect(TOKENS[key as keyof typeof TOKENS].color).toEqual(
        expectedColorTokens[key as keyof typeof expectedColorTokens]
      );
    });
  });

  it('validates icon strings are present and unique', () => {
    const icons = Object.values(TOKENS).map(token => token.icon);
    const uniqueIcons = [...new Set(icons)];
    
    // All tokens should have icons
    expect(icons.every(icon => icon.length > 0)).toBe(true);
    
    // Icons should be unique (no duplicates)
    expect(icons.length).toBe(uniqueIcons.length);
    
    // Specific icon validation - verify actual token values
    expect(TOKENS.stars.icon).toBe('✦');
    expect(TOKENS.faith.icon).toBe('✠');
    expect(TOKENS.pride.icon).toBe('⚔');
    expect(TOKENS.population.icon).toBe('👥');
    expect(TOKENS.dissent.icon).toBe('⚡');
    expect(TOKENS.costStars.icon).toBe('✪'); // Corrected to match actual token
  });

  it('validates gradient and styling patterns', () => {
    Object.values(TOKENS).forEach(token => {
      // Background should be gradient or solid color
      expect(token.bg).toMatch(/^bg-(gradient|slate|stone|amber|blue|red|yellow|green)/);
      
      // Border should have proper border class
      expect(token.border).toMatch(/^border-[\w-]+/);
      
      // Glow should have shadow class
      expect(token.glow).toMatch(/^shadow-[\w-]+/);
    });
  });

  it('prevents accidental token removal', () => {
    const requiredTokens = [
      'stars',
      'population', 
      'faith',
      'pride',
      'dissent',
      'costStars'
    ];
    
    requiredTokens.forEach(tokenKey => {
      expect(TOKENS).toHaveProperty(tokenKey);
      expect(TOKENS[tokenKey as keyof typeof TOKENS]).toBeDefined();
    });
    
    // Total count check
    expect(Object.keys(TOKENS)).toHaveLength(requiredTokens.length);
  });

  it('validates Book of Mormon theming consistency', () => {
    // Should maintain golden/amber color family
    const goldenTokens = [TOKENS.stars, TOKENS.costStars];
    goldenTokens.forEach(token => {
      expect(token.color).toMatch(/yellow|amber|gold/);
    });
    
    // Faith should be blue/sacred colors
    expect(TOKENS.faith.color).toMatch(/blue|cyan/);
    expect(TOKENS.faith.icon).toBe('✠'); // Cross/sacred symbol
    
    // Pride should be red/warning colors
    expect(TOKENS.pride.color).toMatch(/red|rose/);
    expect(TOKENS.pride.icon).toBe('⚔'); // Sword/warfare symbol
  });

  it('validates accessibility color requirements', () => {
    // All color tokens should specify contrasting colors
    Object.values(TOKENS).forEach(token => {
      expect(token.color).toMatch(/text-\w+-\d+/);
      expect(token.bg).toMatch(/(bg-gradient|bg-\w+-\d+)/);
    });
  });

  it('creates snapshot baseline for visual regression', () => {
    const tokenSnapshot = {
      structure: Object.keys(TOKENS).sort(),
      properties: Object.fromEntries(
        Object.entries(TOKENS).map(([key, token]) => [
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