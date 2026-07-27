/**
 * Copy-to-clipboard for the marketing site.
 *
 * The site shipped copy *icons* on the homepage hero and on every terminal
 * block with no handler behind either of them. A copy affordance that does
 * nothing is worse than none: people click it, get no feedback, and paste
 * whatever was on the clipboard already.
 *
 * Two rules this encodes:
 *
 * 1. **What is copied is what runs.** Display text is often abbreviated to fit
 *    (a `…` in place of a long raw.githubusercontent.com URL). The clipboard
 *    must get the real, runnable command, so the copy source is an explicit
 *    `data-copy` attribute rather than the element's text.
 * 2. **Failure is visible.** `navigator.clipboard` needs a secure context and
 *    can be refused outright. When it is, select the text and say so, rather
 *    than silently doing nothing — which is the bug this file exists to fix.
 */

export type CopyOutcome = 'copied' | 'selected' | 'failed';

/**
 * Put `text` on the clipboard. Falls back to selecting `fallbackNode` so the
 * reader can copy by hand when the API is unavailable.
 */
export async function copyText(text: string, fallbackNode?: Element | null): Promise<CopyOutcome> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    // Keep going: the async API needs a secure context and can be refused.
  }

  // The legacy path still works where the async API is unavailable, and it
  // copies `text` — the full command — rather than whatever is on screen.
  // `execCommand` is deprecated (astro check reports it as a hint, not an
  // error) and is kept deliberately: it is the only synchronous copy that works
  // without the clipboard permission, which is exactly the case being handled.
  try {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.cssText = 'position:fixed; top:0; left:-9999px; opacity:0;';
    document.body.appendChild(scratch);
    scratch.select();
    scratch.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(scratch);
    if (ok) return 'copied';
  } catch {
    // Fall through to selecting the text for the reader.
  }

  if (!fallbackNode) return 'failed';
  try {
    // Selecting the *displayed* text would hand over the abbreviated version —
    // the exact broken command this whole change exists to stop shipping. So
    // expand the element to the real thing first: what is selected is then also
    // what is visible, and both are runnable.
    fallbackNode.textContent = text;
    const range = document.createRange();
    range.selectNodeContents(fallbackNode);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return 'selected';
  } catch {
    return 'failed';
  }
}

const MESSAGE: Record<CopyOutcome, string> = {
  copied: 'Copied',
  selected: 'Selected — press Ctrl/Cmd+C',
  failed: 'Could not copy',
};

/**
 * Wire every `[data-copy]` button under `root`.
 *
 * The button's `data-copy` holds the text to copy. `data-copy-target` optionally
 * names an id whose contents are selected when the clipboard API is refused.
 * Feedback replaces the button's label for a few seconds and is announced to
 * screen readers.
 */
export function wireCopyButtons(root: ParentNode = document): void {
  const buttons = root.querySelectorAll<HTMLElement>('[data-copy]');

  for (const button of buttons) {
    // Both Terminal.astro and the homepage call this, and a page can have
    // several terminals. Without a guard a button would get two listeners and
    // copy twice, with the two reset timers fighting over the label.
    if (button.dataset.copyWired === 'true') continue;
    button.dataset.copyWired = 'true';

    const label = button.querySelector<HTMLElement>('[data-copy-label]');
    // Nothing to restore the label from if the markup has no label element, so
    // those buttons rely on the status region alone.
    const original = label?.textContent ?? '';
    let reset: number | undefined;

    button.addEventListener('click', async () => {
      const text = button.dataset.copy ?? '';
      const targetId = button.dataset.copyTarget;
      const fallback = targetId ? document.getElementById(targetId) : null;
      if (fallback) {
        // Only matters if the expand-and-select path below runs, but it has to
        // be set before the text lands: without `pre-wrap` the newlines between
        // commands collapse into spaces, and the reader selects one long line
        // that is missing its `&&` and will not run.
        fallback.style.whiteSpace = 'pre-wrap';
        fallback.style.overflowWrap = 'anywhere';
      }

      const outcome = await copyText(text, fallback);

      if (label) label.textContent = MESSAGE[outcome];
      button.setAttribute('data-copy-state', outcome);

      window.clearTimeout(reset);
      reset = window.setTimeout(() => {
        if (label) label.textContent = original;
        button.removeAttribute('data-copy-state');
      }, 3000);
    });
  }
}
