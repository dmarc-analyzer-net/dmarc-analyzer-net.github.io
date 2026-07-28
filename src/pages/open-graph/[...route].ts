// Per-article social/schema images for the three collections that carry an
// Article JSON-LD schema (compare, guides, dmarc-for). Generated once at
// build time via astro-og-canvas/CanvasKit, not at request time — this is a
// static site with no server to render one on demand.
//
// Before this, every page shared /og.png as its og:image and schema `image` —
// which isn't just generic, it has the *homepage's own headline* baked into
// the pixels, so a search result for e.g. "First steps" would show
// "DMARC monitoring built for agencies running many domains." next to it.
import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

const compareEntries = await getCollection('compare', ({ data }) => !data.draft);
const guideEntries = await getCollection('guides', ({ data }) => !data.draft);
const providerEntries = await getCollection('providers', ({ data }) => !data.draft);

/** The only fields the image template needs, common to all three collections. */
type Page = { title: string; description: string };

// Keys become the route: `compare/easydmarc` -> /open-graph/compare/easydmarc.png
const pages: Record<string, Page> = Object.fromEntries([
  ...compareEntries.map((e): [string, Page] => [`compare/${e.id}`, e.data]),
  ...guideEntries.map((e): [string, Page] => [`guides/${e.id}`, e.data]),
  ...providerEntries.map((e): [string, Page] => [`dmarc-for/${e.id}`, e.data]),
]);

export const { getStaticPaths, GET } = await OGImageRoute({
  pages,
  getImageOptions: (_path, page: Page) => ({
    title: page.title,
    description: page.description,
    logo: {
      path: './public/brand/dmarc-analyzer-logo-on-dark.png',
      size: [220],
    },
    // ink-900 -> ink-700, the same dark surface og.png's gradient sits on.
    bgGradient: [
      [11, 29, 24],
      [18, 48, 41],
    ],
    border: { color: [58, 224, 176], width: 8, side: 'inline-start' },
    padding: 64,
    font: {
      title: {
        color: [232, 242, 238],
        size: 62,
        weight: 'Bold',
        families: ['Space Grotesk'],
        lineHeight: 1.15,
      },
      description: {
        color: [143, 168, 160],
        size: 32,
        families: ['Instrument Sans'],
        lineHeight: 1.4,
      },
    },
    fonts: ['./src/og-fonts/SpaceGrotesk.ttf', './src/og-fonts/InstrumentSans.ttf'],
  }),
});
