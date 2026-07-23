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

- [x] (done) Astro project scaffold with `BaseLayout` (title/description/canonical/OG/Twitter), `Header`, `Footer`, `Icon`.
- [x] (done) Home page (`index.astro`) — hero, dashboard mockup, features, how-it-works, comparison, FAQ, CTA.
- [x] (done) Features page (`features.astro`).
- [x] (done) Auto-deploy to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`).
- [x] (done) Auto-generated `sitemap-index.xml` via `@astrojs/sitemap`.
- [x] (done) Add `public/robots.txt` pointing at `sitemap-index.xml` (update host when the custom domain goes live).
- [x] (done) Add `.prose` styles to `global.css` (brand-token-based) — prerequisite before authoring any Markdown content.

## Medium Priority

- [ ] (todo) Build reusable SEO/content components: `JsonLd.astro`, `Breadcrumbs.astro` (BreadcrumbList), `RelatedLinks.astro`, `Faq.astro` (FAQPage), `Callout.astro`, `Cta.astro`, `Toc.astro`.
- [ ] (todo) Add JSON-LD structured data: `Organization` + `SoftwareApplication` on home, `FAQPage` on the FAQ, `Article`/`BreadcrumbList` on content pages.
- [ ] (todo) Set up Astro content collections for `guides` and `glossary` with Zod schemas (title/description length guards) and a `[...slug]` template.
- [ ] (todo) Ship the glossary foundation (Cluster A): DMARC, SPF, DKIM, BIMI, MTA-STS, TLS-RPT, ARC, policy tags (`p=none/quarantine/reject`, `pct`, `sp`, `adkim`, `aspf`, `rua`, `ruf`, `fo`), alignment concepts. 8-10 to start, interlinked.
- [ ] (todo) Ship 3-5 how-to guides (Cluster B): publish first DMARC record, read an aggregate report, move none -> quarantine -> reject, diagnose SPF/DKIM alignment failures, self-host with Docker + PostgreSQL.
- [ ] (todo) Register the site in Google Search Console and submit the sitemap.
- [ ] (todo) Plan a dropdown/mega-menu in `Header.astro` (Guides / Glossary / Tools / Compare) before the flat nav stops scaling.

## Low Priority

- [ ] (todo) Add per-provider setup pages (Cluster C) as programmatic routes from a data file — Google Workspace, Microsoft 365, Zoho, Amazon SES, SendGrid, Mailchimp, Postmark, Mailgun. Keep each substantive.
- [ ] (todo) Write comparison/commercial pages (Cluster E): open-source DMARC tools, self-hosted vs hosted, free analyzers, "vs <incumbent>". Keep the trademark disclaimer and verify every claim.
- [ ] (todo) Add per-industry/persona pages (Cluster D): agencies, MSPs, web-dev shops, e-commerce, SaaS, finance, healthcare. Merge aggressively; split only when advice genuinely differs.
- [ ] (todo) Add pillar pages tying each cluster together (e.g. `/dmarc-guide`) and wire them into nav.
- [ ] (todo) Optimize images via Astro `<Image />` (`sharp`) with descriptive `alt`; add per-page OG images (`astro-og-canvas`).
- [ ] (todo) Add standalone pages: `/about` (open-source/E-E-A-T angle) and any `/pricing` framing (free/self-hosted).
- [ ] (todo) Wire up the custom domain: `public/CNAME` (`dmarc-analyzer.net`) + update `site` in `astro.config.mjs`.

## Parking Lot

- [ ] (todo) Free tools as backlink magnets (Cluster F): DMARC record checker/generator, SPF checker, DKIM lookup — client-side via DNS-over-HTTPS (Cloudflare/Google), kept to a JS island.
- [ ] (todo) Add MDX (`npx astro add mdx`) if guides need interactive/embedded components (callouts, tabbed code, a record checker).
- [ ] (todo) Add Astro `redirects` config entries as/when URLs are renamed (GitHub Pages has no server-side redirects).
- [ ] (todo) Add a blog/changelog collection to announce releases and roadmap progress.
