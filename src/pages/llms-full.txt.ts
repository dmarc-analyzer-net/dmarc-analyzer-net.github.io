import type { APIRoute } from 'astro';

import { buildSections, INTRO, SITE } from '../lib/llms';

/**
 * /llms-full.txt — every page's markdown in one file, for readers that would
 * rather take the whole site in a single fetch than follow 35 links. The site
 * is small (~14k words), so this stays a reasonable download.
 *
 * Each page gets an H1 and its body follows verbatim. Bodies use H2/H3 only, so
 * this yields one clean hierarchy instead of page titles competing with section
 * headings. Bodies are never rewritten: demoting their headings would mean
 * editing markdown that contains fenced code blocks — several of which hold
 * shell comments starting with `#` — and getting that subtly wrong is worse
 * than leaving the structure alone.
 *
 * Pages with no markdown body (the hand-built product pages) are linked from
 * /llms.txt but contribute nothing here — there is no body to inline.
 */
export const GET: APIRoute = async () => {
  const sections = await buildSections();

  const parts = [
    '# DMARC Analyzer — full content',
    '',
    INTRO,
    '',
    `Every page below is also linked individually from ${SITE}/llms.txt, grouped there as ${sections
      .map((s) => s.name)
      .join(', ')}. Pages appear here in that order.`,
    '',
  ];

  for (const section of sections) {
    for (const entry of section.items) {
      if (entry.body.trim().length === 0) continue;

      parts.push(
        '---',
        '',
        `# ${entry.title}`,
        '',
        `Source: ${entry.url}`,
        `Section: ${section.name}`,
        '',
        entry.description,
        '',
        entry.body.trim(),
        '',
      );
    }
  }

  return new Response(parts.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
