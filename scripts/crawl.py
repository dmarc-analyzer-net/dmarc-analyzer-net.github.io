#!/usr/bin/env python3
"""Technical SEO crawl — the checks a Screaming Frog audit would report.

Screaming Frog's free tier is GUI-only and its headless CLI is licence-gated, so
this covers the same ground from a terminal: broken links, redirect chains,
title/description/H1 problems, canonical mismatches, thin pages, images missing
alt text or weighing more than 100 KB, orphan pages, and sitemap coverage.

It also reports something a crawler usually can't tell you: which pages nothing
but the site's own chrome links to. Header, footer, breadcrumbs, sidebars and
"related" blocks link a page whether or not anyone thought it was worth
recommending, so counting every link makes the whole site look well connected.
Zoning each link by the element it sits in separates the two.

    python3 scripts/crawl.py [URL] [--skip-external]

In CI it crawls the local preview build so a regression fails the pull request
before it can reach production.

Standard library only. Exits non-zero if any error-level issue is found, so it
can gate CI.
"""
from __future__ import annotations

import sys
import time
import gzip
import re
from collections import defaultdict
from html.parser import HTMLParser
from urllib import request, error
from urllib.parse import urljoin, urlparse, urldefrag

UA = "dmarc-analyzer-seo-crawl/1.0 (+https://dmarc-analyzer.net)"
DELAY = 0.35          # be polite; GitHub Pages throttles fast crawls with 503s
MAX_PAGES = 500
MAX_EXTERNAL = 60     # cap outbound checks so a run stays quick

TITLE_MAX, TITLE_MIN = 60, 15
DESC_MAX, DESC_MIN = 160, 50
THIN_WORDS = 150
IMAGE_MAX_BYTES = 100 * 1024   # Screaming Frog's own "large images" threshold
MAX_IMAGES = 100

# A link sitting in a <nav> on this share of pages is site chrome by definition —
# a declared hub, not an orphan. Keyed on <nav> alone: the footer carries a
# handful of links on every page too, and treating that as an endorsement would
# hide exactly the pages that are *only* in the footer.
CHROME_UBIQUITY = 0.9


class Page(HTMLParser):
    """Extracts the handful of elements an SEO audit cares about."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.description = None
        self.canonical = None
        self.robots = None
        self.h1: list[str] = []
        self.links: list[str] = []
        # `links` stays every link on the page, because it feeds the crawl
        # frontier — gate it and the crawler stops finding the site. These two
        # answer the separate question of *where* a link sits.
        self.nav_links: list[str] = []
        self.editorial_links: list[str] = []
        self.images_without_alt = 0
        self.images_without_dimensions = 0
        self.images = 0
        self.image_srcs: list[str] = []
        self._in_title = False
        self._in_h1 = False
        self._h1_buf: list[str] = []
        self._text: list[str] = []
        self._skip = 0
        self._nav = 0
        self._chrome = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "h1":
            self._in_h1 = True
            self._h1_buf = []
        elif tag == "meta":
            name = (a.get("name") or "").lower()
            prop = (a.get("property") or "").lower()
            if name == "description":
                self.description = (a.get("content") or "").strip()
            elif name == "robots":
                self.robots = (a.get("content") or "").strip().lower()
            elif prop == "og:image" or name == "twitter:image":
                # Social preview images are the heaviest asset most sites ship
                # and the one nobody looks at again after adding it.
                src = (a.get("content") or "").strip()
                if src:
                    self.image_srcs.append(src)
        elif tag == "link" and (a.get("rel") or "").lower() == "canonical":
            self.canonical = (a.get("href") or "").strip()
        elif tag == "a":
            href = (a.get("href") or "").strip()
            if href:
                self.links.append(href)
                if self._nav:
                    self.nav_links.append(href)
                elif not self._chrome:
                    self.editorial_links.append(href)
        elif tag == "img":
            self.images += 1
            src = (a.get("src") or "").strip()
            if src:
                self.image_srcs.append(src)
            if not (a.get("alt") or "").strip():
                self.images_without_alt += 1
            if not (a.get("width") and a.get("height")):
                self.images_without_dimensions += 1
        elif tag in ("script", "style", "nav", "footer"):
            self._skip += 1
            if tag == "nav":
                self._nav += 1
                self._chrome += 1
            elif tag == "footer":
                self._chrome += 1
        elif tag == "aside":
            # Deliberately not in _skip: excluding <aside> *text* would move the
            # thin-content threshold by several words on every templated page at
            # once. It only zones links, where Cta and RelatedLinks are
            # boilerplate rather than an editorial recommendation.
            self._chrome += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False
            self.h1.append(" ".join("".join(self._h1_buf).split()))
        elif tag in ("script", "style", "nav", "footer"):
            self._skip = max(self._skip - 1, 0)
            if tag == "nav":
                self._nav = max(self._nav - 1, 0)
                self._chrome = max(self._chrome - 1, 0)
            elif tag == "footer":
                self._chrome = max(self._chrome - 1, 0)
        elif tag == "aside":
            self._chrome = max(self._chrome - 1, 0)

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        if self._in_h1:
            self._h1_buf.append(data)
        if not self._skip:
            self._text.append(data)

    @property
    def word_count(self) -> int:
        return len(" ".join(self._text).split())


def fetch(url: str, method: str = "GET"):
    """Returns (status, headers, body). Redirects are reported, not followed."""

    class NoRedirect(request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    opener = request.build_opener(NoRedirect)
    req = request.Request(url, method=method, headers={"User-Agent": UA})
    try:
        with opener.open(req, timeout=20) as r:
            body = r.read() if method == "GET" else b""
            if r.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            return r.status, dict(r.headers), body
    except error.HTTPError as e:
        return e.code, dict(e.headers or {}), b""
    except Exception as e:  # DNS, TLS, timeout
        return 0, {"x-error": str(e)}, b""


def normalise(url: str) -> str:
    """Canonicalise for comparison — but *keep* the trailing slash, which is
    significant here: the site serves `/features/` and 301s `/features`, so the
    two are different URLs and an internal link to the slash-less one is a
    finding, not noise."""
    url, _ = urldefrag(url)
    p = urlparse(url)
    path = re.sub(r"/{2,}", "/", p.path) or "/"
    return f"{p.scheme}://{p.netloc}{path}" + (f"?{p.query}" if p.query else "")


def link_target(base: str, href: str) -> str | None:
    """Absolute, normalised target of an href. None for the schemes and bare
    fragments that don't name another page."""
    if href.startswith(("mailto:", "tel:", "javascript:", "#", "data:")):
        return None
    return normalise(urljoin(base, href))


def rebase(root: str, url: str) -> str:
    """Point an absolute URL at the root actually being crawled.

    Our own markup carries production absolute URLs in three places — the
    sitemap index, `rel=canonical` and `og:image` — because Astro resolves them
    against `site`. Following them verbatim while crawling a local preview
    fetches the *deployed* copy, which in CI means reaching the live internet and
    auditing the wrong build.
    """
    r, p = urlparse(root), urlparse(url)
    return f"{r.scheme}://{r.netloc}{p.path}" + (f"?{p.query}" if p.query else "")


def collection_of(url: str) -> str:
    """First path segment — the content collection a URL belongs to."""
    return urlparse(url).path.strip("/").split("/")[0] or "(home)"


def fetch_page(url: str):
    """Fetch a page. Redirects are reported rather than followed: reaching a page
    via one means some internal link points at the wrong URL, which is the whole
    point of the check. The target is queued separately by the caller.

    Returns (status, headers, body, target|None).
    """
    status, headers, body = fetch(url)
    if status in (301, 302, 303, 307, 308):
        return status, headers, body, normalise(urljoin(url, headers.get("Location", "")))
    if status >= 500:
        # Hosts (GitHub Pages included) throttle bursty crawls with 5xx.
        # Retry once slowly before calling the page broken.
        time.sleep(3)
        status, headers, body = fetch(url)
    return status, headers, body, None


def sitemap_urls(root: str) -> set[str]:
    """Follows sitemap-index.xml to its child sitemaps.

    The index lists its children as production absolute URLs, so every child is
    rebased onto the crawled root — see rebase(). Without that, each
    not-yet-shipped page looks "missing from sitemap" on a preview crawl.
    """
    found: set[str] = set()
    queue = [urljoin(root, "/sitemap-index.xml")]
    seen = set()
    while queue:
        sm = queue.pop()
        if sm in seen:
            continue
        seen.add(sm)
        status, _, body = fetch(sm)
        if status != 200:
            continue
        text = body.decode("utf-8", "replace")
        locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", text)
        if "<sitemapindex" in text:
            queue.extend(rebase(root, u) for u in locs)
        else:
            found.update(normalise(u) for u in locs)
    return found


def check_images(images: dict[str, set[str]]):
    """Weight and reachability of every image the crawl saw.

    Runs even under --skip-external: every URL here has been rebased onto the
    crawled root, so nothing in this check leaves the site.

    Returns (errors, warnings, checked).
    """
    errs: list[str] = []
    warns: list[str] = []
    checked = 0
    for url in sorted(images):
        if checked >= MAX_IMAGES:
            warns.append(f"image check capped at {MAX_IMAGES}; "
                         f"{len(images) - checked} not checked")
            break
        status, headers, _ = fetch(url, method="HEAD")
        size = int(headers.get("Content-Length") or 0)
        if status in (405, 501) or (status == 200 and not size):
            # Not every server answers HEAD, and some answer without a length.
            status, headers, body = fetch(url)
            size = len(body)
        checked += 1
        time.sleep(DELAY)
        srcs = ", ".join(sorted(images[url])[:2])
        if status == 0 or status >= 400:
            errs.append(f"image {status or 'ERR'}: {url}  [on: {srcs}]")
        elif status >= 300:
            warns.append(f"image redirects ({status}): {url}  [on: {srcs}]")
        elif size > IMAGE_MAX_BYTES:
            warns.append(f"image {size // 1024} KB (>{IMAGE_MAX_BYTES // 1024} KB): "
                         f"{url}  [on: {srcs}]")
    return errs, warns, checked


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    skip_external = "--skip-external" in sys.argv
    root = (args[0] if args else "https://dmarc-analyzer.net").rstrip("/")
    host = urlparse(root).netloc

    pages: dict[str, Page] = {}
    status_of: dict[str, int] = {}
    redirects: dict[str, str] = {}
    inbound: dict[str, set[str]] = defaultdict(set)
    editorial_inbound: dict[str, set[str]] = defaultdict(set)
    nav_inbound: dict[str, set[str]] = defaultdict(set)
    external: dict[str, set[str]] = defaultdict(set)
    images: dict[str, set[str]] = defaultdict(set)
    failures: list[tuple[str, int, str]] = []

    home = normalise(root + "/")
    queue = [home]
    seen = {home}

    print(f"Crawling {root} …")

    while queue and len(pages) < MAX_PAGES:
        url = queue.pop(0)
        status, headers, body, target = fetch_page(url)
        status_of[url] = status
        time.sleep(DELAY)

        if target is not None:
            redirects[url] = target
            if urlparse(target).netloc == host and target not in seen:
                seen.add(target)
                queue.append(target)
            continue
        if status != 200:
            failures.append((url, status, headers.get("x-error", "")))
            continue
        if "html" not in headers.get("Content-Type", "").lower():
            continue

        page = Page()
        try:
            page.feed(body.decode("utf-8", "replace"))
        except Exception as e:
            failures.append((url, -1, f"parse error: {e}"))
            continue
        pages[url] = page

        for href in page.links:
            target = link_target(url, href)
            if target is None:
                continue
            if urlparse(target).netloc == host:
                inbound[target].add(url)
                if target not in seen:
                    seen.add(target)
                    queue.append(target)
            else:
                external[target].add(url)

        for href in page.nav_links:
            target = link_target(url, href)
            if target and urlparse(target).netloc == host:
                nav_inbound[target].add(url)

        for href in page.editorial_links:
            target = link_target(url, href)
            if target is None or urlparse(target).netloc != host:
                continue
            # A collection index lists its own children by construction, and a
            # page linking to itself recommends nothing — neither is editorial
            # judgement. The home page is exempt from the rule: every path is
            # below it, and its links are hand-picked.
            if url != home and urlparse(target).path.startswith(urlparse(url).path):
                continue
            editorial_inbound[target].add(url)

        for src in page.image_srcs:
            target = link_target(url, src)
            if target:
                images[rebase(root, target)].add(url)

    # --- findings -----------------------------------------------------------
    errors: list[str] = []
    warnings: list[str] = []
    notes: list[str] = []

    for url, status, msg in failures:
        errors.append(f"{status or 'ERR'} {url}" + (f" — {msg}" if msg else "")
                      + (f"  [linked from: {', '.join(sorted(inbound[url])[:2])}]" if inbound[url] else ""))

    # Internal links that resolve to a redirect are worth fixing: they waste a
    # hop and dilute the signal.
    for src, dst in sorted(redirects.items()):
        if inbound[src]:
            warnings.append(f"internal link to a redirect: {src} -> {dst}"
                            f"  [from: {', '.join(sorted(inbound[src])[:2])}]")
        if dst in redirects:
            errors.append(f"redirect chain: {src} -> {dst} -> {redirects[dst]}")

    by_title: dict[str, list[str]] = defaultdict(list)
    by_desc: dict[str, list[str]] = defaultdict(list)

    for url, p in sorted(pages.items()):
        title = " ".join(p.title.split())
        if not title:
            errors.append(f"missing <title>: {url}")
        else:
            by_title[title].append(url)
            if len(title) > TITLE_MAX:
                warnings.append(f"title {len(title)} chars (>{TITLE_MAX}): {url}")
            elif len(title) < TITLE_MIN:
                warnings.append(f"title only {len(title)} chars: {url}")

        if p.description is None or not p.description:
            errors.append(f"missing meta description: {url}")
        else:
            by_desc[p.description].append(url)
            n = len(p.description)
            if n > DESC_MAX:
                warnings.append(f"meta description {n} chars (>{DESC_MAX}): {url}")
            elif n < DESC_MIN:
                warnings.append(f"meta description only {n} chars: {url}")

        if not p.h1:
            warnings.append(f"no <h1>: {url}")
        elif len(p.h1) > 1:
            warnings.append(f"{len(p.h1)} <h1> elements: {url}")

        if not p.canonical:
            warnings.append(f"no canonical: {url}")
        elif urlparse(normalise(urljoin(url, p.canonical))).path != urlparse(url).path:
            # Compared on path, for the same reason as the sitemap check below: a
            # canonical carries the production absolute URL, so matching on the
            # full URL would flag every page of a local preview crawl and hide
            # the mismatches that matter — above all a missing trailing slash,
            # which points search engines at a URL that 301s.
            warnings.append(f"canonical path differs from the served URL: "
                            f"{url} -> {p.canonical}")

        if p.robots and "noindex" in p.robots:
            notes.append(f"noindex: {url}")

        if p.word_count < THIN_WORDS:
            warnings.append(f"thin content ({p.word_count} words): {url}")

        if p.images_without_alt:
            warnings.append(f"{p.images_without_alt}/{p.images} images without alt: {url}")

        if p.images_without_dimensions:
            warnings.append(f"{p.images_without_dimensions}/{p.images} images without "
                            f"width/height (layout shift): {url}")

    for title, urls in by_title.items():
        if len(urls) > 1:
            errors.append(f"duplicate title on {len(urls)} pages: {title!r} — {', '.join(urls)}")
    for desc, urls in by_desc.items():
        if len(urls) > 1:
            errors.append(f"duplicate meta description on {len(urls)} pages — {', '.join(urls)}")

    # Sitemap coverage both ways.
    sm = sitemap_urls(root)
    crawled_ok = {u for u, s in status_of.items() if s == 200 and u in pages}
    if sm:
        # Compare on path: a sitemap always carries production absolute URLs, so
        # crawling a local preview (CI) would otherwise flag every page.
        def path_of(u: str) -> str:
            return urlparse(u).path or "/"

        sm_paths = {path_of(u) for u in sm}
        crawled_paths = {path_of(u): u for u in crawled_ok}
        for path in sorted(set(crawled_paths) - sm_paths):
            warnings.append(f"crawled but missing from sitemap: {crawled_paths[path]}")
        for path in sorted(sm_paths - set(crawled_paths)):
            warnings.append(f"in sitemap but not reachable by crawling: {path}")
    else:
        warnings.append("no sitemap found at /sitemap-index.xml")

    # Orphans: reachable only because the sitemap listed them.
    for u in sorted(crawled_ok):
        if u != home and not inbound[u]:
            warnings.append(f"orphan page (no internal links point to it): {u}")

    # Pages the site's prose never recommends. The orphan check above asks
    # whether a crawler can reach a page at all, which the header nav guarantees
    # for most of the site; this asks whether anything *chose* to link it. A note
    # rather than a warning: it is an information-architecture judgement on a
    # working page, not a fault.
    hubs = {t for t, srcs in nav_inbound.items()
            if len(srcs) >= CHROME_UBIQUITY * len(pages)}
    for u in sorted(crawled_ok):
        if u == home or u in hubs or editorial_inbound[u]:
            continue
        notes.append(f"no editorial inbound links (chrome, index and related only): {u}")

    # Outbound links — a broken external link is still a broken link.
    SKIP_HOSTS = ("localhost", "127.0.0.1", "example.com", "yourdomain.com",
                  "acme.example", "dmarc.example.com")
    checked = 0
    for target in sorted(external) if not skip_external else []:
        if urlparse(target).hostname in SKIP_HOSTS or any(
                (urlparse(target).hostname or "").endswith("." + h) for h in SKIP_HOSTS):
            continue
        if checked >= MAX_EXTERNAL:
            notes.append(f"outbound link check capped at {MAX_EXTERNAL}; "
                         f"{len(external) - checked} not checked")
            break
        status, headers, _ = fetch(target, method="HEAD")
        if status >= 400 or status == 0:
            # Plenty of hosts reject HEAD outright (support.google.com 404s it)
            # or redirect only for GET — confirm before reporting a broken link.
            time.sleep(DELAY)
            status, headers, _ = fetch(target)
            if status in (301, 302, 303, 307, 308):
                status, headers, _ = fetch(urljoin(target, headers.get("Location", "")))
        checked += 1
        time.sleep(DELAY)
        if status == 0 or status >= 400:
            srcs = ", ".join(sorted(external[target])[:2])
            (errors if status >= 500 or status == 404 else warnings).append(
                f"outbound {status or 'ERR'}: {target}  [from: {srcs}]")

    img_errors, img_warnings, images_checked = check_images(images)
    errors.extend(img_errors)
    warnings.extend(img_warnings)

    # --- report -------------------------------------------------------------
    print(f"\ncrawled {len(pages)} pages · {len(redirects)} genuine redirects · "
          f"{len(external)} distinct outbound links ({checked} checked) · "
          f"{images_checked} images · {len(sm)} sitemap URLs\n")

    # Cross-collection prose links. Counts page pairs, not links: two links
    # between the same two pages are one relationship. A zero here is the shape
    # of a corpus that ranks and then dead-ends.
    collections = {c for c in (collection_of(u) for u in crawled_ok)}
    sizes: dict[str, int] = defaultdict(int)
    for u in crawled_ok:
        sizes[collection_of(u)] += 1
    groups = {c for c in collections if sizes[c] >= 3}

    def group_of(u: str) -> str:
        c = collection_of(u)
        return c if c in groups else "other"

    pairs: dict[tuple[str, str], int] = defaultdict(int)
    for target, srcs in editorial_inbound.items():
        for src in srcs:
            pairs[(group_of(src), group_of(target))] += 1

    axis = sorted(groups | {"other"})
    label_w = max(len(g) for g in axis) + 2
    print("== EDITORIAL LINK GRAPH (prose links only, page pairs) ==")
    print("  from \\ to".ljust(label_w + 2) + "".join(g.rjust(11) for g in axis))
    for g in axis:
        row = "".join(str(pairs[(g, h)]).rjust(11) for h in axis)
        print("  " + g.ljust(label_w) + row)
    print()

    for label, items in (("ERRORS", errors), ("WARNINGS", warnings), ("NOTES", notes)):
        print(f"== {label} ({len(items)}) ==")
        for i in items:
            print(f"  - {i}")
        print()

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
