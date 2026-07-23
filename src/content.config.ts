import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// How-to guides and longer-form articles. Authored as Markdown in
// src/content/guides/ and rendered by src/pages/guides/[...slug].astro.
const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string().max(65), // keep titles short for SERPs
    description: z.string().min(50).max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

// Short, precise definition pages. Authored in src/content/glossary/ and
// rendered by src/pages/glossary/[...slug].astro.
const glossary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/glossary' }),
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
  loader: glob({ pattern: '**/*.md', base: './src/content/dmarc-for' }),
  schema: z.object({
    title: z.string().max(65),
    provider: z.string(), // display name, e.g. "Google Workspace"
    description: z.string().min(50).max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

// Comparison / "alternative" pages. Authored in src/content/compare/ and
// rendered by src/pages/compare/[...slug].astro. These name competitors, so
// keep every claim factual and durable (see the content style guide); the
// template appends the trademark disclaimer automatically.
const compare = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/compare' }),
  schema: z.object({
    title: z.string().max(65),
    competitor: z.string(), // display name, e.g. "dmarcian"
    description: z.string().min(50).max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { guides, glossary, providers, compare };
