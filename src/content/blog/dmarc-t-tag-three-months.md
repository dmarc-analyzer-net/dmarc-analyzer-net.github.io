---
title: Three months after RFC 9989, new DMARC records still reach for pct
seoTitle: New DMARC records still use pct
description: I followed a million domains for three months after DMARC retired pct. Brand-new records include it 293 times as often as its replacement.
type: research
publishDate: 2026-10-30
method: "Population: the Tranco top 1,000,000 list GQP4K, as surveyed on 2026-08-10, followed as the same 1,000,000 domains in the 2026-09-10 and 2026-10-10 snapshots. Each monthly run surveys the current list plus every domain seen before, so the figures here filter to domains first seen on 2026-08-10; domains that joined Tranco later are left out. A _dmarc lookup was conclusive for 988,653 domains in August, 987,925 in September and 987,282 in October; timeouts and SERVFAILs are excluded rather than counted as having no record, while NXDOMAIN counts as an answer (no policy). Tag counts use domains publishing a DMARC record as the base: 464,476, 468,157 and 471,395. 'Added' and 'new' compare each domain's August and October records: a new record is a domain with no DMARC record in August and one in October (9,770 domains). t counts as published whatever its value, which is stored as written; pct counts when it holds a whole number from 0 to 100. Aggregates only; no domain is named."
---

In May, RFC 9989 replaced the old DMARC specification. One of the smaller
changes: the `pct` tag became historic, and a new tag called `t` took over the
one job `pct` was reliably good at, which is test mode. Small change, easy to
miss, and a good test of how fast the email world moves when a standard says so.

So in August I pointed my DNS survey at the Tranco top million and wrote down
the starting line. The plan was to measure the same domains every month and
watch `t` climb.

My first read of the October numbers was that `t` was going backwards. That
turned out to be the wrong question. The interesting thing isn't who removed
`t`. It's who is still *adding* `pct`.

## First, the headline that isn't one

Same million domains, three snapshots:

| | Aug 10 | Sep 10 | Oct 10 |
|---|---:|---:|---:|
| Domains with a DMARC record | 464,476 | 468,157 | 471,395 |
| …publishing `pct` (historic) | 122,751 | 122,713 | 123,290 |
| …publishing `t` | 686 | 685 | 672 |
| …publishing `t=y` (test mode) | 106 | | 106 |

On the face of it, `t` dropped from 686 to 672. But `t` has two values, and
`t=n` is the default. Writing `t=n` in a record means exactly the same as not
writing `t` at all. Of the 41 domains that removed `t` between August and
October, 28 had `t=n`. Nothing changed for them; they just stopped spelling out
the default.

The value that actually does something is `t=y`, and it hasn't moved: 106
domains in August, 106 in October. Twelve left it and twelve arrived.

So `t` isn't going backwards. It's standing still.

## Who is still adding pct

Here's the part that surprised me. Between August and October, **2,259
domains that already had a DMARC record added `pct` to it**. These aren't old
records nobody has looked at since 2019. Somebody opened them, after the tag
was retired, and put it in. For 1,436 of those domains the policy itself also
changed in the same two months, so these are people actively working on their
DMARC setup, and still reaching for the old tag.

It's the same with records that didn't exist before. 9,770 domains in this
population published a DMARC record for the first time between August and
October:

- **1,172** of the new records include `pct`.
- **4** include `t`.

That's 293 to 1, in records written months after the standard changed. My
guess is that people are copying from guides, generators and provider setup
pages that haven't been updated, and that most of those still say `pct`. I can't
prove where any single record came from, but the shape of it is hard to read
any other way. If you write DMARC guidance and it still tells people to add
`pct`, you're part of this table.

## Most pct tags do nothing anyway

Now the funny bit. Of the 122,751 domains publishing `pct` in August,
**109,539 set it to 100**. That's 89%. And 100 is the default. Nine out of ten
`pct` tags on the internet ask receivers to do exactly what they would have done
anyway.

The new records are the same: of the 1,172 new ones with `pct`, 1,077 say
`pct=100`. People aren't adding the tag to ramp up enforcement. They're adding
it because the example they copied had it.

That's the real story in these numbers. Not that anyone is resisting RFC 9989,
but that DMARC records are mostly copied once and never thought about again,
and the examples being copied are out of date.

## Is anyone using pct for what it was for?

`pct` below 100 is the old way to ramp up enforcement gradually. 13,212 domains
did that in August and 13,234 in October, so the ramp is as popular as ever.
`pct=0`, the old way to say "watching, don't act yet", held about 1,090 domains
both months. The new way to say that, `t=y`, held 106.

That gap is the honest measure of adoption so far: for every domain using the
new test mode, about ten are still using the old one.

## Why measure something this boring

Because it can't be measured later. There's no archive of what every domain's
DMARC record said last month. If `t` gets anywhere by 2028, the interesting
question will be *how*: slowly, in a jump when a big provider updates its
setup page, or only once receivers stop honouring `pct`. Answering that needs a
series, and a series needs every point. A month I don't collect is gone.

So I'll keep collecting. The next snapshot is on November 10.

## What I'm not claiming

- **This is one population.** The Tranco list ranks popular domains. It's not a
  census of the internet, and its tail isn't a random sample of the internet's
  tail.
- **Lookups that failed are left out, not guessed.** Around 12,000 domains a
  month timed out or got a SERVFAIL. Counting them as "no DMARC" would bias
  everything downward by exactly the domains with flaky DNS, which aren't a
  random subset.
- **I don't know why any single domain changed.** I can see that a record
  changed, not who changed it or what they copied it from.

If you publish `pct=100`, you can delete it. Nothing will happen, and that's
the point. If you use a lower value to ramp up enforcement, there's no direct
replacement for that, and
[the guide to what changed in RFC 9989](/guides/dmarc-rfc-9989/) covers what to
do instead. And if you're curious about the scanner behind these numbers, it
identifies itself and explains how to opt out on the
[research page](/research/).
