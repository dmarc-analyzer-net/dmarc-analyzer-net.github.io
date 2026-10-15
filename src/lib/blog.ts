/**
 * Shared by the blog index, the post template and the RSS feed.
 *
 * Posts are bylined and guides are not, on purpose: guides are neutral reference
 * material, posts are research and opinion, and a named author is what earns
 * credibility with the communities the blog is written for. There is one author,
 * so this is a constant rather than a frontmatter field; make it one when there
 * is a second.
 */
export const AUTHOR = {
  name: 'Michael Fjeldsted',
  url: 'https://github.com/michaelTBF',
  sameAs: ['https://github.com/michaelTBF', 'https://www.linkedin.com/in/mfjeldsted'],
};

export const TYPE_LABELS = {
  research: 'Research',
  engineering: 'Engineering',
  release: 'Release notes',
} as const;

export const BLOG_TITLE = 'DMARC Analyzer blog';
export const BLOG_DESCRIPTION =
  'Original research on how the internet actually uses DMARC, engineering write-ups from building an open-source analyzer, and monthly release roundups.';
