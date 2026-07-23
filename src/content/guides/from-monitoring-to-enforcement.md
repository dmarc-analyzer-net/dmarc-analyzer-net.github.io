---
title: From monitoring to enforcement
description: Move a domain from p=none to p=reject without dropping real mail — the staged, report-driven process to reach full DMARC enforcement safely.
publishDate: 2026-07-20
---

Enforcement — `p=reject` — is the point of DMARC. It is also where people get
nervous, because a mistake means legitimate mail gets rejected. The fix is not
courage; it is doing it in stages, driven by your
[aggregate reports](/glossary/dmarc-aggregate-report).

## Stage 0 — Monitor until it's boring

Start at [`p=none`](/glossary/dmarc-policy) and stay there until you can account
for **every** source in your reports. The goal: no legitimate sender is failing
[alignment](/glossary/dmarc-alignment). Fix each one by adding it to
[SPF](/glossary/spf) or enabling [DKIM](/glossary/dkim) for it.

Don't move on while a real sender still fails. That is the single most common
way to break mail.

## Stage 1 — Quarantine a slice

Once the reports are clean, move to `quarantine` — but only for a fraction of
mail, using `pct`:

```
v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@yourdomain.com
```

Failing mail from a quarter of sources now goes to spam. Watch the reports (and
your support inbox) for a week or two. Seeing nothing unexpected? Raise `pct`
toward 100.

## Stage 2 — Full quarantine, then reject

With `pct=100; p=quarantine` stable, switch to reject — again ramping if the
domain is high-volume:

```
v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com
```

At `p=reject`, mail that fails authentication is refused outright. Spoofed mail
using your exact domain no longer lands.

## Stage 3 — Keep watching

Enforcement is not "set and forget". New sending tools appear, keys rotate, and
providers change. Keep the reports flowing so a new failing source shows up as a
blip rather than a support ticket — the whole point of publishing `rua=` in the
first place.

New here? Start by
[publishing your first DMARC record](/guides/publish-your-first-dmarc-record).
