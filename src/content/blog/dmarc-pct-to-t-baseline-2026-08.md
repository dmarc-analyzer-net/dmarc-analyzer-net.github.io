---
title: "Almost nobody has adopted DMARC's t tag"
description: "We measured a million domains to find the starting line for a change nobody can reconstruct later: 122,751 still publish pct, 686 publish its replacement."
publishDate: 2026-08-11
type: research
author: Michael Fjeldsted
method: "Population: the Tranco top 1,000,000 (list ID GQP4K, generated 2026-08-08), surveyed on 2026-08-10 from a single host. Of 1,000,000 domains, 988,653 returned a conclusive answer for _dmarc — 11,347 timed out or returned SERVFAIL and are excluded from every denominator below rather than counted as having no record. 464,476 published a DMARC record. Percentages involving tags are relative to those 464,476, since a domain without DMARC cannot publish pct or t."
---

RFC 9989 made `pct` historic and introduced `t` in its place. That change is a
year old. We wanted to know how fast the substitution is actually happening —
and that is a question you cannot answer retroactively, because nobody stores
what a domain's DMARC record said last year.

So we started measuring. Here is the starting line.

## The numbers

Of **464,476** domains publishing a DMARC record on 2026-08-10:

| Tag | Domains | Share |
|---|---:|---:|
| `pct` (historic) | 122,751 | 26.4% |
| `t` (its replacement) | 686 | 0.1% |

That is a ratio of **179 to 1**. The substitution has not started; it has barely
been noticed.

The 686 are worth a moment. Every one of them publishes `t=n` — testing off,
apply the policy — and **none of them also publishes `pct`**. These are not
domains hedging between the old tag and the new one. They are domains that
dropped `pct` and adopted its replacement, which is exactly the migration the
RFC describes, performed by about 0.15% of the people it applies to.

## Why the number will be worth more later than it is now

On its own, "0.1% adoption" is unremarkable. A new tag is new.

What makes it worth recording is that **this measurement has a short shelf life
and no replacement.** If `t` adoption reaches 20% in 2028, the interesting
question will be how it got there — whether it climbed steadily, jumped when a
large provider changed a default, or moved only after receivers started
enforcing it. Answering that needs a series, and a series needs a first point.

There is no archive of historical DMARC records to reconstruct one from. You
either measured, or you did not.

## The other thing the data shows

While we were there: DMARC adoption depends heavily on how popular a domain is,
and the effect is larger than we expected.

| Tranco rank | Publishes DMARC |
|---|---:|
| 1–10,000 | 67.2% |
| 10,000–100,000 | 57.3% |
| 100,000–500,000 | 50.4% |
| 500,000–1,000,000 | 42.0% |

Overall adoption across the million is **47.0%**. Had we surveyed only the top
100,000 — a common choice, and statistically ample for most purposes — we would
have reported roughly 58% and been wrong about the internet by eleven points.

The gap is wider still for enforcement. In the top 10,000, **31.5%** publish
`p=reject`. In the last 500,000, **9.0%** do.

And adoption overstates protection generally: of the 464,476 domains with a
DMARC record, **50.2% publish `p=none`**, which asks receivers to do nothing.
Only **23.3%** of all conclusively-measured domains ask receivers to act on a
failure at all.

## One more finding, because it is quietly bad

**2.6%** of domains with an SPF record exceed the RFC 7208 limit of ten DNS
lookups — 16,152 of the 626,708 whose include tree we could fully walk.

Exceeding the limit is a permanent error at the receiver. The domain's SPF stops
working, and nothing tells the owner: no bounce, no warning, no report. It is
the kind of failure that survives for years because it is invisible from the
inside.

We count both the naive lookup count and the real one, because they disagree
substantially. `hubspot.com` looks like one lookup in its own record and needs
four once the include tree is walked; `stripe.com` goes from three to seven;
`github.com` from eight to ten, exactly at the limit. Anyone reporting from the
record alone is understating the problem.

## What we are not claiming

**This is one snapshot of one population.** The Tranco list is a ranking of
popular domains, not a census of the internet, and the tail of that list is not
a random sample of the tail of the internet.

**Inconclusive lookups are excluded, not assumed.** 11,347 domains gave us a
timeout or a SERVFAIL. Counting those as "no DMARC" would have moved adoption
from 47.0% to 47.5% — small, but wrong in a specific direction, since domains
with unreliable DNS are not a random subset.

**We do not measure DKIM.** A DKIM selector can only be found by guessing common
names, so any figure would describe our guess list rather than reality. Saying so
is more useful than a number nobody can trust.

## The method, so you can check it

Every figure above comes from one Parquet snapshot: the Tranco top 1,000,000,
**list ID GQP4K** generated 2026-08-08, surveyed 2026-08-10 over about eleven
hours from a single host that identifies itself in DNS and publishes
[what it does and how to be excluded](/research/).

Per domain we read `_dmarc`, the apex TXT record, `_mta-sts`, `_smtp._tls`,
`default._bimi`, `MX`, `NS` and `DS`, and we walk the SPF include tree in full
rather than counting the terms in the record.

Denominators are always domains where the relevant lookup told us something.
NXDOMAIN counts as an answer — the name does not exist, so there is no policy.
A timeout does not.

We will repeat this monthly. The next one is due on 10 September, and the
question we are actually here to answer is what the second point on the `t` line
looks like.
