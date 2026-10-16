import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { BLOG_DESCRIPTION, BLOG_TITLE } from '../../lib/blog';

// Blog only, deliberately. A feed that also fired on guide and glossary edits
// would be noise to anyone who subscribed for the research and engineering posts.
export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime(),
  );

  return rss({
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    // The channel's <link> is the blog, not the homepage.
    site: new URL('/blog/', context.site).href,
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publishDate,
      link: `/blog/${post.id}/`,
      categories: [post.data.type],
    })),
    customData: '<language>en</language>',
  });
}
