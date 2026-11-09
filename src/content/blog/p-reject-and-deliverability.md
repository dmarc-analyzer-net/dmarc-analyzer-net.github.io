---
title: Nobody rewards p=reject, except the receivers that do
seoTitle: What p=reject did for my mail
description: Every guide says the DMARC policy value doesn't affect your own mail's deliverability. Running mail for a lot of domains, that stopped matching what I saw.
type: engineering
publishDate: 2026-11-09
---

I had two domains sending the same kind of mail, from the same systems, both
authenticating cleanly. One was at `p=none` and one was at `p=reject`. Mail to a
particular Danish mailbox provider arrived reliably from one of them and
struggled from the other, and it was not the one I expected to be struggling.

By the rules as everyone writes them, that shouldn't happen at all.

## The rule everyone quotes

Ask whether `p=reject` helps deliverability and you get the same answer
everywhere. Google, Yahoo and Microsoft all require bulk senders to publish a
DMARC record, and all three set the bar at `p=none` — Google's sender guidelines
say the policy "can be set to none" in as many words. So for your own,
correctly authenticated mail, the
[policy value](/glossary/dmarc-policy/) shouldn't matter.

Worth being precise about what those rules actually ask, because it gets
garbled a lot: the *policy* can be `none`, but DMARC still has to **pass**. A
record saying `p=none` on a domain whose mail aligns with neither SPF nor DKIM
does not satisfy anybody. The policy value is the part that's relaxed.

I believed the rest of it too. On paper it's correct, and none of the big
providers publish anything saying they treat `p=none` worse.

But those three aren't the only place your mail goes.

## What I kept seeing instead

I run mail for a platform and its tenants, which means a lot of domains and a
lot of aggregate reports. Over a couple of years I built up a pattern I
couldn't explain with the official rules: a handful of receivers delivered
noticeably better to domains at enforcement than to comparable domains at
`p=none`. Same senders, same content, authentication passing in both cases. The
policy was the difference that was left.

The clearest case has been one Danish consumer mail platform. I'm not going to
name it: I can't see its filters, nobody outside it can, and a pattern I can't
reproduce on demand isn't enough to put a company's name next to. What I can
say is that it was consistent enough, for long enough, that I stopped filing it
under coincidence.

## The part that changed how I think about it

None of what follows turns on any particular receiver.

Your DMARC policy is published once, in one TXT record, for the whole internet.
You cannot serve `p=none` to Gmail and `p=reject` to everyone else. Every
receiver reads the same record.

So the question was never "does Gmail reward `p=reject`?" It's "is there *any*
receiver I send to that does?" If even one does, and it holds a meaningful share
of your recipients, then enforcement improves your delivery overall — not evenly,
but on the total. And it costs nothing at the receivers that don't care, because
the mail they're judging passes either way.

That reframing is why I stopped treating the Danish thing as a curiosity. It
doesn't need to be a big receiver. It needs to exist.

## Why I'm not going to show you a percentage

Several vendors in this space publish deliverability gains after enforcement —
figures somewhere in the five-to-twenty percent range, depending on who's
selling. It would be easy to reach for one of those here, and I'm not going to,
though not because I think they're invented.

It's that none of them comes with a method. No population, no dates, no
statement of what was measured against what, no account of which customers were
excluded. A deliverability figure without those is a marketing asset rather than
a measurement, and borrowing one to prop up my own hunch would only launder it.
A number worth printing carries its method, the way the
[survey posts](/blog/dmarc-t-tag-three-months/) do — which is a good deal more
work than quoting somebody else's.

So take the pattern for what it is: one operator's experience across a lot of
domains, with no controlled experiment behind it.

## The reasons that don't depend on anyone's filters

Three of them, and these I can argue from the mechanics rather than from what I
think I saw:

**Nobody can spoof you.** At `p=none`, anyone can send as your domain and
receivers are only asked to watch it happen. Phishing sent in your name still
lands against your domain's reputation at every receiver that tracks it. At
`p=reject` that mail is refused before it can do that. This is the one that
actually compounds.

**BIMI needs enforcement.** If you want your logo beside your mail in supporting
inboxes, [BIMI](/glossary/bimi/) requires `p=quarantine` or `p=reject` applied to
all of your mail — a leftover `pct=` or `t=y` disqualifies you.

**Getting there forces the cleanup.** You can't reach enforcement without
finding every system that sends as your domain and fixing its SPF or DKIM. I
suspect this is where most of the real gain lives, and that the policy value
gets the credit for it. A domain that reached `p=reject` is a domain
where somebody went through the senders one by one. That's a different domain
from the one it was six months earlier, whatever the record says.

## Where it goes wrong

The risk isn't the policy. It's not knowing what sends as you.

A newsletter tool, a CRM, an invoicing system and a helpdesk can all send as one
domain, and any of them can be quietly failing alignment. At `p=none` that is
invisible — the mail goes out, the reports record a failure, and nothing breaks.
At `p=reject` it gets refused, usually on the day someone needed it. So you
don't flip the switch on day one: you read the
[aggregate reports](/glossary/dmarc-aggregate-report/) first, fix every sender,
and then move. The staged version is in
[from monitoring to enforcement](/guides/from-monitoring-to-enforcement/).

Which is a lot of reports to read across a lot of domains, and is roughly why I
started building [DMARC Analyzer](/) in the first place — one place to see, per
domain, what's actually standing between `p=none` and `p=reject`.

## What I'm not claiming

- **This isn't a controlled study.** I can see what arrives and what doesn't. I
  can't see inside anyone's spam filter, and I never ran the two policies on
  otherwise identical domains with everything else held still.
- **`p=reject` won't fix a bad list.** If authenticated mail is landing in spam,
  look at reputation, engagement, content and list hygiene first. DMARC removes
  one failure mode out of several.
- **Most receivers probably don't care.** As far as anyone outside can tell,
  Gmail doesn't treat an enforced domain's authenticated mail better. The
  argument only works because the ones that do care get the same record anyway.

If your domains are parked at `p=none` because that's what the bulk-sender rules
asked for, the rules were a floor and you've been treating them as a
specification. Moving up is safe once the reports are clean. In my experience
it's also worth something — I just can't tell you exactly how much, and neither
can anyone who's quoting you a percentage.
