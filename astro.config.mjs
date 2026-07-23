import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// This repo is a GitHub Pages *user/org site* (dmarc-analyzer-net.github.io),
// so it is served from the domain root — `base` stays "/".
//
// `site` is the canonical public URL. It is used for <link rel="canonical">,
// Open Graph URLs, and the generated sitemap. The custom domain is live
// (apex ALIAS -> dmarc-analyzer-net.github.io) with `public/CNAME` set.
export default defineConfig({
  site: 'https://dmarc-analyzer.net',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
