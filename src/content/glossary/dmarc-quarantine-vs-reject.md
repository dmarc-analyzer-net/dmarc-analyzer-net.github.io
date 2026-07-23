---
term: DMARC quarantine vs reject
description: DMARC quarantine sends failing mail to spam; reject blocks it outright. Here's the difference, when to use each, and how to move between them safely.
aliases: ["quarantine vs reject", "p=quarantine vs p=reject"]
related: ["dmarc-policy", "dmarc", "dmarc-alignment"]
---

`quarantine` and `reject` are the two **enforcing** [DMARC
policies](/glossary/dmarc-policy) — the difference is what a receiver does with
mail that fails authentication.

- **`p=quarantine`** — deliver failing mail, but to the **spam/junk** folder. The
  recipient can still find it.
- **`p=reject`** — refuse failing mail outright. It's **never delivered**; the
  sending server gets a bounce.

(The third policy, `p=none`, enforces nothing — it only monitors.)

## When to use each

- Use **`quarantine`** as the cautious middle step after monitoring: spoofed mail
  is hidden from the inbox, but a misconfigured legitimate sender lands in spam
  rather than vanishing — so you notice before it does real damage.
- Use **`reject`** as the destination once quarantine is clean. It's the only
  policy that actually stops spoofed mail from reaching people, and the goal for
  every domain that sends real mail.

## Moving between them safely

Don't jump straight to `reject`. Confirm your [aggregate
reports](/glossary/dmarc-aggregate-report) are clean, then ramp:

```
v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@yourdomain.com
```

`pct=` applies the policy to a percentage of failing mail so you can increase it
gradually before switching to `p=reject`. The full progression is in [from
monitoring to enforcement](/guides/from-monitoring-to-enforcement).
