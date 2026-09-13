import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
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
// --- Sitemap <lastmod> -------------------------------------------------------
//
// Added 2026-09-13, after Search Console's URL Inspection showed that 24 of 54
// content pages had not been crawled since late July — including every page
// edited on 2026-08-08. The sitemap carried no <lastmod>, so a rewrite looked
// to Google exactly like an untouched page, and on a young domain with a thin
// crawl budget it was treated as one. The date is the one signal in the
// sitemap that says "come back here".
//
// Source of truth is git, not frontmatter. Only some collections carry
// publishDate/updatedDate at all (glossary has neither), and where they exist
// they are not reliably bumped — the SPF guide was rewritten on 08-08 and still
// said publishDate 07-23. The last commit touching the page's source file is
// the honest answer; frontmatter, where present, acts as a floor so a page can
// never claim to be older than it says it is.
//
// The mapping from route to source is the repo's own convention: a content
// collection at src/content/<dir>/ renders at /<dir>/<id>/, and a static page
// at src/pages/<route>.astro or src/pages/<route>/index.astro. Anything that
// maps to nothing (404, redirects) is emitted without a date rather than with a
// wrong one.
//
// Needs full history. A shallow clone dates every file at the same commit, so
// every page would claim to have changed on every deploy — worse than no
// lastmod. deploy.yml checks out with fetch-depth: 0 for this reason; the
// depth guard below drops the dates entirely if that ever regresses.
const SITE = 'https://dmarc-analyzer.net';
const CONTENT_DIRS = ['guides', 'glossary', 'dmarc-for', 'compare', 'docs', 'rfc'];

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}
const historyIsUsable = Number(git(['rev-list', '--count', 'HEAD']) || 0) > 1;

function sourceFor(url) {
  const path = url.replace(SITE, '').replace(/^\/|\/$/g, ''); // "guides/spf-record-syntax"
  const [dir, ...rest] = path.split('/');
  if (CONTENT_DIRS.includes(dir) && rest.length) {
    for (const ext of ['md', 'mdx']) {
      const f = `src/content/${dir}/${rest.join('/')}.${ext}`;
      if (existsSync(f)) return f;
    }
    return null;
  }
  const base = path === '' ? 'src/pages/index' : `src/pages/${path}`;
  for (const f of [`${base}.astro`, `${base}/index.astro`]) if (existsSync(f)) return f;
  return null;
}

function frontmatterDate(file) {
  if (!file.endsWith('.md') && !file.endsWith('.mdx')) return null;
  const head = readFileSync(file, 'utf8').slice(0, 2000);
  const m = head.match(/^updatedDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m) ?? head.match(/^publishDate:\s*['"]?(\d{4}-\d{2}-\d{2})/m);
  return m ? new Date(`${m[1]}T00:00:00Z`) : null;
}

function lastmodFor(url) {
  const file = sourceFor(url);
  if (!file) return undefined;
  const fm = frontmatterDate(file);
  const iso = historyIsUsable ? git(['log', '-1', '--format=%cI', '--', file]) : '';
  const fromGit = iso ? new Date(iso) : null;
  const d = [fm, fromGit].filter(Boolean).sort((a, b) => b - a)[0];
  return d ? d.toISOString().slice(0, 10) : undefined;
}

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      serialize(item) {
        const lastmod = lastmodFor(item.url);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
    mdx(),
  ],
  // The Entra guide shipped at /docs/entra-id/ before the per-provider pages were
  // nested under the SSO hub. On a static build Astro emits this as a
  // meta-refresh page whose canonical points at the new URL — enough for a path
  // that was live for an afternoon, and cheaper than leaving it 404ing. Every
  // internal link already uses the new URL, so none of them spends a hop here.
  redirects: {
    '/docs/entra-id/': '/docs/single-sign-on/entra-id/',
  },
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
