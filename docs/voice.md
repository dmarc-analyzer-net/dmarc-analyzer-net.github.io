# Voice

How the public site sounds, and the one mistake it keeps making.

Read with [`content-and-seo.md`](content-and-seo.md), which covers *what* to
publish; this covers *how it reads*. The `seo` repo's `content-style-guide.md`
is the binding version where the two overlap — notably §6a for the blog. Nothing
here contradicts it; this file exists so the rule travels with the code and an
agent editing a page has it to hand.

---

## 1. Who is reading

An email, DNS or security administrator, usually mid-task. They arrived from a
search for a tag, an error, or a vendor name, and they are deciding in about
fifteen seconds whether this page knows more than they do. They have read a lot
of DMARC marketing and believed little of it.

That reader rewards two things — precision, and being told the thing that costs
us something. It is why the site's accuracy rules exist, and why its candour is
an asset rather than a liability.

---

## 2. What the site sounds like

- **Second person, present tense, active.** "You publish the record, and reports
  start arriving within a day" — not "records are published by the
  administrator".
- **The reader's problem first, the product second.** Every page earns the
  product mention by being useful before it.
- **Specific instead of superlative.** A number, a record, a command or a
  provider name beats an adjective every time. "One container and a Postgres
  database" says more than "lightweight and easy to deploy".
- **Short sentences carry the claims.** Qualify in the sentence after, not in a
  subordinate clause inside the claim.
- **Confident about the product.** Self-hosted is a *choice we made*, not an
  apology. State the trade once, plainly, and move on — do not re-litigate it in
  every paragraph.

---

## 3. The line: candour, not commentary

The site's credibility comes from saying true things, including inconvenient
ones. That stays.

What has to go is a different thing that looks like it: **writing about our own
editorial decisions in front of the reader.** A visitor came for DMARC. They did
not come for a note on how the page was put together, what it leaves out, or
what we think it would cost us to include.

> **The test.** Is this sentence a fact about the product, or a fact about how we
> wrote the page? Publish the first. Never the second.

It shows up in three forms.

**Narrating the page.** The page is not a character in itself.

| Don't | Do |
|---|---|
| "The rest of this page is the honest case for and against running it yourself." | *(cut it, and let the next heading do the work)* |

**Narrating the structure.** A table does not have intentions.

| Don't | Do |
|---|---|
| "Two things this table deliberately does not show, because we would lose them: …" | "Two things no pricing column captures. …" |

**Narrating the strategy.** Keyword plans, conversion thinking and competitive
positioning are internal. They belong in `docs/backlog.md` and the `seo` repo.

| Don't | Do |
|---|---|
| "The blog deliberately does not chase search terms." | "The blog is not a how-to archive." |

Note what the fixed versions keep: every fact survives. The rewrite changes who
the sentence is about, not what is true.

### The trap on the other side

Do not let this become licence to delete anything unflattering. Four compare
pages and the roundup carry a disclosure that the list is factual and names
where each alternative genuinely wins; a page that then quietly drops a
competitor's real strength has broken its own promise, and that is the one
failure this audience will notice.

Keep the fact, change the frame: write it as **a criterion the buyer should
weigh**, not as a confession we are volunteering, and land the paragraph on
something concrete that we do.

---

## 4. Telling the product story

The ask "write like this tool is good" is answered with structure, not
adjectives. A product paragraph that works has three parts, in this order:

1. **The problem, in the reader's words.** Not "visibility challenges" —
   "you have forty client domains and no way to see which ones are failing".
2. **What it does, in one sentence.** Mechanism, not benefit. "Every report
   lands in one console, grouped by client."
3. **Proof.** A command, a record, a screenshot, a config line, a number, or a
   link into `/docs/`. The proof is what separates this site from the vendor
   pages it competes with, and it is free — the product is open source, so we
   can show the thing itself.

The three advantages worth telling stories about, because they are true and
structural:

- **Open source**, Apache-2.0 — readable, forkable, auditable.
- **No per-domain pricing**, because there is no vendor ledger to put domains on.
- **One container with dashboards built in** — the self-hosted alternative does
  not make you operate a search cluster.

Product naming stays as AGENTS.md has it: once per educational page, at the
natural "at scale" moment; glossary entries get an inline link and no CTA band.

---

## 5. Words and constructions that signal the problem

- **"deliberately"** — fine about the *product* ("the Helm chart deliberately
  ships no probes"), a red flag about a *page* ("the definitions are
  deliberately short").
- **"honest" / "honestly" as a hedge** — "the honest catch is…" under a heading
  that asks "is there a catch?" is fine, because the reader asked. "The honest
  case", "the honest reason" as a throat-clear is not: say the thing.
- **"we would lose"**, "we don't compete there", "this converts" — strategy out
  loud.
- **"this page", "this table", "this list" as a subject.** Almost always the
  start of a sentence that should not ship.
- **Filler intensifiers** — *simply, just, of course, obviously*. They tell a
  stuck reader the problem was easy.
- **Vendor-deck words** — *seamless, robust, leverage, cutting-edge, empower,
  game-changing*. The site has never used them. Keep it that way.

---

## 6. Internal notes: where they go

HTML comments reach production. Verified on 2026-11-06 by building the site and
reading `dist/`:

- A comment **nested inside an element** is emitted verbatim. The build then
  carried five distinct editorial notes, including one about CSS custom
  properties in `BaseLayout` that sat in view-source on **all 108 pages**. All
  five were converted to `{/* … */}` in the same change that added this file, so
  a note appearing in `dist/` now is a regression, not the status quo.
- A comment at the **top level of a component's slot** is dropped by the Astro
  compiler. This is why `src/pages/index.astro` shipped none of its comments
  while `src/pages/compare/index.astro` shipped the one inside its `<section>`.

That distinction is undocumented, invisible in review, and not worth
remembering. The rule is the simple one:

**Never write a note in `<!-- -->` that you would not publish.** Put it in:

- the `---` frontmatter block of an `.astro` file (`//` and `/* */`, never
  emitted),
- a `{/* … */}` expression in the template (never emitted),
- an HTML comment **only** when it is a structural label a reader could see
  without learning anything about us — `<!-- HERO -->`, `<!-- Results -->`,
- or, for anything that is really a decision record, `docs/backlog.md`, which is
  where this project keeps its reasoning and is not published.

Markdown content has no comment syntax that survives review safely — in a
content collection, if it is worth writing down it goes in the backlog.

---

## 7. What is gated, and what is not

`scripts/crawl.py` fails CI on an HTML comment longer than 40 characters
(`COMMENT_MAX_LABEL`). That is the whole of the mechanical gate, on purpose, and
it is worth knowing exactly where it stops: it catches the sentence-length note,
which is every one the site had actually leaked, and it does **not** catch
`<!-- TODO: rewrite this -->`. A short note still only fails in review.

Tone is not regex-checkable. A phrase list would fire on
`glossary/bimi.md`'s "a deliberately restricted profile" — a correct sentence
about SVG — and stay silent on the next paragraph that narrates our conversion
strategy in fluent, un-flagged English. A check that cannot separate those two
would buy false confidence, which this repo has decided before is worse than no
check at all. §3 is the gate, and it is applied by whoever reviews the page.
