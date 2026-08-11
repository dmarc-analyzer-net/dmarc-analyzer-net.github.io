import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { byNewest } from '../../lib/blog';

// Blog only, deliberately. A feed that also fired on guide and glossary edits
// would be noise: those pages are corrected continuously and silently, which is
// right for reference material and wrong for a subscription.
export async function GET(context: APIContext) {
  const posts = byNewest(await getCollection('blog', ({ data }) => !data.draft));
  return rss({
    title: 'DMARC Analyzer — blog',
    description:
      'Original measurements of email-authentication adoption, engineering notes, and monthly release roundups.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishDate,
      link: `/blog/${post.id}/`,
      author: post.data.author,
      categories: [post.data.type],
    })),
    customData: '<language>en</language>',
  });
}
