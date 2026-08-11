/** Shared blog metadata, so the post template, the index and the RSS feed
 *  cannot disagree about who wrote a post or where the feed lives. */

export const AUTHOR = {
  name: 'Michael Fjeldsted',
  // schema.org Person + sameAs is what ties the byline to a real identity.
  sameAs: [
    'https://github.com/michaelTBF',
    'https://www.linkedin.com/in/mfjeldsted',
  ],
};

export const FEED_PATH = '/blog/rss.xml';

export const TYPE_LABEL: Record<string, string> = {
  research: 'Research',
  engineering: 'Engineering',
  release: 'Release notes',
};

/** Newest first. getCollection returns *glob* order, and slicing it unsorted
 *  made the build non-reproducible once already — see the guides template. */
export function byNewest<T extends { data: { publishDate: Date } }>(entries: T[]): T[] {
  return [...entries].sort(
    (a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime(),
  );
}
