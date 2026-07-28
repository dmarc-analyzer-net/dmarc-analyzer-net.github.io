import type { MarkdownHeading } from 'astro';

/**
 * Single source of truth for turning a flat heading list into TOC sections,
 * shared by `Toc.astro` (which renders them) and the page templates that need
 * to know *before* laying out their grid whether a TOC will render at all —
 * otherwise a fixed-width rail column would be declared with nothing in it on
 * short pages, leaving a permanent empty gap.
 */
export interface TocSection extends MarkdownHeading {
  children: MarkdownHeading[];
}

/** Groups h2s with any nested h3 children when `maxDepth` is 3. */
export function buildTocSections(headings: MarkdownHeading[], maxDepth: 2 | 3 = 2): TocSection[] {
  const sections: TocSection[] = [];
  for (const h of headings) {
    if (h.depth === 2) {
      sections.push({ ...h, children: [] });
    } else if (h.depth === 3 && maxDepth >= 3 && sections.length) {
      sections[sections.length - 1].children.push(h);
    }
  }
  return sections;
}

/** Counts rendered links, not headings — a page with 2 h2s and 4 h3s at maxDepth 3 is 6. */
export function tocLinkCount(sections: TocSection[]): number {
  return sections.reduce((n, s) => n + 1 + s.children.length, 0);
}

/**
 * Whether `Toc.astro` will render anything for these headings, using the same
 * gate it applies internally. Page templates call this to decide the grid
 * shape (with-rail vs today's plain layout) before `<Toc>` itself runs.
 */
export function hasToc(
  headings: MarkdownHeading[],
  { minHeadings = 3, maxDepth = 2 }: { minHeadings?: number; maxDepth?: 2 | 3 } = {},
): boolean {
  return tocLinkCount(buildTocSections(headings, maxDepth)) >= minHeadings;
}
