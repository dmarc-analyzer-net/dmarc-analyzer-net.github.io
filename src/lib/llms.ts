import { getCollection, type CollectionEntry } from 'astro:content';
import { DOCS_SECTIONS } from './docs';

/**
 * Shared source for /llms.txt and /llms-full.txt (https://llmstxt.org/).
 *
 * Both files are generated from the content collections rather than hand-written,
 * so adding a guide or a doc page updates them on the next build. A hand-kept
 * index would silently rot the moment someone shipped a page without touching it.
 */

export const SITE = 'https://dmarc-analyzer.net';
export const REPO = 'https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp';

export type Item = {
  title: string;
  url: string;
  description: string;
  /** Raw markdown body, used only by llms-full.txt. */
  body: string;
};

const notDraft = ({ data }: { data: { draft?: boolean } }) => !data.draft;

/**
 * Strips MDX scaffolding out of a raw body.
 *
 * `entry.body` is the file's own text, so an `.mdx` page carries its `import`
 * lines and component tags into this plain-text mirror — a reader (or a model)
 * would get `import Callout from '../../components/Callout.astro';` as if it were
 * prose. Component *children* are kept: that is the content. `scripts/crawl.py`
 * cannot catch this, because llms-full.txt is neither HTML nor in the sitemap.
 */
const plainBody = (body: string): string =>
  body
    .split('\n')
    .filter((line) => !/^\s*import\s.+\sfrom\s+['"].+['"];?\s*$/.test(line))
    .filter((line) => !/^\s*<\/?[A-Z][A-Za-z0-9]*(\s[^>]*)?\/?>\s*$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const item = (
  entry: CollectionEntry<'guides' | 'compare' | 'providers' | 'docs'>,
  base: string,
): Item => ({
  title: entry.data.title,
  url: `${SITE}${base}/${entry.id}/`,
  description: entry.data.description,
  body: plainBody(entry.body ?? ''),
});

/** Alphabetical by title — these have no inherent reading order. */
const byTitle = (a: Item, b: Item) => a.title.localeCompare(b.title, 'en');

export type Section = {
  /** H2 heading in llms.txt. */
  name: string;
  items: Item[];
  /** Listed under `## Optional`, which readers may skip for a shorter context. */
  optional?: boolean;
};

export async function buildSections(): Promise<Section[]> {
  const [guides, glossary, providers, compare, docs] = await Promise.all([
    getCollection('guides', notDraft),
    getCollection('glossary', notDraft),
    getCollection('providers', notDraft),
    getCollection('compare', notDraft),
    getCollection('docs', notDraft),
  ]);

  // Docs keep their sidebar order; everything else sorts by title.
  const docItems = DOCS_SECTIONS.flatMap((section) =>
    docs
      .filter((e) => e.data.section === section)
      .sort((a, b) => a.data.order - b.data.order)
      .map((e) => item(e, '/docs')),
  );

  return [
    {
      name: 'Product',
      items: [
        {
          title: 'DMARC Analyzer',
          url: `${SITE}/`,
          description:
            'Overview of the product: what it does, who it is for, and how self-hosting works.',
          body: '',
        },
        {
          title: 'Features',
          url: `${SITE}/features/`,
          description:
            'Multi-tenant dashboards, per-source drill-down, alerting, digests and policy guidance.',
          body: '',
        },
        {
          title: 'Free DMARC analyzer, self-hosted',
          url: `${SITE}/free-dmarc-analyzer/`,
          description:
            'How to run the analyzer for free on your own infrastructure, with no seat or domain limits.',
          body: '',
        },
        {
          title: 'Self-hosted DMARC monitoring',
          url: `${SITE}/self-hosted-dmarc-monitoring/`,
          description:
            'What aggregate reports reveal about your infrastructure, and the operational cost of owning the monitoring yourself.',
          body: '',
        },
        {
          title: 'Migrating from parsedmarc',
          url: `${SITE}/parsedmarc-alternative/`,
          description:
            'The mechanics of moving: the mailbox is the migration path, the first sync reads all of it, and both tools can read the same mailbox at once.',
          body: '',
        },
        {
          title: 'Source code',
          url: REPO,
          description:
            'The application itself: ASP.NET Core API and React console, shipped as one Docker image.',
          body: '',
        },
      ],
    },
    { name: 'Documentation', items: docItems },
    { name: 'Guides', items: guides.map((e) => item(e, '/guides')).sort(byTitle) },
    {
      name: 'Set up DMARC for your provider',
      items: providers.map((e) => item(e, '/dmarc-for')).sort(byTitle),
    },
    {
      name: 'Optional',
      optional: true,
      items: [
        {
          title: 'DMARC record checker',
          url: `${SITE}/tools/dmarc-checker/`,
          description:
            'Browser-based tool that looks up a domain’s DMARC record, validates every tag, and verifies that external reporting addresses are authorized.',
          body: '',
        },
        {
          title: 'DMARC record generator',
          url: `${SITE}/tools/dmarc-generator/`,
          description:
            'Browser-based form that builds a valid DMARC record, omitting any tag left at its default, and explains what the result will do to mail.',
          body: '',
        },
        {
          title: 'SPF record checker',
          url: `${SITE}/tools/spf-checker/`,
          description:
            'Browser-based tool that recursively expands SPF includes and counts DNS lookups against the RFC 7208 limit of 10, past which SPF returns permerror.',
          body: '',
        },
        {
          title: 'DKIM record checker',
          url: `${SITE}/tools/dkim-checker/`,
          description:
            'Browser-based tool that decodes a DKIM selector’s public key to report its real bit length, and flags revoked keys and testing mode.',
          body: '',
        },
        {
          title: 'Free DMARC report analyzer',
          url: `${SITE}/tools/dmarc-report-analyzer/`,
          description: 'Browser-based tool for reading a single DMARC aggregate report.',
          body: '',
        },
        // Definitions of standard terms, and positioning against other tools:
        // useful, but the least necessary to answer a question about this product.
        ...glossary
          .map((e) => ({
            title: e.data.term,
            url: `${SITE}/glossary/${e.id}/`,
            description: e.data.description,
            body: plainBody(e.body ?? ''),
          }))
          .sort(byTitle),
        ...compare.map((e) => item(e, '/compare')).sort(byTitle),
      ],
    },
  ];
}

export const INTRO = `> Open-source, self-hosted DMARC monitoring built for agencies managing many client domains. Ingests DMARC aggregate (RUA) reports from a mailbox, then reports on authentication, alignment and spoofing per client.

DMARC Analyzer is a self-hosted application, not a SaaS product: you run it on your own infrastructure and your report data never leaves it. It is multi-tenant by design, so one instance serves many clients with isolated data and read-only client access.

The documentation below covers installing and operating your own instance. The guides are vendor-neutral explanations of DMARC itself and are useful whether or not you use this tool.`;
