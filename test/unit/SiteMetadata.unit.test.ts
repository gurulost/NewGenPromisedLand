import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const publicDir = path.join(repoRoot, 'client/public');
const canonicalUrl = 'https://covenantlegends.com/';
const socialImageUrl = 'https://covenantlegends.com/social/og-image.png';
const title = 'Covenant Legends: Book of Mormon Strategy Game';
const pageDescription = 'Covenant Legends is a browser-based tactical strategy game inspired by the Book of Mormon. Lead ancient American factions through faith, warfare, diplomacy, and covenant choices in a premium 2.5D hex world.';
const socialDescription = 'A sacred tactical strategy game where ancient American factions contend through faith, warfare, diplomacy, and covenant choices.';
const socialImageAlt = 'Covenant Legends key art showing an ancient American city and tactical world map.';

const readText = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), 'utf8');

const readPngSize = (relativePath: string) => {
  const buffer = readFileSync(path.join(publicDir, relativePath));
  const signature = buffer.subarray(0, 8).toString('hex');
  expect(signature).toBe('89504e470d0a1a0a');

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

describe('site metadata assets', () => {
  it('uses Covenant Legends production metadata instead of default Vite or Replit branding', () => {
    const html = readText('client/index.html');

    expect(html).not.toContain('/vite.svg');
    expect(html).not.toContain('covenant-legends.replit.app');
    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toContain(`<meta name="description" content="${pageDescription}" />`);
    expect(html).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />');
    expect(html).toContain('<link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png" />');
    expect(html).toContain('<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />');
    expect(html).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain(`<link rel="canonical" href="${canonicalUrl}" />`);
    expect(html).toContain(`<meta property="og:title" content="${title}" />`);
    expect(html).toContain(`<meta property="og:description" content="${socialDescription}" />`);
    expect(html).toContain(`<meta property="og:url" content="${canonicalUrl}" />`);
    expect(html).toContain('<meta property="og:site_name" content="Covenant Legends" />');
    expect(html).toContain(`<meta property="og:image" content="${socialImageUrl}" />`);
    expect(html).toContain(`<meta property="og:image:secure_url" content="${socialImageUrl}" />`);
    expect(html).toContain('<meta property="og:image:type" content="image/png" />');
    expect(html).toContain('<meta property="og:image:width" content="1200" />');
    expect(html).toContain('<meta property="og:image:height" content="630" />');
    expect(html).toContain(`<meta property="og:image:alt" content="${socialImageAlt}" />`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain(`<meta name="twitter:url" content="${canonicalUrl}" />`);
    expect(html).toContain(`<meta name="twitter:title" content="${title}" />`);
    expect(html).toContain(`<meta name="twitter:description" content="${socialDescription}" />`);
    expect(html).toContain(`<meta name="twitter:image" content="${socialImageUrl}" />`);
    expect(html).toContain(`<meta name="twitter:image:alt" content="${socialImageAlt}" />`);
  });

  it('publishes a production sitemap and robots pointer', () => {
    const robots = readText('client/public/robots.txt');
    const sitemap = readText('client/public/sitemap.xml');

    expect(robots.trim()).toBe('User-agent: *\nAllow: /\n\nSitemap: https://covenantlegends.com/sitemap.xml');
    expect(sitemap).toContain(`<loc>${canonicalUrl}</loc>`);
    expect(sitemap).toContain('<lastmod>2026-05-17</lastmod>');
    expect(sitemap).toContain('<priority>1.0</priority>');
    expect(sitemap.match(/<url>/g)).toHaveLength(1);
  });

  it('exposes installable PWA metadata with expected icon assets', () => {
    const manifest = JSON.parse(readText('client/public/manifest.webmanifest')) as {
      name?: string;
      short_name?: string;
      description?: string;
      id?: string;
      lang?: string;
      start_url?: string;
      scope?: string;
      display?: string;
      categories?: string[];
      icons?: Array<{ src: string; sizes: string; purpose?: string }>;
    };

    expect(manifest).toMatchObject({
      name: 'Covenant Legends',
      short_name: 'Covenant',
      description: 'A browser-based tactical strategy game inspired by the Book of Mormon.',
      id: '/',
      lang: 'en-US',
      start_url: '/',
      scope: '/',
      display: 'fullscreen',
      categories: ['games', 'strategy'],
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icons/icon-192.png', sizes: '192x192', purpose: 'any maskable' }),
        expect.objectContaining({ src: '/icons/icon-512.png', sizes: '512x512', purpose: 'any maskable' }),
      ]),
    );
    expect(readPngSize('icons/icon-192.png')).toEqual({ width: 192, height: 192 });
    expect(readPngSize('icons/icon-512.png')).toEqual({ width: 512, height: 512 });
    expect(readPngSize('icons/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
    expect(readPngSize('icons/favicon-32.png')).toEqual({ width: 32, height: 32 });
    expect(readPngSize('icons/favicon-16.png')).toEqual({ width: 16, height: 16 });
  });

  it('uses a correctly sized social sharing image', () => {
    expect(readPngSize('social/og-image.png')).toEqual({ width: 1200, height: 630 });
  });
});
