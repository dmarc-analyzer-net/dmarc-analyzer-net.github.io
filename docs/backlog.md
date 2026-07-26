# Backlog

Prioritized list of candidate work for the marketing site. See
[`content-and-seo.md`](content-and-seo.md) for the full content strategy,
page-authoring patterns, and the SEO rationale behind these items.

Status legend: `todo` (not started), `in-progress`, `blocked`, `done`.

**Positioning:** the site markets the *target* product — everything on the app
roadmap — not only what ships today. Feature claims (e.g. forensic/RUF reports,
sending-source geography) may lead the implementation; each corresponds to a
tracked item in the app backlog (`DmarcAnalyzerApp/docs/planning/backlog.md`).
Keep claims truthful to the intended end state.

## High Priority

- [x] (done) **Make the site responsive.** Breakpoints 480/768/1024/1280 per the
      design system's `guidelines/responsive.md`; header collapses to a
      `<details>` drawer below 768px and the nav is edited down to four items
      (Features, How it works, Compare, Resources ▾). Grids, splits, display
      type, gutters and the ink CTA padding all step down. Verified in Chrome:
      the home page went from 929px-in-390px to no page overflow at all, and
      mobile Lighthouse is 100/100/100.
- [x] (done) Move the GitHub Actions off the Node 20 runtime. checkout, setup-node
      and deploy-pages went v4 -> v5, which is the *first* major declaring
      `using: node24` — verified by reading `action.yml` at each tag rather than
      taking the newest. `withastro/action` went v3 -> v6: it is a composite that
      internally pinned `actions/setup-node@v4.4.0` (node20), so bumping only our
      own pins would have left the warning coming from inside it. v5 was the first
      composite with node24 internals, but it dropped `upload-pages-artifact`
      while v6 has it back, so v6 is both current and closest to v3's behaviour.


- [x] (done) Docs sidebar on mobile. Below 1024px it now moves below the article
      under an "All documentation" heading rather than disappearing. A disclosure
      above the article would have pushed the content the reader came for off the
      screen; ordered last it reads as "where to go next", which is how a doc
      page ends anyway.

- [x] (done) Astro project scaffold with `BaseLayout` (title/description/canonical/OG/Twitter), `Header`, `Footer`, `Icon`.
- [x] (done) Home page (`index.astro`) — hero, dashboard mockup, features, how-it-works, comparison, FAQ, CTA.
- [x] (done) Features page (`features.astro`).
- [x] (done) Auto-deploy to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`).
- [x] (done) Auto-generated `sitemap-index.xml` via `@astrojs/sitemap`.
- [x] (done) Add `public/robots.txt` pointing at `sitemap-index.xml` (update host when the custom domain goes live).
- [x] (done) Add `.prose` styles to `global.css` (brand-token-based) — prerequisite before authoring any Markdown content.

## Deployment docs

- [x] (done) **PR 1** — corrected `install.md`, `configuration.md`,
      `upgrading-and-backup.md` and `troubleshooting.md` against what actually ships,
      plus `scripts/verify-docs-snippets.sh`.
- [x] (done) **PR 2** — added `choose-your-deployment.md`, `kubernetes.md` (including
      the backup/restore Kubernetes users had none of), `reverse-proxy.md` and
      `security.md`; homepage and features copy moved from "one image, two modes" to
      a single container, with the hero showing the prebuilt-image quick start
      rather than clone-and-build.
- [ ] (blocked on SEO) **Kubernetes on the comparison pages.** Deliberately not
      written yet. A Helm chart is a real differentiator against `parsedmarc` and
      `cry-inc/dmarc-report-viewer`, neither of which has one, but the OSS-alternative
      cluster turned out to have no search volume once checked — so the angle needs
      keyword work in the private `seo` repo before copy is written here.

## Medium Priority

- [x] (done) Build reusable SEO/content components: `JsonLd.astro`, `Breadcrumbs.astro` (BreadcrumbList), `RelatedLinks.astro`.
- [x] (done) Build `Cta.astro` — closing call-to-action band, wired into the guide, provider, and comparison templates (glossary intentionally omits it).
- [ ] (todo) Build remaining content components: `Faq.astro` (FAQPage), `Callout.astro`, `Toc.astro` — need MDX or `.astro` usage since they can't embed in plain Markdown.
- [x] (done) Add JSON-LD structured data: `Organization` + `WebSite` + `SoftwareApplication` + `FAQPage` on home; `Article` + `BreadcrumbList` on guides; `DefinedTerm` + `BreadcrumbList` on glossary.
- [x] (done) Set up Astro content collections for `guides` and `glossary` with Zod schemas (title/description length guards), `[...slug]` templates, and listing index pages.
- [~] (in-progress) Ship the glossary foundation (Cluster A): initial 6 terms live (DMARC, SPF, DKIM, alignment, aggregate report/RUA, policy). Still to add: BIMI, MTA-STS, TLS-RPT, ARC, remaining policy tags (`pct`, `sp`, `adkim`, `aspf`, `ruf`, `fo`).
- [~] (in-progress) Ship how-to guides (Cluster B): initial 3 live (publish first record, read an aggregate report, monitoring -> enforcement). Still to add: diagnose SPF/DKIM alignment failures, self-host with Docker + PostgreSQL, manage many client domains.
- [x] (done) Register the site in Google Search Console (Domain property, DNS TXT) and submit `sitemap-index.xml` — accepted, 0 errors. A service account + `scripts/seo/gsc.sh` in the private `seo` repo pulls Search Analytics; impressions accrue over the coming weeks.
- [ ] (todo) Run a technical SEO crawl of `dmarc-analyzer.net` with [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/user-guide/general/#linux) and fix what it finds. Install on Linux by downloading the `.deb` and `sudo apt-get install ./screamingfrogseospider_<version>_amd64.deb`, then run `screamingfrogseospider`. The free version's 500-URL cap is ample (the site is well under that), so a one-off GUI crawl costs nothing; headless/CLI (`--crawl --headless --export-tabs`), saved crawls, scheduling, JS rendering and the GSC/PSI integrations are licence-only (£199/yr), so only buy in if we want this automated in CI. Look for: broken internal links, redirect chains, orphan pages, duplicate/missing titles + meta descriptions, missing/duplicate H1s, thin pages, canonical and hreflang issues, oversized images, and pages missing from the sitemap.
- [ ] (todo) Plan a dropdown/mega-menu in `Header.astro` — the flat nav now carries Features, Guides, Glossary, Setup, Compare, Tools, How it works and Docs, which is at the limit of what fits; group before adding more.

## Low Priority

- [~] (in-progress) Add per-provider setup pages (Cluster C) under `/dmarc-for` (content collection + shared template + index): Google Workspace, Microsoft 365, and GoDaddy are live. Still to add: Cloudflare, Amazon SES, SendGrid, Mailchimp, Mailgun, Klaviyo, Zoho, Postmark — plus companion "why <provider> is failing DMARC" pages where the demand exists.
- [x] (done) Write comparison/commercial pages (Cluster E) under `/compare`: five head-to-heads (parsedmarc, dmarcian, EasyDMARC, PowerDMARC, Valimail), two roundups (best DMARC monitoring tools, open-source & self-hosted), plus the `/free-dmarc-analyzer` capture page. Template auto-appends the trademark disclaimer; claims limited to durable structural facts.
- [ ] (todo) Add per-industry/persona pages (Cluster D): agencies, MSPs, web-dev shops, e-commerce, SaaS, finance, healthcare. Merge aggressively; split only when advice genuinely differs.
- [ ] (todo) Add pillar pages tying each cluster together (e.g. `/dmarc-guide`) and wire them into nav.
- [ ] (todo) Optimize images via Astro `<Image />` (`sharp`) with descriptive `alt`; add per-page OG images (`astro-og-canvas`).
- [ ] (todo) Add standalone pages: `/about` (open-source/E-E-A-T angle) and any `/pricing` framing (free/self-hosted).
- [x] (done) Wire up the custom domain: `public/CNAME` (`dmarc-analyzer.net`) + `site` in `astro.config.mjs` + sitemap host in `robots.txt`; apex ALIAS -> `dmarc-analyzer-net.github.io`.

## Parking Lot

- [~] (in-progress) Free tools as backlink magnets (Cluster F) under `/tools`: the DMARC aggregate-report (RUA) analyzer is live — fully client-side, parses pasted XML plus `.gz`/`.zip`, nothing uploaded. Still to add: DMARC record checker + generator, SPF checker, DKIM lookup — client-side via DNS-over-HTTPS (Cloudflare/Google), kept to a JS island.
- [ ] (todo) Add MDX (`npx astro add mdx`) if guides need interactive/embedded components (callouts, tabbed code, a record checker).
- [ ] (todo) Add Astro `redirects` config entries as/when URLs are renamed (GitHub Pages has no server-side redirects).
- [ ] (todo) Add a blog/changelog collection to announce releases and roadmap progress.
