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
- [x] (done) **Kubernetes on the comparison pages.** The SEO assessment came back
      "distribution, not keywords": `dmarc kubernetes` sits below terms already at
      10/mo, and no hosted competitor ranks for a single deployment keyword — so this
      is one row in the tables that already exist, not a page. Verified before
      claiming it: none of parsedmarc, dmarc-report-viewer or dmarc-report-converter
      ships a Helm chart, and none appear on Artifact Hub.
- [ ] (todo) **Two directory listings**, which the same assessment found are worth
      more than any page here. Artifact Hub returns two packages for "dmarc", both
      `dmarc2logstash`, both 0 stars. `awesome-selfhosted` has no DMARC report
      analyzer at all — DMARC appears twice, both times as a mail-server feature.
      Tracked in the `seo` repo playbook; the work itself is a chart-metadata change
      and an upstream PR.

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

## Content accuracy (from the July 2026 docs review)

A full review of every content page against the RFCs and the shipped code. The
[deployment-docs errors](#deployment-docs), the `pct=` fallback rule, the
competitor claims, and the missing console/monitoring/data-protection pages were
fixed at the time (PRs #37, #38, #40–43). What follows is what was found and
*not* fixed, ordered by how much harm it does. Every item was verified against a
primary source; where a line number is given it was accurate in July 2026.

### Corrections — statements that are wrong

- [ ] (todo) **`dmarc-for/google-workspace.md` inverts Google's DKIM behaviour.**
      Line ~56 says Workspace "does **not** sign with DKIM until you generate a
      key". It always signs — with a Google-owned default key and
      `d=<domain>.<datestamp>.gappssmtp.com`, which is valid but never *aligns*.
      The troubleshooting row that follows ("`dkim=none` on all mail → Start
      authentication was never clicked") is therefore wrong about the symptom
      too: you see `dkim=pass` with a `gappssmtp.com` domain, conclude DKIM is
      fine, and never find the alignment problem. `microsoft-365.md:124` already
      handles its `onmicrosoft.com` equivalent correctly — copy that treatment.
- [ ] (todo) **`glossary/mta-sts.md:16` names the wrong actor.** "MTA-STS makes
      receivers reject that fallback" — it is the *sending* MTA that fetches the
      policy and refuses to deliver (RFC 8461 §5). The receiver publishes; it
      cannot enforce. Line 10 of the same page gets it right, so the page
      contradicts itself six lines apart.
- [ ] (todo) **`guides/fix-dmarc-failure.md` has the forwarding mechanism
      backwards** (~line 86): it says forwarding "changes the envelope, which
      breaks SPF". Plain forwarding breaks SPF precisely because it does *not* —
      the forwarder relays the original `MAIL FROM` from its own unlisted IP
      (RFC 7208 §10.3). Forwarders that *do* rewrite (SRS) make SPF pass for
      their domain, which then fails alignment. A reader who believes the stated
      mechanism concludes SRS fixes DMARC.
- [ ] (todo) **`glossary/dmarc.md:3` — the meta description says DMARC acts on
      mail that "fails SPF and DKIM".** Mail can pass both and still fail DMARC
      through non-alignment; the page body gets this right. This string is the
      `<meta description>`, the index card *and* the `DefinedTerm` JSON-LD, so
      the wrong version is the one that reaches search results.
- [ ] (todo) **`guides/fix-dmarc-failure.md` links "ARC" to `/glossary/dkim/`.**
      There is no ARC entry; the link resolves but lands somewhere that never
      mentions the term. Either write the entry (below) or unlink.
- [ ] (todo) **`dmarc-for/godaddy.md` models the mistake it warns about.** Lines
      26–27 tell readers to remove the stale `secureserver.net` include after
      migrating to GoDaddy-resold M365; line ~57 then shows a combined example
      stacking both. Keeping it authorises GoDaddy's whole shared mail
      infrastructure to send as the domain.
- [ ] (todo) **`dmarc-for/godaddy.md:129` overstates what forwarding
      overwrites.** GoDaddy domain forwarding manages the root `A` and `www`
      CNAME, not TXT records — so "records vanish" sends readers chasing
      forwarding instead of the doubled-hostname mistake the same page documents
      correctly.
- [ ] (todo) **`guides/dmarc-policy-not-enabled.md:43` claims only `p=reject`
      clears the warning.** The warning is literally "Quarantine/**Reject**
      policy not enabled"; `p=quarantine` satisfies it. Same page, line ~89,
      promises cPanel instructions under `/dmarc-for/` — only Google Workspace,
      Microsoft 365 and GoDaddy exist.
- [ ] (todo) **`guides/no-dmarc-record-found.md:86` contradicts itself in one
      sentence** — "DMARC lookups do **not** walk up to the parent domain" and
      then describes the receiver doing exactly that. RFC 7489 §6.6.3 defines one
      step to the organizational domain; it is *checkers* that report on the
      exact name queried.

### Omissions — true as far as they go

- [ ] (todo) **The `_report._dmarc` external-destination rule is missing from
      all three `/dmarc-for` pages.** Every reader of those pages will point
      `rua=` at an analyzer on another domain, which RFC 7489 §7.1 requires the
      destination domain to authorise. `guides/no-dmarc-record-found.md:104`
      covers it correctly, so the provider pages are the outlier — and this is
      the difference between our own product receiving data and silently
      receiving none. Add the agency wildcard form
      (`*._report._dmarc.agency.com`) while there.
- [ ] (todo) **`guides/spf-record-syntax.md` omits `exists` from both the
      mechanism table and the lookup-counting list** (RFC 7208 §4.6.4 names
      `include`, `a`, `mx`, `ptr`, `exists` and `redirect`). It also omits the
      separate 10-name sub-limits on `mx`/`ptr` — a domain with 12 MX hosts
      permerrors while showing a term count of 1. `fix-dmarc-failure.md:125`
      says "under 10" where the limit is 10.
- [ ] (todo) **No page gives DKIM's DNS location.** `guides/spf-dkim-dmarc.md`
      is the foundational explainer and never states
      `<selector>._domainkey.<domain>` — the word "selector" does not appear on
      it at all, though `/glossary/dkim-selector/` exists and no guide links to
      it. The same page overstates DKIM as proving the message "came from your
      domain"; RFC 6376 §1 is explicit that it asserts responsibility, not origin.
- [ ] (todo) **`sp=` inheritance is stated on three pages and all three omit the
      default** — absent `sp=`, subdomains inherit `p=`
      (`dmarc-policy-not-enabled.md:82`, `no-dmarc-record-found.md:88`,
      `fix-dmarc-failure.md:96`). `np=` (RFC 9091) appears nowhere on the site.
- [ ] (todo) **No page mentions the Gmail/Yahoo/Outlook bulk-sender
      requirements** (Feb 2024 onward) — the strongest present-day reason a
      reader needs any of this, absent from all eight guides.
- [ ] (todo) **`glossary/bimi.md` frames the VMC as a Gmail quirk** (line ~65)
      when every major provider that displays BIMI requires one, and never
      mentions that **Outlook does not support BIMI at all** — which for a B2B
      sender changes the whole cost/benefit.
- [ ] (todo) **`glossary/dmarc-aggregate-report.md` omits the `_report._dmarc`
      requirement, gzip delivery, and `ri=` being advisory.**

### New pages worth writing

- [ ] (todo) **A DMARC tag reference.** `fo`, `ruf`, `ri`, `rf` and `np` appear
      **nowhere in the content tree**; `sp`, `adkim` and `aspf` are scattered
      across four pages at differing accuracy. One "every tag, its default, and
      whether you need it" page fixes several items above at once — highest-value
      single addition.
- [ ] (todo) **Glossary entries for ARC and TLS-RPT.** Both are named as
      backlog items already; ARC is the mislinked term above, and
      `mta-sts.md:69` devotes a section to TLS-RPT with nothing to link to.
- [ ] (todo) **A forwarding / mailing-lists / ARC guide.** Currently one
      paragraph with a broken link. Covers why lists break DKIM, From-rewriting,
      what ARC does and doesn't buy, and why forwarding failures must not gate
      enforcement — the enforcement guide's exit criterion is otherwise
      unachievable.
- [ ] (todo) **Cloudflare under `/dmarc-for`** — a *dependency* of the existing
      three rather than a sibling: proxying a `selector1._domainkey` CNAME
      breaks M365 DKIM outright, and Cloudflare's SPF flattening interacts with
      the 10-lookup advice on all three pages.

### Structure

- [ ] (todo) **The four content collections barely link to each other.** From a
      sweep of 205 internal links: **docs → glossary: 0** (no doc page defines
      *alignment*, *RUA* or *selector*); **guides → docs: 0** (six of eight
      guides link to the marketing home page instead); **compare → docs: 0**, and
      compare is a pure sink nothing links into. The educational corpus already
      ranks and dead-ends — this is the highest-leverage SEO *and* usability
      change available.
- [ ] (todo) **"Related links" on guides and compare are `all.slice(0, 3)`** —
      collection order, not topical relatedness. Only the glossary uses curated
      `related` frontmatter.
- [ ] (todo) **Near-orphans with no editorial inbound links:**
      `/docs/security/`, `/glossary/bimi/`, `/glossary/mta-sts/`,
      `/dmarc-for/godaddy/`, `/brand/`, and `/free-dmarc-analyzer/` (absent from
      nav *and* footer).
- [ ] (todo) **Docs have no version marker.** A reader on `0.2.0` and one on
      `edge` see identical pages, and `README.md` explicitly tells people `edge`
      is unreleased. Consider an "applies to" field or a docs-version selector.
- [ ] (todo) **`SECTION_ORDER` is duplicated in four files**
      (`DocsSidebar.astro`, `docs/index.astro`, `docs/[...slug].astro`,
      `lib/llms.ts`) — it taxes every structural change; adding the "Using the
      console" section meant editing all four.

## Low Priority

- [~] (in-progress) Add per-provider setup pages (Cluster C) under `/dmarc-for` (content collection + shared template + index): Google Workspace, Microsoft 365, and GoDaddy are live. Still to add: Cloudflare, Amazon SES, SendGrid, Mailchimp, Mailgun, Klaviyo, Zoho, Postmark — plus companion "why <provider> is failing DMARC" pages where the demand exists.
- [x] (done) Write comparison/commercial pages (Cluster E) under `/compare`: five head-to-heads (parsedmarc, dmarcian, EasyDMARC, PowerDMARC, Valimail), two roundups (best DMARC monitoring tools, open-source & self-hosted), plus the `/free-dmarc-analyzer` capture page. Template auto-appends the trademark disclaimer; claims limited to durable structural facts.
- [ ] (todo) Add per-industry/persona pages (Cluster D): agencies, MSPs, web-dev shops, e-commerce, SaaS, finance, healthcare. Merge aggressively; split only when advice genuinely differs.
- [ ] (todo) Add pillar pages tying each cluster together (e.g. `/dmarc-guide`) and wire them into nav.
- [ ] (todo) Optimize images via Astro `<Image />` (`sharp`) with descriptive `alt`; add per-page OG images (`astro-og-canvas`).
- [ ] (todo) Add standalone pages: `/about` (open-source/E-E-A-T angle) and any `/pricing` framing (free/self-hosted).
- [x] (done) Wire up the custom domain: `public/CNAME` (`dmarc-analyzer.net`) + `site` in `astro.config.mjs` + sitemap host in `robots.txt`; apex ALIAS -> `dmarc-analyzer-net.github.io`.

## Parking Lot

- [~] (in-progress) Free tools as backlink magnets (Cluster F) under `/tools`.
      Live: the aggregate-report (RUA) analyzer (client-side XML/`.gz`/`.zip`,
      nothing uploaded) and the **record checker** (`dmarc checker` 6,600/mo,
      `dmarc lookup` 1,600/mo) — DNS-over-HTTPS against Cloudflare with a Google
      fallback, validating every RFC 7489 tag and, unusually, verifying external
      `rua`/`ruf` destinations against their `_report._dmarc` authorization
      records. That last check is the differentiator: it is the failure mode that
      produces a perfect-looking record and no reports, and nothing bounces to
      tell you. Still to add: record generator, SPF checker, DKIM lookup.
- [ ] (todo) Add MDX (`npx astro add mdx`) if guides need interactive/embedded components (callouts, tabbed code, a record checker).
- [ ] (todo) Add Astro `redirects` config entries as/when URLs are renamed (GitHub Pages has no server-side redirects).
- [ ] (todo) Add a blog/changelog collection to announce releases and roadmap progress.
