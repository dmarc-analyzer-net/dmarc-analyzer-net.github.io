/**
 * Scroll-spy for the desktop TOC rail: highlights whichever rail link
 * corresponds to the section the reader is currently at.
 *
 * Follows the codebase's small-typed-function idiom from `clipboard.ts`/
 * `motion.ts` — no framework, one exported wiring function called from the
 * owning component's own `<script>` tag.
 *
 * Technique: observe every heading with a thin IntersectionObserver band near
 * the top of the viewport (offset by the 88px sticky header, same constant as
 * `.prose h1..h4`'s `scroll-margin-top`). A heading only ever *sets* the
 * active link when it enters that band — exiting is deliberately ignored. A
 * section's body text is usually much taller than the thin band, so if
 * "active" were cleared the moment the heading itself scrolled out, the
 * highlight would go dark for most of the time the reader is actually inside
 * that section (an earlier version of this file had exactly that bug). Not
 * clearing on exit means the most recently entered heading stays lit until
 * the next one enters.
 */
const HEADER_OFFSET = 88;

export function wireTocSpy(root: ParentNode = document): void {
  if (typeof IntersectionObserver === 'undefined') return;

  const rail = root.querySelector<HTMLElement>('.toc-rail');
  if (!rail) return;
  // Defensive, matching wireCopyButtons: harmless if only one Toc ever exists
  // per page, but cheap insurance against double-wiring.
  if (rail.dataset.spyWired === 'true') return;
  rail.dataset.spyWired = 'true';

  const links = Array.from(rail.querySelectorAll<HTMLAnchorElement>('a[data-toc-link]'));
  if (links.length === 0) return;

  // Resolve each rail link to its heading element, in document order — the
  // order links already appear in the rail, which matches heading order.
  const items: { heading: Element; link: HTMLAnchorElement }[] = [];
  for (const link of links) {
    const id = link.getAttribute('href')?.slice(1);
    const heading = id ? document.getElementById(id) : null;
    if (heading) items.push({ heading, link });
  }
  if (items.length === 0) return;

  const indexOf = new Map(items.map(({ heading }, i) => [heading, i]));
  const linkOf = new Map(items.map(({ heading, link }) => [heading, link]));

  const setActive = (link: HTMLAnchorElement | null) => {
    for (const { link: l } of items) l.classList.toggle('is-active', l === link);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      // A fast scroll or an instant jump can cross several headings within
      // one callback, and `entries` isn't guaranteed to arrive in document
      // order — so among the headings that just entered the band, the one
      // furthest down the page wins.
      let winner: Element | null = null;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        if (winner === null || indexOf.get(entry.target)! > indexOf.get(winner)!) {
          winner = entry.target;
        }
      }
      if (winner) setActive(linkOf.get(winner) ?? null);

      // Scrolled back above the first heading entirely: no section is
      // current yet, regardless of whatever was last active.
      if (items[0].heading.getBoundingClientRect().top > HEADER_OFFSET) {
        setActive(null);
      }
    },
    {
      // Top: shrink the root by the header height, so a heading only counts
      // once it has actually cleared the sticky header. Bottom: shrink by
      // 80%, keeping the "entry line" a thin strip just below the header —
      // narrow enough that normally only one heading crosses it at a time.
      rootMargin: `-${HEADER_OFFSET}px 0px -80% 0px`,
      threshold: 0,
    },
  );

  for (const { heading } of items) observer.observe(heading);
}
