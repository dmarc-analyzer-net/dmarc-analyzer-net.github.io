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
- [x] (done) **Two directory listings**, which the same assessment found are worth
      more than any page here. Both were done; one landed. **Artifact Hub**: the
      chart is live as `dmarc-analyzer` with the **Verified publisher** badge, the
      `artifacthub.io/*` annotations carrying category/links/screenshot, and CI
      pushing `artifacthub-repo.yml` to the OCI namespace on each tag — the two
      `dmarc2logstash` packages it shares the "dmarc" query with are still at 0
      stars. **awesome-selfhosted**: PR #2792 proposed a new
      `Communication - Email - Security & Reporting` tag seeded with all four
      self-hostable analyzers (ours, parsedmarc, dmarc-report-viewer,
      dmarc-report-converter), since their rule allows a new tag at three
      referencing projects and no existing category fits. A maintainer closed it
      unmerged within a day, without comment or review, so the reason is unknown;
      the branch and fork survive. A plain `Miscellaneous` entry was never tried
      and remains the fallback — worth less, because category browsing is most of
      what that listing buys. Two compose-based app stores went out alongside and
      are still open: Umbrel getumbrel/umbrel-apps#5929 and CasaOS
      IceWhaleTech/CasaOS-AppStore#988. Full state in
      `DmarcAnalyzerApp/docs/ops/directory-listings.md`.

## Medium Priority

- [x] (done) Build reusable SEO/content components: `JsonLd.astro`, `Breadcrumbs.astro` (BreadcrumbList), `RelatedLinks.astro`.
- [x] (done) Build `Cta.astro` — closing call-to-action band, wired into the guide, provider, and comparison templates (glossary intentionally omits it).
- [x] (done) **Build the remaining content components — `Toc.astro`, `Faq.astro`,
      `Callout.astro` — and install MDX** (which retires the Parking Lot item).

      **The version pin is the finding.** `npx astro add mdx` resolves the `latest`
      dist-tag, which is `@astrojs/mdx@7.x` peering on Astro 7 while this site is on
      Astro 5.18.2 — and `astro add` explicitly skips validating the `astro` peer, so
      it installs a broken tree without complaining. `mdx@4` fails too (the registry
      404s a bare major). `4.3.14` is the newest release peering on Astro ^5, and it
      pins the same `@astrojs/markdown-remark@6.3.11` that Astro 5.18 already
      resolves, so there is no second copy of the markdown pipeline. All five
      collection globs went to `**/*.{md,mdx}` in one edit: `**/*.md` does not match
      `.mdx`, and the failure is silent — the entry drops out of the collection, no
      page is emitted, and the crawler cannot miss what was never linked.

      `Toc.astro` is the inline TOC that was already in the docs template, extracted
      and reused on guides and provider pages (28 pages have one now, up from 17).
      It keeps the h2-only flat list as the default and gained the *ability* to nest
      h3s, which makes the comment in the docs template true rather than aspirational
      — only one guide has any h3 at all, so nesting is switched off until someone
      reviews it in a browser. Deliberately not wrapped in `<nav>`: the crawler
      excludes nav text from word counts, so a TOC in a landmark would quietly
      subtract 10–20 words from every page it appears on.

      `Faq.astro` emits the accordion and the `FAQPage` JSON-LD from one array,
      which removes the hand-kept mirror on the home page — and that mirror had
      already drifted, exactly as the comment above it feared: the schema said "It is
      how you stop…" with a curly apostrophe where the page said "It's how you
      stop…" with a straight one. Search engines were reading the copy nobody
      proofreads. The on-page wording won. The JSON-LD now renders inline rather than
      in `<head>`, because `slot="head"` only resolves for a direct child of
      `BaseLayout` — the same reason `Breadcrumbs` already emits its
      `BreadcrumbList` inline.

      `Callout.astro` ships three variants, not four: the palette has exactly three
      admonition-grade surface pairs, and a "tip" green is indistinguishable from
      `note` because `--green-100` and `--teal-100` are the same hex. Its CSS lives
      in `global.css` rather than a scoped block — it has to, since scoped styles
      never reach slotted markdown children and the box must reset `.prose p`'s
      trailing margin. `note` reproduces `.prose blockquote` exactly, so converting a
      blockquote is a no-visual-change edit.

      Only **one** file was converted to `.mdx` — `from-monitoring-to-enforcement`,
      for the `p=reject; pct=25` warning, which is the most consequential callout on
      the site. The other ~90 blockquotes stay as they are (see below). One rider was
      required and is easy to miss: `entry.body` is raw file text, so `/llms-full.txt`
      would have published `import Callout from …` and the JSX tags as if they were
      prose. `src/lib/llms.ts` now strips MDX scaffolding. The crawler cannot catch
      that class of bug — llms-full.txt is neither HTML nor in the sitemap.

      Verified structurally, not visually (this box has no browser): MDX with zero
      `.mdx` files is byte-inert across all 64 pages; the Toc extraction changes no
      docs output; every TOC anchor on all 28 pages resolves to an `id` in the same
      page (the crawler does *not* validate fragments, so nothing else would have
      caught a broken one); the FAQ JSON-LD differs from the previous build in
      exactly the one drifted string; and the converted guide keeps its URL, renders
      8 code spans and 2 emphases inside the callout, and carries
      `<title>Warning</title>` so the variant is not conveyed by colour alone.
- [ ] (todo) **Convert the warning-shaped blockquotes to `<Callout variant="warning">`,
      file by file.** There are ~91 blockquotes across 15 content files, all using the
      `> **Bold lead:** …` convention, and they currently carry every admonition tone
      through one teal treatment. Each conversion is a rename to `.mdx` plus an import,
      so this is worth doing per-file as those files are edited for other reasons rather
      than as one sweep. `note` was built to match the existing blockquote exactly, so a
      converted file looks identical until the variant is changed deliberately.
- [ ] (todo) **The build is not reproducible.** `LogoMark.astro` generates a random
      gradient id per instance, so every build emits different HTML for all 64 pages
      even with no source change. It cost a verification gate during the MDX work —
      "did this change any output?" is unanswerable without normalising the ids away
      first. Deriving the id from something stable (the page path, or a counter) would
      make byte-comparison between builds a usable check.
- [x] (done) **Make the decorative copy icons copy.** Both are real buttons now,
      wired through `src/lib/clipboard.ts`. `Terminal.astro` copies its `cmd`
      lines only, without the `$` this component adds.

      Reported by a reader, and the dead button turned out to be the *smaller*
      half of it: the hero advertised `curl -fsSL -o compose.yml … && docker
      compose up -d`, which could never have worked. `compose.yml` declares
      `DMARC_ENCRYPTION_KEY` with `${VAR:?message}`, so `docker compose up -d`
      exits 1 before starting anything when `.env` is absent — confirmed by
      running it. The hero and the terminal now carry all three commands, and
      `TerminalLine.copyText` lets a line display an abbreviated URL while the
      clipboard gets the runnable one.

      The rule worth keeping: **what is copied must be what runs.** All three
      copy paths were checked against it — async API, the `execCommand`
      fallback, and the last-resort select, which expands the abbreviated
      preview to the full command first (and needs `white-space: pre-wrap`, or
      the newlines collapse and the selection is one unrunnable line).
- [x] (done) Add JSON-LD structured data: `Organization` + `WebSite` + `SoftwareApplication` + `FAQPage` on home; `Article` + `BreadcrumbList` on guides; `DefinedTerm` + `BreadcrumbList` on glossary.
- [x] (done) Set up Astro content collections for `guides` and `glossary` with Zod schemas (title/description length guards), `[...slug]` templates, and listing index pages.
- [x] (done) **Ship the glossary foundation (Cluster A): 12 terms live** — DMARC,
      SPF, DKIM, DKIM selector, alignment, aggregate report (RUA), policy,
      quarantine vs reject, BIMI, MTA-STS, and now **ARC** and **TLS-RPT**. The two
      new ones existed as dangling references: `fix-dmarc-failure.md` linked the word
      "ARC" to `/glossary/dkim/` (a live link that landed somewhere never mentioning
      the term), and `mta-sts.md` devoted a section to TLS-RPT with nothing to point
      at. Both now resolve.

      The per-tag entries this item used to list (`pct`, `sp`, `adkim`, `aspf`,
      `ruf`, `fo`) were **not** written as glossary entries. They are one guide
      instead — see the tag reference below. Six definitions of terms nobody searches
      for individually would have been six thin pages, and `adkim`/`aspf` were
      already covered correctly on `/glossary/dmarc-alignment/`.

      ARC is the entry worth reading twice, because it is usually invoked as a reason
      to postpone enforcement. Its longest section is what ARC *doesn't* buy: there is
      nothing to publish, it is not a DMARC pass, honouring a chain is entirely the
      receiver's choice, and the current DMARC standard states plainly that no such
      method has achieved wide adoption. Which makes the operational point the
      enforcement guide needed: forwarding failures never reach zero, so "wait until
      nothing fails" was never an achievable exit criterion.
- [x] (done) **Ship how-to guides (Cluster B): 10 live.** Publish your first record,
      read an aggregate report, monitoring → enforcement, SPF/DKIM/DMARC explained,
      SPF record syntax, the two error-message pages, plus the two added here:
      **[DMARC record tags](/guides/dmarc-record-tags/)** and **[DMARC for many
      client domains](/guides/dmarc-multiple-client-domains/)**.

      Two of the three items this line used to list were already done or not worth
      doing. **"Diagnose SPF/DKIM alignment failures" already exists** as
      `fix-dmarc-failure.md` — five numbered causes and a diagnosis section; the line
      was stale, not outstanding. **"Self-host with Docker + PostgreSQL" is dropped**:
      `/docs/install/`, `/docs/choose-your-deployment/` and
      `/self-hosted-dmarc-monitoring/` cover it between them, and the `seo` repo's
      content plan assessed deployment keywords as effectively zero volume. Rather
      than write a fourth version competing with the docs, the compare pages now link
      *into* those docs — see the Structure item below.

      The agency guide has no keyword data at all (nobody searches for this), so it
      is built as conversion and link-graph content: it owns the DNS and process half
      and hands the product half to the docs by deep link, rather than restating
      `clients-users-and-audit.md`.

      Its most useful paragraph is a trap nothing else on the site documents.
      Authorising external reporting per client *and* by wildcard at the same time
      breaks the wildcard: publishing `client1.com._report._dmarc.agency.com` creates
      an intermediate node at `com._report._dmarc.agency.com`, and wildcard synthesis
      stops at the closest existing node, so every *other* `.com` client silently
      stops being authorised. Verified against RFC 4592, whose own worked example is
      the same shape — a query for `_telnet._tcp.host1.example.` gets no wildcard
      synthesis "because `_tcp.host1.example.` exists (without data)".
- [x] (done) Register the site in Google Search Console (Domain property, DNS TXT) and submit `sitemap-index.xml` — accepted, 0 errors. A service account + `scripts/seo/gsc.sh` in the private `seo` repo pulls Search Analytics; impressions accrue over the coming weeks.
- [x] (done) **Technical SEO crawl — `scripts/crawl.py`, not Screaming Frog.** The
      free tier is GUI-only and the headless CLI is licence-gated (£199/yr), so the
      audit would have been a screenshot nobody could repeat, on a machine with no
      desktop. The script covers the same check-set from standard-library Python and
      runs on every pull request against `astro preview`, so a regression fails the
      PR instead of shipping: broken internal links with "linked from" attribution,
      links pointing at a redirect, redirect chains, missing/duplicate/over-length
      titles and descriptions, missing and multiple H1s, canonical path mismatches,
      `noindex`, thin content, images missing `alt`, and sitemap coverage both ways.

      Two checks from the list above were missing and were added here. **Oversized
      images**, at Screaming Frog's own 100 KB threshold, which earned its keep
      immediately: `og.png` is 104 KB and sits on all 64 pages. The OG image needed
      the same treatment the sitemap and canonical checks already have — Astro
      resolves it against `site`, so the markup carries a production URL, and
      fetching that verbatim would have made every CI run reach the live internet
      and audit the deployed asset instead of the one in the build. It is rebased
      onto whatever root is being crawled, which is also why the image check can run
      under `--skip-external`.

      **Editorial inbound links**, the more useful of the two. The orphan check had
      been reporting zero for a reason that looked like a pass and wasn't: links are
      collected before the `nav`/`footer` exclusion that applies to word counts, so a
      page linked only from the global nav counted as linked. Zoning each link by the
      element it sits in — `nav`, `footer`, `aside` vs article body — reproduces the
      hand-made sweep in [Structure](#structure) as a measurement. It needs two
      exemptions to be quiet, and neither is a hardcoded list: a collection index
      links its own children by construction, and a target sitting in a `<nav>` on
      90%+ of pages is a declared hub. Keyed on `<nav>` alone, deliberately — count
      the footer as an endorsement and `/brand/`, which is footer-linked on all 64
      pages and nothing else, stops being a finding. With both, it flags six pages
      and nothing else. It also prints the cross-collection prose-link matrix, which
      is what turns the 205-link manual sweep into a number that can be re-checked.

      Not modelled, deliberately: **hreflang** — one locale, no alternates, so the
      check could only ever report zero; **click depth** — every page is one or two
      hops from home through the nav, so the number carries no information;
      **response times** — CI crawls a local preview with a politeness delay, so it
      would measure the runner; **structured-data validation** — `JsonLd.astro`
      emits `JSON.stringify(schema)`, so the hand-authoring errors a JSON parse
      catches are impossible by construction; **Core Web Vitals** — needs a browser.

      Production is a separate matter, because CI crawls the preview: outbound links
      are skipped there and drift between `dist/` and what Pages serves is invisible.
      `.github/workflows/seo-audit.yml` runs the full crawl against production on
      `workflow_dispatch`. No `schedule:`, deliberately — a site that changes a few
      times a week does not need a cron job producing mail nobody reads. First
      production run (2026-07-28, the first time the outbound links had ever been
      checked): **64 pages, 12 of 13 outbound links checked, 0 errors, 5 warnings**
      (4 thin pages + og.png), 6 editorial-orphan notes.
- [x] (done) **Header nav grouped under `Resources ▾`** — shipped in #23 alongside
      the responsive work, before this item was re-read. Features / How it works /
      Compare stay in the top row; Docs, Guides, Glossary, Setup and Tools moved into
      a `<details>` dropdown, which is exactly the structure the design system
      prescribes in `guidelines/responsive.md` ("a flat eight-item row also reads as
      an unranked list"). Both the dropdown and the mobile drawer are `<details>`, so
      the header still ships no JavaScript; the trade-off, documented in the
      component, is that neither closes on an outside click.

      It should not become a mega-menu. The design system asks for a grouped list and
      argues the point on silhouette; a multi-column panel with per-item descriptions
      is a different drawing, and eight destinations don't need one.
      `content-and-seo.md` said "dropdown / mega-menu" too — corrected there.

      Three things the grouping did not fix, all recorded under
      [Structure](#structure) because they are the same link-graph problem: the
      capture pages have no path from nav *or* footer (`/free-dmarc-analyzer/`,
      `/parsedmarc-alternative/`, `/self-hosted-dmarc-monitoring/` are chrome-linked
      from 0 of 64 pages, so they depend entirely on search — and they are the pages
      the SEO plan most wants ranking); `Footer.astro` is one flat row of five links
      carrying none of Guides, Glossary, Setup, Tools or Compare; and `current`
      accepts `'home'`, which `index.astro` passes, but no nav item carries that key,
      so it highlights nothing.
- [ ] (todo) **No `:focus-visible` styling anywhere.** `grep -rE
      "focus-visible|:focus|prefers-reduced-motion" src/` returns nothing, so
      `--focus-ring` at `global.css:45` is defined and referenced nowhere and every
      interactive element falls back to the browser default outline — including the
      two `<summary>` triggers, whose default marker `global.css:110` has already
      removed site-wide. Lighthouse reports accessibility 100 because it does not
      test this. While in there: `.lift:hover` translates, `.btn-primary:active`
      scales and the header chevron rotates, none of it behind
      `prefers-reduced-motion`.
- [ ] (todo) **`crawl.py` counts `<aside>` text toward `word_count`.** `Cta.astro`
      and `RelatedLinks.astro` are asides whose boilerplate is identical on every
      guide, provider and compare page, so it inflates each of them by 5–8 words.
      Excluding it is the right call on the merits but recalibrates the
      thin-content threshold for the whole site, so it wants to be its own change
      with its own before/after — not folded into a content PR. Measured effect
      today: `/glossary/dkim/` 134 → 126, `/glossary/spf/` 148 → 142,
      `/glossary/dmarc-alignment/` 143 → 138. No page changes verdict.

## Content accuracy (from the July 2026 docs review)

A full review of every content page against the RFCs and the shipped code. The
[deployment-docs errors](#deployment-docs), the `pct=` fallback rule, the
competitor claims, and the missing console/monitoring/data-protection pages were
fixed at the time (PRs #37, #38, #40–43). What follows is what was found and
*not* fixed, ordered by how much harm it does. Every item was verified against a
primary source; where a line number is given it was accurate in July 2026.

### Corrections — statements that are wrong

- [x] (done) **DMARC has a new specification and the site cited the old one.**
      Found while verifying the tag reference against RFC 7489, which turns out to be
      obsolete: **DMARCbis published in May 2026 as RFC 9989** (core, Proposed
      Standard) with **RFC 9990** (aggregate reporting) and **RFC 9991** (failure
      reporting), together obsoleting RFC 7489 *and* RFC 9091. The July 2026 accuracy
      review below was written against the superseded documents throughout.

      What actually changed, verified against RFC 9989 §4.7 and Appendix C.5:

      - **Removed: `pct`, `ri`, `rf`.** `pct` went because receivers implemented
        values other than 0 and 100 inconsistently; the two values that did work are
        replaced by **`t=y`/`t=n`** (test mode — apply one level below the stated
        policy, or apply it). `rf` had only ever had one legal value. `ri` was
        advisory and everyone sent daily reports anyway.
      - **Added: `t`, `psd`** (a flag for public-suffix operators), and **`np`**,
        promoted out of the experimental RFC 9091.
      - **`p` is now RECOMMENDED, not required** — an otherwise-valid record with no
        `p` is treated as `p=none` rather than being invalid.
      - The `!10m` maximum-report-size suffix in a reporting URI is gone.

      **Both tools and all the prose are done.** The tools were the urgent half — they
      gave verdicts on live domains, calling `t=`/`psd=` unrecognised while blessing
      three removed tags; see the transition guide under
      [New pages worth writing](#new-pages-worth-writing) for what changed and how it
      was verified. The prose was less urgent, because `pct` is still honoured by
      deployed receivers, so the advice worked even where the tag had left the spec.

      1. **The `pct` mentions** now carry the deprecation wherever a reader might act
         on them: the canonical `#what-pct-actually-does` section that four pages
         deep-link into, the ramp step in `dmarc-policy-not-enabled.md` that actually
         *recommends* it, and `glossary/dmarc-policy.md`. Two got a `t=` clause rather
         than a caveat: `glossary/bimi.md`, because `t=y` disqualifies a domain from
         BIMI for exactly the same reason a sub-100 `pct` does, and that was a real gap
         rather than a consistency fix. Left alone deliberately:
         `tools/dmarc-report-analyzer.astro`, whose `<pct>100</pct>` is sample XML from
         a real receiver report, not advice.
      2. **`docs/using-the-console.md`** now points at the tag reference instead of
         RFC 7489, matching `domain-detail.md`. No RFC 7489 citation remains outside
         the checker's own code comments, where it is explaining a historical change.
      3. **The policy-discovery model is fixed**, which closes the contradiction this
         item recorded. `guides/no-dmarc-record-found.md` described the old
         one-step-to-the-organizational-domain rule; it now describes the tree walk,
         and explains *why* a checker aimed at a subdomain says "not found" while the
         receiver finds a policy — which is the actual question that page exists to
         answer. It also names the public-suffix-list history, since most advice
         written about this predates the change.
      4. **Nothing required `p` to be the second tag in prose** — checked, and the
         rule appeared nowhere outside the checker, whose warning is deleted. The only
         positional claim left on the site is that `v` must come first, which RFC 9989
         still requires.

      Also worth a look while in there: RFC 9990 §4 restates the external-destination
      rule comparing **organizational domains** rather than exact names, and blesses
      the `*._report._dmarc` wildcard explicitly — which is the form the agency guide
      relies on.
- [ ] (todo) **`dmarc-for/google-workspace.md` inverts Google's DKIM behaviour.**
      Line ~56 says Workspace "does **not** sign with DKIM until you generate a
      key". It always signs — with a Google-owned default key and
      `d=<domain>.<datestamp>.gappssmtp.com`, which is valid but never *aligns*.
      The troubleshooting row that follows ("`dkim=none` on all mail → Start
      authentication was never clicked") is therefore wrong about the symptom
      too: you see `dkim=pass` with a `gappssmtp.com` domain, conclude DKIM is
      fine, and never find the alignment problem. `microsoft-365.md:124` already
      handles its `onmicrosoft.com` equivalent correctly — copy that treatment.
- [x] (done) **`glossary/mta-sts.md` named the wrong actor.** "MTA-STS makes
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
- [x] (done) **`glossary/dmarc.md` — the meta description said DMARC acts on
      mail that "fails SPF and DKIM".** Mail can pass both and still fail DMARC
      through non-alignment; the page body gets this right. This string is the
      `<meta description>`, the index card *and* the `DefinedTerm` JSON-LD, so
      the wrong version is the one that reaches search results.
- [x] (done) **`guides/fix-dmarc-failure.md` linked "ARC" to `/glossary/dkim/`.**
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
- [x] (done) **`guides/no-dmarc-record-found.md` contradicted itself in one
      sentence** — "DMARC lookups do **not** walk up to the parent domain" and
      then describes the receiver doing exactly that. RFC 7489 §6.6.3 defines one
      step to the organizational domain; it is *checkers* that report on the
      exact name queried.

### Omissions — true as far as they go

- [~] (in-progress) **The `_report._dmarc` external-destination rule is missing from
      all three `/dmarc-for` pages.** Every reader of those pages will point
      `rua=` at an analyzer on another domain, which the spec requires the
      destination domain to authorise. This is the difference between our own product
      receiving data and silently receiving none.

      Now covered in three places — `guides/no-dmarc-record-found.md`, the
      [tag reference](/guides/dmarc-record-tags/), and the
      [agency guide](/guides/dmarc-multiple-client-domains/) for the wildcard form and
      the closest-encloser trap — plus a short section on the `/dmarc-for/` index,
      which was the thinnest page on the site and is no longer. **The three provider
      pages themselves still don't mention it**, which is what remains here: one
      cross-link each rather than a repeat of the explanation.
- [ ] (todo) **`guides/spf-record-syntax.md` omits `exists` from both the
      mechanism table and the lookup-counting list** (RFC 7208 §4.6.4 names
      `include`, `a`, `mx`, `ptr`, `exists` and `redirect`). It also omits the
      separate 10-name sub-limits on `mx`/`ptr` — a domain with 12 MX hosts
      permerrors while showing a term count of 1. `fix-dmarc-failure.md:125`
      says "under 10" where the limit is 10.
- [x] (done) **No page gave DKIM's DNS location.** `guides/spf-dkim-dmarc.md`
      is the foundational explainer and never states
      `<selector>._domainkey.<domain>` — the word "selector" does not appear on
      it at all, though `/glossary/dkim-selector/` exists and no guide links to
      it. The same page overstates DKIM as proving the message "came from your
      domain"; RFC 6376 §1 is explicit that it asserts responsibility, not origin.
- [x] (done) **`sp=` inheritance was stated on three pages and all three omitted the
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

- [x] (done) **A "what changed in the new DMARC standard" guide** —
      `/guides/dmarc-rfc-9989/`, the one time-sensitive item on this list and the only
      DMARC news in a decade. RFC 9989 published in **May 2026**, obsoleting RFC 7489
      and RFC 9091 (full detail in
      [the corrections item above](#corrections--statements-that-are-wrong)).

      Written as *what changed and what you have to do*, opening with the fact that for
      most readers the answer is **nothing** — then the three cases where it isn't: a
      forgotten sub-100 `pct`, an `ri`/`rf` doing nothing, and delegated subdomains
      now reachable by the tree walk. The tag reference stays canonical for tags; this
      page links to it rather than repeating the table, which is what keeps the two
      off the same query.

      **Both tools were fixed first, and that was the right order.** The checker now
      recognises `t` and `psd`, reports `pct`/`ri`/`rf` as removed-but-honoured rather
      than current, and had one finding *deleted*: it used to warn when `p` was not
      the second tag, which RFC 7489's ABNF required and RFC 9989's does not — it was
      reporting a non-problem. Its "no p tag" finding was also wrong in a way worth
      recording: it claimed receivers ignore the record, where the actual rule depends
      on `rua` — with a valid one the record behaves as `p=none`, without one there is
      no DMARC processing at all. The generator keeps `pct` as the legacy ramp and
      gains a `t` control, and says which is which when both are set.

      A new `note` finding level came out of this. `pct` at 25 is a live warning
      because receivers honour it; `ri` and `rf` are neither problems nor
      achievements, and forcing them into warn or good would have been a lie either
      way. Notes sort last and are excluded from the verdict count, so a healthy
      record carrying a dead tag still reads as healthy.

      Verified in headless Chrome on this box, not deferred — which `AGENTS.md` had
      wrongly said was impossible, now corrected there. Six records were driven
      through the checker's real code path by stubbing the DoH response, and the
      generator was driven through the form. That caught a bug static checks could
      not: the new `t` control was missing from the rebuild listener list, so choosing
      testing mode changed nothing until you touched another field.

      **Why it is worth a page despite having no measured volume.** `dmarcbis`,
      `rfc 9989` and `dmarc 7489` appear **nowhere in the top 300 keywords of any of
      the five tracked competitors**, so nobody holds this ground yet — and their
      authority is built on pages about the *superseded* spec, which means their
      DMARCbis content will be retrofits while ours would be first. That inverts the
      playbook's usual "don't chase this, you won't out-authority them for 12–18
      months", which assumes the incumbent's page already exists. RFC-number queries
      also carry real volume in this niche: `rfc 5322` runs **590/mo at KD 20** and
      dmarcreport.com takes #5–9 for it with a *single* blog post. And we have genuine
      standing to write it — the July 2026 accuracy review below was itself written
      against the obsolete documents, so if it happened here it happened to everyone.

      **How to frame it, and the two traps.** Write it as *what changed and what you
      have to do*, not as commentary on a specification — reader-action voice, which
      also keeps it inside the site's convention of verifying against RFCs without
      citing them in prose. This page is the one legitimate exception, because the
      document is the subject.

      1. **The tag reference stays canonical for tags.** This page links to
         `/guides/dmarc-record-tags/` rather than repeating the table, and targets the
         jargon cluster (`dmarcbis`, `rfc 9989`, `new dmarc standard`,
         `is pct deprecated`) while the reference keeps `dmarc pct` and
         `dmarc rua vs ruf`. Two pages competing for "pct deprecated" would be the
         P1a self-cannibalisation the content plan already records once.
      2. **Fix the tools first.** A page announcing `t=` while our own record checker
         reports `t=` as an unrecognised tag is a contradiction on the page most
         likely to attract readers who check things. That is the correction item
         above, and it is a prerequisite, not a companion.

      **Settle the volume question cheaply before committing:** add `dmarcbis`,
      `rfc 9989`, `dmarc rfc`, `new dmarc standard` and `pct deprecated` to the seeds
      in the `seo` repo's `pull.sh` and re-run it — the plan says to do that monthly
      anyway and the last full pull cost $0.36. Note GSC still has zero query rows, so
      there is no first-party signal to weigh either way.

      One caveat worth writing down now: **this page decays.** In two years "the new
      standard" is just the standard, and the page either becomes the permanent DMARC
      explainer or gets merged into the tag reference. Decide which when it stops
      being news, rather than leaving a page titled after a moment.
- [x] (done) **A DMARC tag reference** — `/guides/dmarc-record-tags/`. `fo`, `ruf`, `ri`, `rf` and `np` appear
      **nowhere in the content tree**; `sp`, `adkim` and `aspf` are scattered
      across four pages at differing accuracy. One "every tag, its default, and
      whether you need it" page fixes several items above at once — highest-value
      single addition.
- [x] (done) **Glossary entries for ARC and TLS-RPT.** Both are named as
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

- [~] (in-progress) **The content collections barely linked to each other.** Now
      measured rather than swept by hand — `scripts/crawl.py` prints the matrix,
      counting body-prose page pairs and excluding nav, footer, breadcrumbs, "related"
      blocks and index listings, so it can be re-checked rather than re-counted.

      All three zero edges are now open (2026-07-28, before → after):

      | Edge | Was | Now | How |
      |---|---|---|---|
      | compare → docs | 0 | **17** | Every "self-hosted", "one container + PostgreSQL", "per-client" and "Helm chart" claim across all 7 compare pages now links to the doc that substantiates it. This is what replaced the dropped Docker guide, and it is worth more: a reader on a compare page has already self-identified as a self-hoster. |
      | guides → docs | 0 | **6** | Mostly the two new guides, which were written to hand the product half to the docs rather than restate it. |
      | glossary → docs | 0 | **1** | One, from TLS-RPT to the parse-failure section. Glossary entries are deliberately lean, so this stays low by design. |

      One correction to the original sweep: **docs → glossary was 5, not 0** —
      `using-the-console`, `dashboard-and-domains` and `data-protection` all linked
      into the glossary already. It is 6 now.

      What is still open is the sharper version of "compare is a pure sink":
      **nothing outside `/compare/` links into it.** Those 8 compare-to-compare pairs
      are the whole of its inbound prose graph, and no guide, glossary entry or doc
      page sends anyone there. Also still 0: `dmarc-for → docs`.
- [ ] (todo) **"Related links" on guides and compare are `all.slice(0, 3)`** —
      collection order, not topical relatedness. Only the glossary uses curated
      `related` frontmatter.
- [~] (in-progress) **Near-orphans with no editorial inbound links — two left, from
      six.** The crawler flags exactly these and nothing else: `/dmarc-for/godaddy/`
      and `/brand/` (footer-linked on all 69 pages, and arguably fine that way — a
      brand-assets page is not something prose should be sending people to).

      Four came off the list across two passes, all by the same route: **a page earns
      inbound links when something nearby is written, not when someone remembers to add
      one.** `/glossary/mta-sts/` and `/tools/spf-checker/` were picked up by the new
      TLS-RPT entry and the expanded SPF entry; `/tools/dkim-checker/` by
      `/glossary/dkim-selector/`, which explains how to find your selector and can now
      point at the tool that tries the common ones; and `/glossary/bimi/` by the
      enforcement guide, where BIMI belongs anyway — it is what reaching `p=reject`
      unlocks, and a leftover `pct=` or `t=y` disqualifies you from it.

      `/dmarc-for/godaddy/` is the one genuinely stuck: nothing else on the site has a
      reason to mention GoDaddy, which is what the Cloudflare provider page would fix
      by giving the `/dmarc-for/` cluster something to cross-link. Two came off the
      original list before either pass: `/docs/security/` gained prose links
      from `self-hosted-dmarc-monitoring` and `data-protection`, and
      `/free-dmarc-analyzer/` picked up **seven** as the tools landed — the
      pattern worth repeating deliberately rather than hoping for.

      Related, and the same fix: the three capture pages
      (`/free-dmarc-analyzer/`, `/parsedmarc-alternative/`,
      `/self-hosted-dmarc-monitoring/`) are linked from the chrome on 0 of 64
      pages, and `Footer.astro` is one flat row of five links carrying none of
      Guides, Glossary, Setup, Tools or Compare.
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
- [ ] (todo) Add per-industry/persona pages (Cluster D): ~~agencies, MSPs, web-dev
      shops,~~ e-commerce, SaaS, finance, healthcare. Merge aggressively; split only
      when advice genuinely differs. **The first three are covered and should not be
      built:** the how-to half is now
      [DMARC for many client domains](/guides/dmarc-multiple-client-domains/), and the
      positioning half is `/compare/powerdmarc/` (explicitly the agency/MSP
      head-to-head), `/self-hosted-dmarc-monitoring/` and `/free-dmarc-analyzer/`.
      Adding persona pages on top would repeat the self-cannibalisation the content
      plan already records once, on `open source dmarc analyzer`. What is left is the
      verticals where the *compliance driver* genuinely differs.
- [ ] (todo) Add pillar pages tying each cluster together (e.g. `/dmarc-guide`) and wire them into nav.
- [ ] (todo) Optimize images via Astro `<Image />` (`sharp`) with descriptive `alt`; add per-page OG images (`astro-og-canvas`). Concrete first target: `public/og.png` is 106,913 bytes (104 KB) and `scripts/crawl.py` warns on it at the 100 KB threshold — it is the only asset over the line, and it ships on all 64 pages.
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
      tell you. Also live: the **record generator** (`dmarc generator` 1,300/mo),
      which omits every tag left at its default and explains what the result does
      to mail. And the **SPF checker** (`spf checker` 5,400/mo), which recursively
      expands every `include:`/`redirect=` and counts against the 10-DNS-lookup
      limit — exceeding it is a `permerror` that fails silently, and it is the
      most common way a working SPF setup dies. Shared DoH code lives in
      `src/lib/doh.ts`. And the **DKIM checker** (`dkim checker` 6,600/mo), which
      decodes the key via `crypto.subtle` to report its real bit length, catches
      revoked keys (empty `p=`) and testing mode (`t=y`), and offers a list of
      common selectors verified against live DNS. All five Cluster F tools are
      now live; keyword coverage for the cluster is complete.

      Two things worth remembering if these are extended. A DKIM record is only
      recognised by `v=DKIM1` **or** a `p=` tag — several large domains publish a
      wildcard TXT, so "a TXT exists at this name" would report a key at every
      selector (zendesk.com is the live example). And key length must come from
      decoding, not from the base64's length: `MIGf…` is 1024-bit and `MIIBIj…`
      is 2048-bit, which is a distinction no string check should be making.
- [x] (done) Add MDX — done with the content components in Medium priority above,
      pinned to 4.x because the `latest` tag peers on Astro 7. One guide is authored
      as `.mdx` so far; the rest stay plain Markdown until a page needs a component.
- [ ] (todo) Add Astro `redirects` config entries as/when URLs are renamed (GitHub Pages has no server-side redirects).
- [ ] (todo) Add a blog/changelog collection to announce releases and roadmap progress.
