---
term: DMARC policy
seoTitle: "DMARC policy: p=none, quarantine, reject"
description: The DMARC policy (p=) tells receivers whether to monitor, quarantine, or reject mail that fails authentication — the dial you turn toward enforcement.
aliases: ["p=none", "p=quarantine", "p=reject"]
related: ["dmarc", "dmarc-aggregate-report", "dmarc-alignment", "dmarc-quarantine-vs-reject"]
---

The **DMARC policy** is the `p=` tag in your [DMARC](/glossary/dmarc/) record. It
tells receiving servers what to do with mail that fails
[alignment](/glossary/dmarc-alignment/):

- **`p=none`** — take no action; just send [reports](/glossary/dmarc-aggregate-report/).
  This is monitoring mode, and where every domain should start. It's tempting
  to skip past a policy that "does nothing" straight to one that does, but
  `p=none` is what starts the report flow — without any DMARC record there's
  no data to decide anything from, and no way to know whether the mail
  sending as you today (a forgotten cron job, a marketing tool, an actual
  spoofer) would survive enforcement before you find out the hard way.
- **`p=quarantine`** — deliver failing mail to spam/junk.
- **`p=reject`** — refuse failing mail outright. This is full enforcement, and
  the goal for any domain that sends real mail.

## Useful modifiers

- **`pct=`** applies the policy to a percentage of failing mail (e.g. `pct=25`),
  sampled per message. Mail *not* selected is not exempted — it drops to the next
  weaker policy, so `p=reject; pct=25` quarantines the other three quarters rather
  than delivering them. That makes it a real ramp for `quarantine` and a
  misleading one for `reject`: see [what `pct=` actually
  does](/glossary/dmarc-quarantine-vs-reject/#what-pct-actually-does).
- **`sp=`** sets a separate policy for subdomains. With no `sp=`, subdomains
  inherit `p=`, so it is a tag for exceptions rather than one you need. A
  common shape is enforcing on the domain that sends real mail while staying
  cautious on everything else:

  ```
  v=DMARC1; p=reject; sp=quarantine; rua=mailto:dmarc@yourdomain.com
  ```

  That's `p=reject` for the main domain, with any subdomain you haven't
  gotten to yet held at the softer `quarantine` rather than rejected outright.

Every tag, its default, and whether it is worth publishing:
[DMARC record tags](/guides/dmarc-record-tags/). Note that `pct=` has been removed
from the current specification in favour of `t=`, though receivers still honour it —
[what changed](/guides/dmarc-rfc-9989/).

Moving from `none` to `reject` safely is a process, not a flip of a switch — see
[from monitoring to enforcement](/guides/from-monitoring-to-enforcement/).

## What quarantine and reject mean in practice

Both are requests, not guarantees — the receiving mail system decides how to
carry them out. In practice, quarantine almost always lands in the spam
folder rather than a formal hold, and reject usually means the message is
refused during the SMTP conversation itself, before it becomes a bounce
anyone has to handle. Most receivers honour both closely enough to treat that
as a safe assumption, but "the report says pass and the mail still landed in
spam" is a real thing a receiver's own filtering can still do on top of
DMARC.
