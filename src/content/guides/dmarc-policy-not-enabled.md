---
title: What "DMARC policy not enabled" means (and how to fix it)
description: Seeing "DMARC quarantine/reject policy not enabled"? Here's what that warning means, why checkers flag it, and how to enable an enforcing policy safely.
publishDate: 2026-07-23
---

If a checker (like MxToolbox) shows **"DMARC Quarantine/Reject policy not
enabled,"** it isn't saying DMARC is broken — it's saying your policy is set to
**monitor only**. Your record exists, but it's telling receivers to take *no
action* on mail that fails. Here's what to do about it.

## What the warning actually means

The message points at your [`p=` policy](/glossary/dmarc-policy). You almost
certainly have:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` is **monitoring mode** — receivers report on failures but still deliver
the mail. Checkers flag this because a monitoring-only policy provides visibility
but **no protection**: a spoofer's mail isn't quarantined or rejected. The warning
is nudging you toward `p=quarantine` or `p=reject`.

## How to fix it (safely)

Don't just flip to `reject` — you could block legitimate mail you haven't
accounted for yet. Move in stages:

1. **Stay on `p=none`** until your [aggregate
   reports](/guides/how-to-read-a-dmarc-aggregate-report) show every legitimate
   sender passing and [aligned](/glossary/dmarc-alignment).
2. **Move to `p=quarantine`**, optionally ramping with `pct=`:
   ```
   v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@yourdomain.com
   ```
3. **Move to `p=reject`** once quarantine is clean — full enforcement, and the
   state that clears the warning:
   ```
   v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com
   ```

The whole progression is covered in [from monitoring to
enforcement](/guides/from-monitoring-to-enforcement). Not sure which enforcing
policy to pick? See [quarantine vs
reject](/glossary/dmarc-quarantine-vs-reject).

## "Not enabled" but you meant to enable it

A few things that cause the warning even when you thought you were enforcing:

- **The record is on the wrong host.** DMARC must live at
  `_dmarc.yourdomain.com`, not the root.
- **A subdomain has its own weaker policy** — or none, falling back to `sp=`.
- **Editing on Office 365 / GoDaddy / cPanel:** make sure you saved the `_dmarc`
  `TXT` and there's no second, older DMARC record overriding it. See the
  per-provider steps under [DMARC setup](/dmarc-for).

## What next

Confirm the change propagated, then keep watching reports as you tighten. If mail
starts failing after you enforce, work through [why your email is failing
DMARC](/guides/fix-dmarc-failure).
