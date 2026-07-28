/**
 * Motion preferences for the browser tools under `/tools`.
 *
 * `global.css` has a `prefers-reduced-motion` block that stops every CSS
 * transition and sets `scroll-behavior: auto`. That block cannot reach these
 * pages' scrolling, because a `behavior: 'smooth'` passed to `scrollIntoView()`
 * in script wins over the stylesheet — so a reader who asked the operating system
 * for less motion still got an animated jump to the results. This is the one
 * place that decision lives, rather than the same media query written out at five
 * call sites.
 */

/** True when the reader has asked for reduced motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Bring an element into view, animating only if the reader hasn't asked us not
 * to. `block: 'nearest'` throughout: the results panel is usually already
 * partly visible, and 'start' would scroll a short answer to the top of the
 * viewport for no reason.
 */
export function revealResults(el: Element): void {
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'nearest',
  });
}
