---
title: Why your email is failing DMARC (and how to fix it)
seoTitle: 'Why email fails DMARC & how to fix it'
description: Email failing DMARC? Learn what a DMARC failure actually means, the handful of causes behind it, and exactly how to diagnose and fix each one.
publishDate: 2026-07-23
---

A DMARC failure looks alarming in a report, but it almost always comes down to
one of a few well-understood causes. This guide explains what "failing DMARC"
really means, then walks through each cause and its fix — in the order worth
checking them.

## The one rule behind every DMARC failure

A message **passes DMARC** when *either* [SPF](/glossary/spf/) *or*
[DKIM](/glossary/dkim/) does two things at once:

1. **Authenticates** — the check itself passes, and
2. **Aligns** — the domain it authenticated matches your `From:` domain.

If neither SPF nor DKIM manages both, the message **fails DMARC**. That's it.
Every "dmarc fail" you'll ever see is some version of *authentication broke*, or
*authentication passed but didn't align*. The second one trips up almost
everyone, so start there.

## "SPF pass but DMARC fail" — the alignment trap

This is the single most common confusion. Your report shows SPF **pass**, yet
DMARC **fails**. How?

SPF authenticates the **envelope sender** (the hidden `Return-Path`), not the
`From:` address your recipients see. When you send through a marketing platform
or ESP, the envelope is often *their* domain (e.g. `bounces.sendgrid.net`) while
your `From:` is `you@yourdomain.com`. SPF passes for *their* domain — but that
domain doesn't [align](/glossary/dmarc-alignment/) with yours, so it earns you
nothing under DMARC.

**Fix:** get alignment, not just authentication. Either

- configure a **custom Return-Path / bounce domain** on your sending platform
  (usually a CNAME on a subdomain of yours), so SPF authenticates *your* domain, or
- rely on **aligned DKIM** instead (below) — often the easier path with ESPs.

You only need *one* aligned mechanism, so a correctly aligned DKIM signature
makes the SPF-alignment problem moot.

## Cause 1 — a sending service you never authorized

If a legitimate service (CRM, help desk, invoicing tool, newsletter) sends as
your domain but you never set it up for authentication, it will fail. Every such
source shows up in your [aggregate reports](/glossary/dmarc-aggregate-report/).

**Fix:** for each real source, add its SPF `include:` and publish its DKIM key
(most providers give you a selector and a CNAME/TXT to add). Then confirm it
aligns to your `From:` domain.

## Cause 2 — SPF is broken

Even when SPF *should* align, the record itself can fail:

- **Too many DNS lookups.** SPF allows a maximum of **10**. Chained `include:`s
  blow past this and cause a `permerror` — which counts as a failure.
- **More than one SPF record.** A domain must have exactly **one** `TXT` SPF
  record. Two records is also a `permerror`.
- **A missing sender.** The sending IP simply isn't covered by any mechanism.

**Fix:** keep a single record, flatten or prune `include:`s to stay at or under 10
lookups, and make sure every real sender is represented. Example of a clean one:

```
v=spf1 include:_spf.google.com include:sendgrid.net -all
```

## Cause 3 — DKIM isn't signing (or is signing wrong)

DKIM fails when the signature can't be verified: the key isn't published, the
**selector** is wrong, the provider isn't signing at all, or the message was
modified in transit (some mailing lists rewrite bodies and break the signature).

**Fix:** publish the exact selector record your provider specifies, confirm the
provider has DKIM *enabled* (it's often off by default), and check that the
signature's `d=` domain aligns with your `From:` domain. Aligned DKIM is the
most robust way to pass DMARC because, unlike SPF, it survives most forwarding.

## Cause 4 — forwarding

Auto-forwarded mail — someone forwards from `@yourdomain` to a personal Gmail —
**breaks SPF**, and it is worth being precise about why, because the usual
explanation is backwards.

Plain forwarding breaks SPF *because the envelope doesn't change.* The forwarder
relays your original `MAIL FROM` from **its own** IP address, and that IP is not in
your SPF record, so the check fails. Nothing was rewritten; that is the problem.

Forwarders that *do* rewrite the envelope — the technique is called SRS — make SPF
**pass**, for their domain. Which then fails
[alignment](/glossary/dmarc-alignment/), because the domain that passed is no
longer yours. So SRS is not a fix for DMARC either; it just moves the failure one
step along.

Some forwarders also modify the message — a footer, a rewritten subject — which
**breaks DKIM** on top. Either way the result is a DMARC failure for mail you did
legitimately send.

**Fix:** there's no perfect fix, but aligned DKIM survives forwarding that doesn't
modify the message, and [ARC](/glossary/arc/) lets participating receivers honor a
prior "pass" — read what it does and doesn't buy before relying on it. Don't
tighten your policy based on forwarding failures alone: they never reach zero, so
waiting for them to is not a plan.

## Cause 5 — a subdomain with no record

Mail from `news.yourdomain.com` is governed by that subdomain's DMARC — or, if
it has none, by your organizational policy's subdomain tag (`sp=`), or by `p=`
itself when no `sp=` is published. A forgotten subdomain sending unauthenticated
mail will fail either way.

**Fix:** publish DMARC (and SPF/DKIM) on active subdomains, and treat `sp=` on your
main [policy](/glossary/dmarc-policy/) as the exception rather than the default —
subdomains already inherit `p=`. For names that don't resolve at all, `np=` covers
them specifically; the [tag reference](/guides/dmarc-record-tags/) has both.

## How to diagnose which one it is

Don't guess — the answer is in the data. DMARC
[aggregate reports](/glossary/dmarc-aggregate-report/) list every source sending
as your domain and show, per source, whether SPF and DKIM **authenticated** and
whether they **aligned**. That two-by-two (auth × alignment) tells you exactly
which cause above applies:

- SPF pass but not aligned → Cause "alignment trap" / Cause 1
- SPF permerror → Cause 2
- DKIM fail or no signature → Cause 3
- Passes for known mail but fails only on forwarded paths → Cause 4

Learn to read them in [how to read a DMARC aggregate
report](/guides/how-to-read-a-dmarc-aggregate-report/).

## Quick checklist

- [ ] Is at least one of SPF or DKIM **aligned** to your `From:` domain?
- [ ] Exactly **one** SPF record, under **10** DNS lookups?
- [ ] DKIM **enabled** at every provider, with the correct selector published?
- [ ] Every legitimate sender in your reports **accounted for**?
- [ ] A deliberate **`sp=`** and records on active **subdomains**?

## What next

Once failures are down to only the sources you expect, you're ready to move from
monitoring toward enforcement — safely, in stages. See
[from monitoring to enforcement](/guides/from-monitoring-to-enforcement/), and if
you haven't yet, [publish your first DMARC
record](/guides/publish-your-first-dmarc-record/) in monitoring mode first.
