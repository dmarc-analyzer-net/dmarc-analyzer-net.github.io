import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { DOCS_SECTIONS } from './lib/docs';

/**
 * Guards the *rendered* <title> length. Templates append a suffix (" — DMARC
 * Analyzer", " — DMARC Analyzer docs"), so a frontmatter title that looks fine
 * can still truncate in search results. `seoTitle` overrides the title for the
 * <title> tag only, leaving the on-page h1 free to read well.
 *
 * Budget = 60 (Google's practical cut-off) minus the template's suffix.
 */
const titleBudget = (budget: number) =>
  (data: { title: string; seoTitle?: string }) => (data.seoTitle ?? data.title).length <= budget;

const budgetMessage = (budget: number) =>
  `title (or seoTitle) must be <= ${budget} chars so the rendered <title> stays under 60`;

// How-to guides and longer-form articles. Authored as Markdown in
// src/content/guides/ and rendered by src/pages/guides/[...slug].astro.
const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    /** Overrides `title` in the <title> tag only; keeps the h1 readable. */
    seoTitle: z.string().optional(),
    title: z.string().max(65), // keep titles short for SERPs
    description: z.string().min(50).max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }).refine(titleBudget(43), { message: budgetMessage(43) }),
});

// Short, precise definition pages. Authored in src/content/glossary/ and
// rendered by src/pages/glossary/[...slug].astro.
const glossary = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/glossary' }),
  schema: z.object({
    term: z.string(),
    description: z.string().min(50).max(160),
    aliases: z.array(z.string()).default([]), // e.g. ["RUA"] for "aggregate report"
    related: z.array(z.string()).default([]), // slugs of related glossary entries
    draft: z.boolean().default(false),
  }),
});

// Per-provider "set up SPF/DKIM/DMARC for X" pages. Authored in
// src/content/dmarc-for/ and rendered by src/pages/dmarc-for/[...slug].astro.
const providers = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/dmarc-for' }),
  schema: z.object({
    /** Overrides `title` in the <title> tag only; keeps the h1 readable. */
    seoTitle: z.string().optional(),
    title: z.string().max(65),
    provider: z.string(), // display name, e.g. "Google Workspace"
    description: z.string().min(50).max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }).refine(titleBudget(43), { message: budgetMessage(43) }),
});

// Comparison / "alternative" pages. Authored in src/content/compare/ and
// rendered by src/pages/compare/[...slug].astro. These name competitors, so
// keep every claim factual and durable (see the content style guide); the
// template appends the trademark disclaimer automatically.
const compare = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/compare' }),
  schema: z.object({
    /** Overrides `title` in the <title> tag only; keeps the h1 readable. */
    seoTitle: z.string().optional(),
    title: z.string().max(65),
    // For 1:1 pages this is the competitor name ("dmarcian"); for roundups it's
    // a short category label ("Open source & self-hosted") used in nav/cards.
    competitor: z.string(),
    // Roundups list many tools instead of comparing us to one; the index and
    // breadcrumb drop the "vs" framing for them.
    roundup: z.boolean().default(false),
    description: z.string().min(50).max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }).refine(titleBudget(43), { message: budgetMessage(43) }),
});

// Product documentation for self-hosters (install, configure, operate). Authored
// in src/content/docs/ and rendered by src/pages/docs/[...slug].astro with a
// persistent sidebar. `section` groups pages in that sidebar and `order` sorts
// them within a group — docs read in sequence, unlike the other collections.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    /** Overrides `title` in the <title> tag only; keeps the h1 readable. */
    seoTitle: z.string().optional(),
    title: z.string().max(65),
    description: z.string().min(50).max(160),
    section: z.enum(DOCS_SECTIONS),
    order: z.number(),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /**
     * Slug of another docs entry this one nests under in the sidebar only —
     * reading order (`section`/`order`), the URL, and every other listing are
     * unaffected. For a family of otherwise-flat pages, e.g. one per identity
     * provider under a shared "Single sign-on" page.
     */
    parent: z.string().optional(),
    draft: z.boolean().default(false),
  }).refine(titleBudget(38), { message: budgetMessage(38) }),
});

export const collections = { guides, glossary, providers, compare, docs };
