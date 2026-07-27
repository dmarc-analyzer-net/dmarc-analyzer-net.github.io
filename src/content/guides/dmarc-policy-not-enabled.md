---
title: What "DMARC policy not enabled" means (and how to fix it)
seoTitle: '"DMARC policy not enabled": how to fix'
description: Seeing "DMARC quarantine/reject policy not enabled"? Here's what that warning means, why checkers flag it, and how to enable an enforcing policy safely.
publishDate: 2026-07-23
updatedDate: 2026-07-25
---

If a DMARC checker shows **"DMARC Quarantine/Reject policy not
enabled,"** it isn't saying DMARC is broken — it's saying your policy is set to
**monitor only**. Your record exists, but it's telling receivers to take *no
action* on mail that fails. Here's what to do about it.

## What the warning actually means

The message points at your [`p=` policy](/glossary/dmarc-policy/). You almost
certainly have:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` is **monitoring mode** — receivers report on failures but still deliver
the mail. Checkers flag this because a monitoring-only policy provides visibility
but **no protection**: a spoofer's mail isn't quarantined or rejected. The warning
is nudging you toward `p=quarantine` or `p=reject`.

It is a warning, not an error. `p=none` is the correct and recommended place to
*start* — the problem is only that it's a place many domains never leave.

## How to fix it (safely)

Don't just flip to `reject` — you could block legitimate mail you haven't
accounted for yet. Move in stages:

1. **Stay on `p=none`** until your [aggregate
   reports](/guides/how-to-read-a-dmarc-aggregate-report/) show every legitimate
   sender passing and [aligned](/glossary/dmarc-alignment/).
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
enforcement](/guides/from-monitoring-to-enforcement/). Not sure which enforcing
policy to pick? See [quarantine vs
reject](/glossary/dmarc-quarantine-vs-reject/).

## How to know you're ready

The warning tempts people to change `p=` immediately. Before you do, your reports
should show all of the following:

- **Every sending source is identified.** No unexplained IPs sending volume you
  can't attribute.
- **Legitimate mail passes alignment**, not merely SPF or DKIM in isolation — a
  message can pass SPF and still fail DMARC if the passing domain isn't your
  `From:` domain.
- **The pattern is stable over weeks, not days.** Monthly invoicing runs,
  quarterly campaigns, and annual renewals send from systems that are invisible
  in a single week of data.
- **You know who to call** when a sender you'd forgotten breaks.

A fortnight of clean reports across a full billing cycle is a reasonable bar.

## "Not enabled" but you meant to enable it

A few things that cause the warning even when you thought you were enforcing.
Our [DMARC record checker](/tools/dmarc-checker/) tests for all of them at once
and shows the record it actually found:

- **The record is on the wrong host.** DMARC must live at
  `_dmarc.yourdomain.com`, not the root. If your DNS host appends the domain
  automatically, typing the full name creates
  `_dmarc.yourdomain.com.yourdomain.com` — see [no DMARC record
  found](/guides/no-dmarc-record-found/).
- **Two DMARC records exist.** Duplicates are treated as no policy at all, so an
  old `p=none` alongside your new `p=reject` leaves you unenforced.
- **A subdomain has its own weaker policy** — or none, falling back to `sp=`. A
  root at `p=reject; sp=none` is still flagged for subdomains.
- **`pct=` is below 100.** Some checkers report partial enforcement as not
  enabled. Note what the unselected share actually gets, though: it is not
  exempted, it drops to the next weaker policy. At `p=reject; pct=25` the other
  three quarters are quarantined, not delivered — see [what `pct=` actually
  does](/glossary/dmarc-quarantine-vs-reject/#what-pct-actually-does).
- **You're reading a cached answer.** Give DNS an hour before concluding the
  change didn't take.

Editing on Microsoft 365, GoDaddy, or cPanel? The per-provider steps are under
[DMARC setup](/dmarc-for/).

## What next

Confirm the change propagated, then keep watching reports as you tighten. Across
a portfolio of client domains this becomes the recurring job — every domain at a
different stage, each with its own reports to read before the next step is safe.
That is what [DMARC Analyzer](/) tracks for you: every domain's current policy
and what stands between it and enforcement, self-hosted, with no per-domain fee.

If mail starts failing after you enforce, work through [why your email is failing
DMARC](/guides/fix-dmarc-failure/).
