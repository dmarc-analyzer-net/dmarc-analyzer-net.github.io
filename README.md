# dmarc-analyzer.net

Marketing site for [DMARC Analyzer](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp) —
an open-source, self-hosted DMARC monitoring tool for agencies. Built with
[Astro](https://astro.build) and served via GitHub Pages.

> **Adding pages or SEO content?** See
> [`docs/content-and-seo.md`](docs/content-and-seo.md) — how to add pages,
> scale up with content collections and programmatic routes, the planned
> content clusters, and the technical SEO checklist.

## Develop

```bash
npm install
npm run dev        # local dev server at http://localhost:4321
npm run build      # production build into dist/
npm run preview    # serve the built site locally
```

## Project structure

```
src/
  pages/           # one file per route (index.astro → /, features.astro → /features)
  layouts/         # BaseLayout.astro — <head>, SEO meta, global style imports
  components/      # Header, Footer, Icon (shared building blocks)
  styles/          # fonts.css (self-hosted webfonts), global.css (design tokens + base + utilities)
public/            # static assets copied verbatim (fonts/, favicon.svg, og.png)
```

### Adding a page

Drop a new `.astro` file in `src/pages/` — its filename becomes the URL. Wrap the
content in `BaseLayout` and pass a `title` + `description` for SEO:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
---
<BaseLayout title="…" description="…" path="/your-path">
  <Header />
  <!-- your content -->
  <Footer />
</BaseLayout>
```

Design tokens (colors, spacing, type scale) live as CSS custom properties in
`src/styles/global.css` — use `var(--teal-600)` etc. rather than hard-coding hex
values so new pages stay consistent.

### Icons

Icons are inline SVG via `<Icon name="…" />` (see `src/components/Icon.astro`).
Size and color follow the surrounding text (`style="font-size:16px; color:…"`).
To add one, add its glyph path to the `ICON_PATHS` map in that component.

## Deployment

Every push to `main` builds and deploys automatically via
`.github/workflows/deploy.yml`.

**One-time setup:** in the repo, go to **Settings → Pages** and set
**Source** to **GitHub Actions**.

### Custom domain

The site currently publishes to `https://dmarc-analyzer-net.github.io`. To use
`dmarc-analyzer.net`:

1. Add a `public/CNAME` file containing `dmarc-analyzer.net`.
2. Update `site` in `astro.config.mjs` to `https://dmarc-analyzer.net`.
3. Point the domain's DNS at GitHub Pages and set the custom domain under
   **Settings → Pages**.
