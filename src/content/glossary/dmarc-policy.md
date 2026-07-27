---
term: DMARC policy
description: The DMARC policy (p=) tells receivers whether to monitor, quarantine, or reject mail that fails authentication — the dial you turn toward enforcement.
aliases: ["p=none", "p=quarantine", "p=reject"]
related: ["dmarc", "dmarc-aggregate-report", "dmarc-alignment", "dmarc-quarantine-vs-reject"]
---

The **DMARC policy** is the `p=` tag in your [DMARC](/glossary/dmarc/) record. It
tells receiving servers what to do with mail that fails
[alignment](/glossary/dmarc-alignment/):

- **`p=none`** — take no action; just send [reports](/glossary/dmarc-aggregate-report/).
  This is monitoring mode, and where every domain should start.
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
  inherit `p=`.

Moving from `none` to `reject` safely is a process, not a flip of a switch — see
[from monitoring to enforcement](/guides/from-monitoring-to-enforcement/).
