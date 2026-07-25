import type { APIRoute } from 'astro';

import { buildSections, INTRO } from '../lib/llms';

/**
 * /llms.txt — the index defined at https://llmstxt.org/: an H1, a blockquote
 * summary, optional prose, then H2 sections of annotated links. Generated from
 * the content collections so it cannot drift from the site.
 */
export const GET: APIRoute = async () => {
  const sections = await buildSections();

  const body = [
    '# DMARC Analyzer',
    '',
    INTRO,
    '',
    ...sections.flatMap((section) => [
      `## ${section.name}`,
      '',
      ...section.items.map((entry) => `- [${entry.title}](${entry.url}): ${entry.description}`),
      '',
    ]),
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
