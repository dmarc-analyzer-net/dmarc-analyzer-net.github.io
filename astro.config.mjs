import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
// Pinned to 4.x on purpose. `astro add mdx` (and `npm i @astrojs/mdx`) resolves
// the `latest` tag, which is 7.x and peers on Astro 7 — and `astro add` skips
// validating the `astro` peer, so it installs a broken tree without complaining.
// 4.3.14 is the newest release peering on Astro ^5, and it pins the same
// @astrojs/markdown-remark 6.3.11 that Astro 5.18 already resolves, so there is
// no second copy of the markdown pipeline. Revisit when Astro itself moves.
import mdx from '@astrojs/mdx';

// This repo is a GitHub Pages *user/org site* (dmarc-analyzer-net.github.io),
// so it is served from the domain root — `base` stays "/".
//
// `site` is the canonical public URL. It is used for <link rel="canonical">,
// Open Graph URLs, and the generated sitemap. The custom domain is live
// (apex ALIAS -> dmarc-analyzer-net.github.io) with `public/CNAME` set.
// `build.format` defaults to "directory", so every page is emitted as
// `<route>/index.html` and GitHub Pages serves it at `/features/` — 301-ing
// `/features` to it. `trailingSlash: "always"` makes that the one canonical
// form everywhere (canonical tags, sitemap, llms.txt, and every internal href),
// so no internal link spends a hop on that redirect. Internal links must
// therefore be written *with* the trailing slash; `scripts/crawl.py` fails CI
// on any that are not.
export default defineConfig({
  site: 'https://dmarc-analyzer.net',
  trailingSlash: 'always',
  integrations: [sitemap(), mdx()],
  // Dev-server only: Vite blocks Host headers not in its allowlist. When
  // previewing over SSH via a hostname (see AGENTS.md), pass the host(s) in
  // DEV_ALLOWED_HOSTS (comma-separated) so no internal hostname is committed.
  vite: {
    server: {
      allowedHosts: (process.env.DEV_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean),
    },
  },
});
