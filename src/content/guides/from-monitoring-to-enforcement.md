---
title: From monitoring to enforcement
description: Move a domain from p=none to p=reject without dropping real mail — the staged, report-driven process to reach full DMARC enforcement safely.
publishDate: 2026-07-20
---

Enforcement — `p=reject` — is the point of DMARC. It is also where people get
nervous, because a mistake means legitimate mail gets rejected. The fix is not
courage; it is doing it in stages, driven by your
[aggregate reports](/glossary/dmarc-aggregate-report/).

## Stage 0 — Monitor until it's boring

Start at [`p=none`](/glossary/dmarc-policy/) and stay there until you can account
for **every** source in your reports. The goal: no legitimate sender is failing
[alignment](/glossary/dmarc-alignment/). Fix each one by adding it to
[SPF](/glossary/spf/) or enabling [DKIM](/glossary/dkim/) for it.

Don't move on while a real sender still fails. That is the single most common
way to break mail.

## Stage 1 — Quarantine a slice

Once the reports are clean, move to `quarantine` — but only for a fraction of
mail, using `pct`:

```
v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@yourdomain.com
```

Roughly a quarter of *failing messages* now goes to spam. Note that `pct` samples
per message, not per sender: every failing source gets about a quarter of its mail
quarantined, rather than a quarter of your senders being affected and the rest
untouched. That is why the symptom of an unfinished rollout is "some of our
invoices arrive and some don't" rather than one system breaking cleanly.

Watch the reports (and your support inbox) for a week or two. Seeing nothing
unexpected? Raise `pct` toward 100.

## Stage 2 — Full quarantine, then reject

With `pct=100; p=quarantine` stable, switch to reject:

```
v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com
```

> **Don't ramp reject with `pct`.** It does not do what the `quarantine` ramp did.
> Mail *not* selected by `pct=` is not exempted — it drops to the next weaker
> policy. So `p=reject; pct=25` rejects about a quarter of failing mail and
> **quarantines the other three quarters**; none of it is delivered normally. The
> quarantine ramp works because the policy below `quarantine` is `none`; there is
> no such headroom under `reject`. If you want a gradual move to reject, ramp by
> *scope* instead — enforce on one subdomain at a time with `sp=`, or finish the
> `quarantine` stage properly and then switch in one step.

At `p=reject`, mail that fails DMARC is refused at the SMTP transaction. Note the
scope of what that buys: it stops forgery of this exact domain at receivers that
honour the policy. Receivers are permitted to override it, and it does nothing
about lookalike domains (`yourc0mpany.com`) or display-name spoofing, neither of
which is a DMARC failure for your domain at all.

## Stage 3 — Keep watching

Enforcement is not "set and forget". New sending tools appear, keys rotate, and
providers change. Keep the reports flowing so a new failing source shows up as a
blip rather than a support ticket — the whole point of publishing `rua=` in the
first place.

New here? Start by
[publishing your first DMARC record](/guides/publish-your-first-dmarc-record/).
