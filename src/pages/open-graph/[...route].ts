// Per-page social/schema images, generated once at build time via
// astro-og-canvas/CanvasKit — not at request time, since this is a static
// site with no server to render one on demand.
//
// Originally scoped to the three collections carrying an Article schema
// (compare, guides, dmarc-for), because reusing /og.png as every page's
// og:image and schema image is worse than generic: that image has the
// *homepage's own headline* baked into the pixels ("DMARC monitoring built
// for agencies running many domains."), so a search result for e.g. a
// glossary term or a docs page would show unrelated marketing copy next to
// its actual title. Extended here to every remaining page except the
// homepage (og.png's headline already IS the homepage's, so there's nothing
// to fix there) and 404 (nothing meaningful to share).
//
// Static pages' title/description are imported directly from the page that
// owns them rather than re-typed here, so there's exactly one place to
// update either string.
import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

import * as dmarcChecker from '../tools/dmarc-checker.astro';
import * as dmarcGenerator from '../tools/dmarc-generator.astro';
import * as spfChecker from '../tools/spf-checker.astro';
import * as dkimChecker from '../tools/dkim-checker.astro';
import * as dmarcReportAnalyzer from '../tools/dmarc-report-analyzer.astro';
import * as toolsIndex from '../tools/index.astro';
import * as brand from '../brand.astro';
import * as features from '../features.astro';
import * as freeDmarcAnalyzer from '../free-dmarc-analyzer.astro';
import * as parsedmarcAlternative from '../parsedmarc-alternative.astro';
import * as selfHostedDmarcMonitoring from '../self-hosted-dmarc-monitoring.astro';
import * as compareIndex from '../compare/index.astro';
import * as dmarcForIndex from '../dmarc-for/index.astro';
import * as docsIndex from '../docs/index.astro';
import * as glossaryIndex from '../glossary/index.astro';
import * as guidesIndex from '../guides/index.astro';
import * as rfcIndex from '../rfc/index.astro';

/** The only fields the image template needs, common to every source. */
type Page = { title: string; description: string };

const compareEntries = await getCollection('compare', ({ data }) => !data.draft);
const guideEntries = await getCollection('guides', ({ data }) => !data.draft);
const providerEntries = await getCollection('providers', ({ data }) => !data.draft);
const glossaryEntries = await getCollection('glossary', ({ data }) => !data.draft);
const docsEntries = await getCollection('docs', ({ data }) => !data.draft);
const rfcEntries = await getCollection('rfcs', ({ data }) => !data.draft);

// Keys become the route: `compare/easydmarc` -> /open-graph/compare/easydmarc.png
const pages: Record<string, Page> = Object.fromEntries([
  ...compareEntries.map((e): [string, Page] => [`compare/${e.id}`, e.data]),
  ...guideEntries.map((e): [string, Page] => [`guides/${e.id}`, e.data]),
  ...providerEntries.map((e): [string, Page] => [`dmarc-for/${e.id}`, e.data]),
  ...glossaryEntries.map((e): [string, Page] => [
    `glossary/${e.id}`,
    { title: e.data.term, description: e.data.description },
  ]),
  ...docsEntries.map((e): [string, Page] => [`docs/${e.id}`, e.data]),
  ...rfcEntries.map((e): [string, Page] => [
    `rfc/${e.data.number}`,
    { title: `RFC ${e.data.number} \u2014 ${e.data.shortTitle}`, description: e.data.description },
  ]),

  ['tools/dmarc-checker', dmarcChecker],
  ['tools/dmarc-generator', dmarcGenerator],
  ['tools/spf-checker', spfChecker],
  ['tools/dkim-checker', dkimChecker],
  ['tools/dmarc-report-analyzer', dmarcReportAnalyzer],
  ['tools', toolsIndex],
  ['brand', brand],
  ['features', features],
  ['free-dmarc-analyzer', freeDmarcAnalyzer],
  ['parsedmarc-alternative', parsedmarcAlternative],
  ['self-hosted-dmarc-monitoring', selfHostedDmarcMonitoring],
  ['compare', compareIndex],
  ['dmarc-for', dmarcForIndex],
  ['docs', docsIndex],
  ['glossary', glossaryIndex],
  ['guides', guidesIndex],
  ['rfc', rfcIndex],
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
