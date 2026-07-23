import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// This repo is a GitHub Pages *user/org site* (dmarc-analyzer-net.github.io),
// so it is served from the domain root — `base` stays "/".
//
// `site` is the canonical public URL. It is used for <link rel="canonical">,
// Open Graph URLs, and the generated sitemap. It currently points at the
// github.io URL so everything is correct out of the box. If/when the custom
// domain is wired up (add `public/CNAME` containing `dmarc-analyzer.net`),
// change this to 'https://dmarc-analyzer.net'.
export default defineConfig({
  site: 'https://dmarc-analyzer-net.github.io',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
