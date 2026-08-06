/**
 * The docs reading order — the one place it is written down.
 *
 * This list had four copies (`DocsSidebar.astro`, `docs/index.astro`,
 * `docs/[...slug].astro`, `lib/llms.ts`) and the Zod enum in `content.config.ts`
 * was a fifth. Adding the "Using the console" section meant editing all five, and
 * missing one fails in a different way each time: the sidebar silently drops a
 * group, the docs index omits it, prev/next skips its pages, `llms.txt` leaves it
 * out, or — for the enum — every page in the new section fails the build.
 *
 * The enum is the reason this lives here rather than being exported from
 * `content.config.ts`: the config imports it, so nothing has to import the config.
 */
export const DOCS_SECTIONS = [
  'Getting started',
  'Using the console',
  'Configuration',
  'Operations',
] as const;

/** A docs section name, kept in step with the schema by construction. */
export type DocsSection = (typeof DOCS_SECTIONS)[number];
