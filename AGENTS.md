# AGENTS.md

Orientation for AI coding agents (and new contributors) working in
**dmarc-analyzer-net.github.io** — the marketing site for DMARC Analyzer. An
**Astro 5** static site, built to GitHub Pages, live at
[dmarc-analyzer.net](https://dmarc-analyzer.net).

This file used to live in the workspace-root `AGENTS.md`, which is outside git and
describes the two development machines. Anything true of *this repo* belongs here,
where it is versioned with the code it describes and travels with a clone.

## Read these first

- **[`docs/backlog.md`](docs/backlog.md)** — the prioritized task source of truth,
  and the closest thing to a design record. Done items carry a paragraph explaining
  what was verified and what was found, including the things that turned out not to
  be true; that is deliberate, and worth reading before re-deciding something.
- **[`docs/content-and-seo.md`](docs/content-and-seo.md)** — how to grow the site:
  page-authoring patterns, the cluster content plan, the components, and the
  technical SEO checklist. **Read before adding any page.**
- The private `seo` repo holds the keyword data and competitive research behind
  those plans — volumes and priorities come from there, not from intuition — and
  `docs/content-style-guide.md`, the **binding editorial standard**. Its **§2a**
  is the voice section: the register, and the line between the candour the
  compare pages promise and narrating our own editorial decisions in front of
  the reader. **Read before writing prose.** It is private because it quotes
  positioning and the keyword policy; the half of it that this repo's CI
  enforces is restated below, under *Writing content*.

## Commands

```bash
npm install
npm run dev       # dev server at http://localhost:4321
npm run build     # production build into dist/
npm run preview   # serve the built site
npm run check     # astro check
```

There is **no test suite and no linter.** The gate is `astro check`, the build (Zod
frontmatter schemas fail it), and `scripts/crawl.py`. Do not add an npm alias for the
Python or shell scripts — they take arguments, and `npm run x -- --flag` is a footgun.

## Layout

- `src/pages/` — one file per route. `[...slug].astro` templates render the content
  collections; `tools/*.astro` are hand-built and are the only pages shipping JS.
- `src/content/` + `src/content.config.ts` — seven collections: `guides`, `glossary`,
  `providers` (in `dmarc-for/`), `compare`, `docs`, `rfcs` (in `rfc/`), `blog`.
  The blog is the only one that is bylined and has an RSS feed (`/blog/rss.xml`).
  Zod schemas enforce description length and a **rendered** `<title>` budget, so a
  too-long title fails the build rather than truncating in search results.
- `src/components/` — `Header`, `Footer`, `Icon` (Lucide geometry in a map),
  `Breadcrumbs`, `RelatedLinks`, `Cta`, `JsonLd`, `Toc`, `Faq`, `Callout`,
  `Terminal`, `BrowserFrame`, `LogoMark`, `DocsSidebar`.
- `src/lib/` — `doh.ts` (DNS-over-HTTPS for the tools), `clipboard.ts`, `llms.ts`
  (generates `/llms.txt` + `/llms-full.txt`), `docs.ts` (`DOCS_SECTIONS`),
  `motion.ts` (`revealResults`), `blog.ts` (the byline and post-type labels).
- `src/styles/global.css` — design tokens as CSS custom properties. **Never
  hard-code a hex**; use `var(--teal-600)` and friends.
- `scripts/` — `crawl.py`, `check-doc-versions.sh`, `verify-docs-snippets.sh`.

## CI, and what actually gates a change

`.github/workflows/ci.yml` on every push and PR: version check → `astro check` →
build → serve the preview → **`scripts/crawl.py`**. `deploy.yml` publishes on push
to `main`, so **merging deploys to production**.

`scripts/crawl.py` is the substantive gate — the checks a Screaming Frog audit would
report, in standard-library Python. Broken links, redirect chains, title and
description problems, missing/duplicate H1s, canonical mismatches, thin content,
image weight, sitemap coverage both ways, orphans, internal notes left in the
published HTML, and the cross-collection **editorial link matrix**. It crawls
the *local preview* deliberately, so a regression fails the PR. It fails CI on a
missing trailing slash, because `trailingSlash: 'always'` means the slash-less
form 404s on the preview.

Outbound links are skipped in CI. Check them by hand, or run the manual
`SEO audit (manual)` workflow:

```bash
python3 scripts/crawl.py https://dmarc-analyzer.net
```

## Conventions that will bite you

- **Trailing slashes on every internal link.** `/glossary/spf/`, never
  `/glossary/spf`. With an anchor the slash comes first:
  `/docs/troubleshooting/#parse-failures`.
- **The build is reproducible — keep it that way.** Two builds of the same source
  produce byte-identical HTML, which makes "did this change any output?" answerable
  with `sha256sum`. Two things broke it before: a random gradient id in `LogoMark`,
  and `all.slice(0, 3)` over `getCollection()`, which returns *glob* order. Sort
  before slicing.
- **`Callout` and any component used inside content need `.mdx`.** MDX is pinned to
  **4.x on purpose**: `astro add mdx` resolves `latest`, which peers on Astro 7 while
  this site is on Astro 5, and it skips validating that peer. Separate a component's
  children from its tags with blank lines or the body is treated as inline JSX and
  code spans silently don't render. `npm run check` does **not** type-check MDX
  bodies — only `npm run build` does.
- **Astro ships some HTML comments and silently drops others.** A comment at the
  top level of a component's slot is removed by the compiler; one nested inside
  an element is emitted verbatim. That is why `src/pages/index.astro` published
  none of its comments while `src/pages/compare/index.astro` published the one
  inside its `<section>` — undocumented, invisible in review, and the reason the
  build was carrying five editorial notes in view-source (one on all 108 pages)
  until 2026-11-06. Don't learn the distinction; use `{/* … */}`, which never
  ships. `crawl.py` fails on any comment over `COMMENT_MAX_LABEL` (40) chars.
- **`src/lib/llms.ts` is the one place a new collection can be forgotten.** New
  *entries* are automatic; a new *collection* needs adding to `buildSections()`.
- **Scrolling in a tool page** goes through `revealResults()` from `src/lib/motion.ts`.
  CSS `scroll-behavior: auto` does not override a `behavior: 'smooth'` passed to
  `scrollIntoView()`, so calling it directly ignores `prefers-reduced-motion`.
- **A new page needs inbound links, and the crawler is the only thing that checks.**
  The collection index auto-lists every entry, so the orphan check never fires;
  the editorial-inbound check is what tells you nothing *chose* to link it.

## Writing content

Full guidance in `docs/content-and-seo.md` and the private `seo` repo's
`docs/content-style-guide.md`. The rules most often got wrong:

- **Write about the product, never about the page.** "Two things this table
  deliberately does not show, because we would lose them" is a sentence about
  our own editorial decisions, and the reader did not come for those. Keep every
  fact, change who the sentence is about — style guide §2a, which has the
  before-and-afters. Internal reasoning goes in the `---` frontmatter block, a
  `{/* … */}` expression or `docs/backlog.md`; **never in `<!-- -->`**, which
  reaches production. `crawl.py` fails CI on a shipped comment over 40
  characters — long enough to catch a sentence, not a `<!-- TODO -->`, so a
  short one is still yours to spot.

- **Verify against the RFC; cite it once, where the thing is defined.** A guide or
  glossary entry may carry an RFC number at most once per concept, at the moment
  that concept is introduced, always as a link to the local page:
  `**SPF** (Sender Policy Framework, [RFC 7208](/rfc/7208/))`. After that, write the
  behaviour and not the citation — no section numbers, no bare numbers threaded
  through the prose, no second mention of a number the reader has already been
  given. Two cites on one page is fine when they define two different things
  (`/guides/spf-record-syntax/` cites 7208 for SPF and 5322 for the `From:` header);
  two cites of the *same* RFC is the thing this rule forbids. A guide whose subject
  *is* a specification (`/guides/dmarc-rfc-9989/`) is the standing exception and
  cites freely. Tool pages and `docs/` cite as needed.
- **The current specification.** As of **RFC 9989** (May 2026) DMARC is
  RFC 9989/9990/9991; RFC 7489 and RFC 9091 are obsolete, and `pct`, `ri` and `rf`
  are removed from the spec while still honoured by receivers.
- **Name the product once per educational page**, at the natural "at scale" moment.
  Glossary entries get an inline link and no CTA band.
- **Never recommend a competitor's tool.** Naming email *providers* is expected;
  competitor product names appear only on `/compare/*`.
- **Reserved example values only** — `yourdomain.com`, and the documentation IP
  ranges. Never a real customer's.
- **Truthful to the end state.** The site markets the target product, but never
  claims something works today that doesn't. Four compare pages state we do not read
  TLS-RPT or RUF; don't contradict them.

## Verifying UI work

There **is** a browser here: headless Chrome driven by the `chrome-devtools` MCP.
Use it — load the page, drive the form, read the console, screenshot at a set
viewport. The tool pages are pure client-side JS and cannot be verified any other
way; stubbing `window.fetch` via an init script is how to feed a checker synthetic
DNS answers.

What it does not give you is judgement. A screenshot proves a page doesn't overflow
at 390px; it does not prove the page reads well. Say which you did.
