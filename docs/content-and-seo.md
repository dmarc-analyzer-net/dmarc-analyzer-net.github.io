# Growing the site: content & SEO guide

How to add pages to this site — from a single hand-built page to ~100
programmatic SEO pages — without losing maintainability or tripping Google's
thin-content filters.

Read this alongside the [README](../README.md), which covers the project
structure and deploy flow.

---

## 0. Philosophy: depth beats count

The goal you stated is "~100 pages for SEO." Treat that as a ceiling, not a
target. **30 genuinely useful pages will out-rank 100 thin, templated ones** —
Google's helpful-content and spam-policy systems actively demote pages that
look mass-produced and add nothing a searcher couldn't get elsewhere.

For every page ask: *does this answer the query better than what currently
ranks?* If the only differences between two pages are a swapped product name or
industry noun, they should probably be **one** page, or a page with sections —
not two.

Where this site has a real advantage to lean on (this is your E-E-A-T):

- It's **open source** — link to the [repo](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp),
  show real config, real Docker commands, real screenshots.
- It's **self-hosted / no per-domain pricing** — a genuinely different angle
  from the hosted incumbents.
- It's built by people who clearly understand DMARC — write like it.

---

## 1. Add a one-off page

Fastest path for a standalone page (e.g. `/pricing`, `/about`). Drop a
`.astro` file in `src/pages/`; the filename becomes the URL.

```astro
---
// src/pages/about.astro  ->  /about
import BaseLayout from '../layouts/BaseLayout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
---
<BaseLayout
  title="About — DMARC Analyzer"
  description="Who builds DMARC Analyzer and why it's open source."
  path="/about"
>
  <div style="min-height:100vh;">
    <Header />
    <!-- your content; use var(--teal-600) etc. from the design tokens -->
    <Footer />
  </div>
</BaseLayout>
```

`BaseLayout` handles `<title>`, meta description, canonical URL, Open
Graph/Twitter tags, and favicon. Always pass a unique `title`, `description`,
and the `path`.

Nested routes: `src/pages/dmarc-for/google-workspace.astro` → `/dmarc-for/google-workspace`.

---

## 2. Scale with content collections (guides, glossary, blog)

When you have many pages that share a shape — articles, glossary entries,
guides — don't hand-write each `.astro` file. Author the content in
**Markdown** and let one template render them all. This is Astro's
[Content Collections](https://docs.astro.build/en/guides/content-collections/).

### 2.1 Define the collections

```ts
// src/content.config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string().max(65),          // keep titles short for SERPs
    description: z.string().min(50).max(160),
    publishDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

const glossary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/glossary' }),
  schema: z.object({
    term: z.string(),
    description: z.string().min(50).max(160),
    aliases: z.array(z.string()).default([]),   // e.g. ["RUA"] for "aggregate report"
    related: z.array(z.string()).default([]),   // slugs of related entries
  }),
});

export const collections = { guides, glossary };
```

The Zod schema is a real guardrail: a page with a missing or too-long
description **fails the build**, so SEO basics can't silently rot.

### 2.2 One template renders the whole collection

```astro
---
// src/pages/guides/[...slug].astro
import { getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import Header from '../../components/Header.astro';
import Footer from '../../components/Footer.astro';

export async function getStaticPaths() {
  const entries = await getCollection('guides', ({ data }) => !data.draft);
  return entries.map((entry) => ({
    params: { slug: entry.id },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await render(entry);
---
<BaseLayout
  title={entry.data.title}
  description={entry.data.description}
  path={`/guides/${entry.id}`}
>
  <div style="min-height:100vh;">
    <Header />
    <article class="prose" style="max-width:760px; margin:0 auto; padding:64px 32px;">
      <h1>{entry.data.title}</h1>
      <Content />
    </article>
    <Footer />
  </div>
</BaseLayout>
```

Now adding a guide is just dropping `src/content/guides/how-to-read-a-dmarc-report.md`:

```markdown
---
title: How to read a DMARC aggregate report
description: A field guide to the XML in RUA reports — what each tag means and which rows actually need action.
publishDate: 2026-08-01
---

DMARC aggregate reports arrive as XML once a day from each mailbox provider…
```

It appears at `/guides/how-to-read-a-dmarc-report`, is added to the sitemap
automatically, and passes the same SEO checks as every other page.

> **Prose styling:** markdown produces bare `<h2>`, `<p>`, `<ul>`, `<pre>` etc.
> Add a `.prose` block to `src/styles/global.css` that styles those tags using
> the design tokens (`var(--text-2xl)`, `var(--font-display)`, `var(--teal-600)`…)
> so articles match the brand. Do this **once** before writing many guides.

> **Want components inside markdown?** (callouts, tabbed code, an interactive
> record checker) install MDX: `npx astro add mdx`, then author `.mdx` files and
> `import` components at the top.

---

## 3. Scale with programmatic pages (from data)

For "same page, different subject" sets — one page per email provider, per
industry, per competitor — drive the pages from a data file instead of
Markdown. **Only do this when each page will hold substantively different
content** (see §0).

```jsonc
// src/data/providers.json
[
  {
    "slug": "google-workspace",
    "name": "Google Workspace",
    "reportsFrom": "google.com",
    "setupNotes": "Add the DMARC TXT record in the Google Admin console under…",
    "gotchas": "Google batches reports; expect the first RUA ~24h after publishing."
  },
  { "slug": "microsoft-365", "name": "Microsoft 365", "reportsFrom": "…", "…": "…" }
]
```

```astro
---
// src/pages/dmarc-for/[provider].astro
import providers from '../../data/providers.json';
import BaseLayout from '../../layouts/BaseLayout.astro';
import Header from '../../components/Header.astro';
import Footer from '../../components/Footer.astro';

export function getStaticPaths() {
  return providers.map((p) => ({ params: { provider: p.slug }, props: { p } }));
}
const { p } = Astro.props;
---
<BaseLayout
  title={`Set up DMARC for ${p.name}`}
  description={`Step-by-step DMARC setup and report monitoring for ${p.name} — where reports come from and what to watch for.`}
  path={`/dmarc-for/${p.slug}`}
>
  <div style="min-height:100vh;">
    <Header />
    <!-- pull real, provider-specific detail from the data object;
         don't just interpolate the name into a boilerplate template -->
    <Footer />
  </div>
</BaseLayout>
```

---

## 4. The content plan

A pillar-and-cluster map tailored to this product. Build **top-down**: the
educational base earns trust and internal-link targets; the commercial pages
convert. Rough intent in brackets — `[info]` informational, `[commercial]`
buying intent.

### Cluster A — Glossary / fundamentals `[info]` — foundation, high internal-link value
Short, precise definition pages. Each: one-sentence definition, why it matters,
an example record/snippet, and links to related terms.
- DMARC, SPF, DKIM, BIMI, MTA-STS, TLS-RPT, ARC
- Policy & tags: `p=none`, `p=quarantine`, `p=reject`, `pct`, `sp`, `adkim`, `aspf`, `rua`, `ruf`, `fo`
- Concepts: SPF alignment, DKIM alignment (relaxed vs strict), aggregate report (RUA), forensic/failure report (RUF), email spoofing, domain impersonation, BEC

### Cluster B — How-to guides `[info]` — the workhorse content
- Publish your first DMARC record
- Read a DMARC aggregate report
- Move safely from `p=none` → `p=quarantine` → `p=reject`
- Diagnose & fix SPF alignment failures / DKIM alignment failures
- Set up DMARC reporting when you manage many client domains
- Self-host a DMARC analyzer with Docker + PostgreSQL (leans on the OSS angle)

### Cluster C — Per-provider setup `[info]` — programmatic (§3), but keep each substantive
Google Workspace, Microsoft 365, Zoho, Amazon SES, SendGrid, Mailchimp,
Postmark, Mailgun. Each: where that provider sends reports, exact setup steps,
provider-specific gotchas.

### Cluster D — Per-industry / persona `[info→commercial]` — the agency angle
Marketing agencies, MSPs, web-dev shops managing client domains, e-commerce,
SaaS, finance, healthcare. **Merge aggressively** — only split when the advice
genuinely differs (compliance drivers, typical sender stacks).

### Cluster E — Comparisons & alternatives `[commercial]` — highest conversion
- "Open-source DMARC monitoring tools"
- "Self-hosted vs hosted DMARC platforms"
- "Free DMARC report analyzers"
- "DMARC Analyzer vs \<incumbent>" pages
- ⚠️ **Trademark & accuracy:** name competitors factually, keep the existing
  disclaimer ("named products are trademarks of their respective owners…"), and
  make sure every claim is currently true. This is the content most likely to
  draw complaints if sloppy.

### Cluster F — Free tools `[link magnets]` — best backlink earners
DMARC record checker/generator, SPF checker, DKIM lookup, DMARC record lookup.
- Static-site note: these need DNS lookups. Do them **client-side** via
  DNS-over-HTTPS (Cloudflare `https://cloudflare-dns.com/dns-query` or Google
  `https://dns.google/resolve`) so no backend is required. This is the one
  place you'll ship JavaScript — keep it to an island, not the whole page.

Pillar pages tie each cluster together (e.g. `/dmarc-guide` linking every
Cluster A+B page) and are strong nav/menu candidates.

---

## 5. Components worth building first

Build these once; every content page reuses them. Put them in `src/components/`.

| Component | Purpose |
|---|---|
| `Prose` / `.prose` CSS | Typographic styling for markdown article bodies |
| `Breadcrumbs.astro` | Nav + emits `BreadcrumbList` JSON-LD |
| `RelatedLinks.astro` | Internal-linking block (huge for SEO) — link related guides/glossary |
| `Faq.astro` | Native `<details>` accordion + emits `FAQPage` JSON-LD |
| `Callout.astro` | Note/warning/tip boxes for guides |
| `Cta.astro` | Reusable "get started / view on GitHub" band |
| `JsonLd.astro` | `<script type="application/ld+json" set:html={…} />` helper |
| `Toc.astro` | Table of contents from a guide's headings |

As the page count grows, the flat header nav won't scale — plan a **dropdown /
mega-menu** in `Header.astro` grouping Guides / Glossary / Tools / Compare.

---

## 6. Technical SEO checklist

Most of this is already handled; the rest is a few small additions.

**Already done by this site**
- ✅ Unique `<title>` + meta description per page (via `BaseLayout` props)
- ✅ Canonical URL, Open Graph, Twitter cards (`BaseLayout`)
- ✅ `sitemap-index.xml` auto-generated — new pages are included automatically
- ✅ Fast, static, zero-JS pages (great Core Web Vitals)
- ✅ `/llms.txt` and `/llms-full.txt` ([llmstxt.org](https://llmstxt.org/)) —
      **generated from the content collections**, so a new guide, doc or glossary
      entry appears in both on the next build. Nothing to update by hand. Source:
      `src/lib/llms.ts` plus the two endpoints in `src/pages/`. Deliberately not in
      the sitemap: it indexes HTML pages for search crawlers, and these are neither.

      When adding a collection, add it to `buildSections()` in `src/lib/llms.ts` —
      that is the one place a new collection can be forgotten. Decide too whether it
      belongs under `## Optional`, which by the spec means "skippable if a shorter
      context is needed"; glossary entries and comparison pages live there because
      they are the least necessary for answering a question about the product.

**To add**
- [ ] **`public/robots.txt`** pointing at the sitemap:
      ```
      User-agent: *
      Allow: /
      Sitemap: https://dmarc-analyzer-net.github.io/sitemap-index.xml
      ```
      (Update the host if/when the custom domain goes live — see README.)
- [ ] **Structured data (JSON-LD)** via a `JsonLd` component in the `head` slot:
      `Article` on guides, `FAQPage` on pages with FAQs, `BreadcrumbList` on nested
      pages, `Organization` + `SoftwareApplication` on the home page. Test with
      Google's [Rich Results Test](https://search.google.com/test/rich-results).
- [ ] **One H1 per page**, descriptive; use H2/H3 for structure.
- [ ] **Internal links** — every new page should link to 2–4 related pages and
      be linked to from at least one existing page (use `RelatedLinks`).
- [ ] **Images:** use Astro's `<Image />` (`src/assets/…`) for automatic
      resize/format/lazy-loading. Always set descriptive `alt`. *(Requires
      `sharp`, which builds fine in CI.)*
- [ ] **Per-page OG images (optional):** generate at build with
      [`astro-og-canvas`](https://github.com/delucis/astro-og-canvas) so each
      page has a title-specific share card instead of the single default.
- [ ] **Register the site in [Google Search Console](https://search.google.com/search-console)**
      and submit the sitemap. This is how you'll see what actually ranks.

**Redirects:** GitHub Pages has no server-side redirects. If you rename a URL,
add an Astro [`redirects`](https://docs.astro.build/en/reference/configuration-reference/#redirects)
entry (it emits a static redirect page) so old links don't 404.

---

## 7. Suggested build order

1. **Foundations first (this unblocks everything):** add `.prose` styles,
   `robots.txt`, and the `JsonLd` / `Breadcrumbs` / `RelatedLinks` components.
2. **Set up the `guides` and `glossary` collections** (§2) and ship 3–5 real
   guides + 8–10 glossary terms. Interlink them.
3. **Add per-provider pages** (§3) once you have a solid template — the top 4–5
   providers your audience uses.
4. **Write the comparison / commercial pages** (Cluster E) — these convert, but
   they land better once the educational base gives the site authority.
5. **Ship one free tool** (Cluster F) as a backlink magnet.
6. **Measure in Search Console**, double down on pages gaining impressions,
   prune or merge anything thin.

Ship in small batches, push to `main`, and each batch deploys automatically.

---

*Want me to scaffold any of this? Say the word and I'll set up the content
collections, the `.prose` styles, `robots.txt`, and the structured-data
components as a starting point.*
