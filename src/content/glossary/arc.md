---
term: ARC (Authenticated Received Chain)
description: ARC lets a forwarder or mailing list record the authentication result it saw, so a later receiver can choose to honour a pass its own checks would fail.
aliases: ["Authenticated Received Chain", "ARC seal", "ARC headers"]
related: ["dkim", "dmarc-alignment", "dmarc", "dmarc-aggregate-report"]
---

**ARC** (Authenticated Received Chain, [RFC 8617](/rfc/8617/), and still
Experimental) is a set of mail headers that a forwarder or
mailing list adds to record what [SPF](/glossary/spf/) and
[DKIM](/glossary/dkim/) said *before* it handled the message. The idea is that a
receiver further down the line can see the message authenticated correctly on
arrival at the intermediary, even though it no longer does.

The problem it addresses is real and common: plain forwarding breaks SPF, and
mailing lists that add a subject tag or a footer break the DKIM signature. The
mail is legitimate, and it fails [DMARC](/glossary/dmarc/) anyway — the case
described in [why your email is failing DMARC](/guides/fix-dmarc-failure/) and in
[what breaks at enforcement](/glossary/dmarc-quarantine-vs-reject/).

## What it adds to a message

Each hop adds three header fields, together called an ARC Set, numbered with an
`i=` instance so the chain can be read in order:

| Header field | What it carries |
|---|---|
| `ARC-Authentication-Results` | The SPF and DKIM results this hop saw on arrival |
| `ARC-Message-Signature` | A DKIM-style signature over the message as this hop received it |
| `ARC-Seal` | A signature over the ARC headers themselves, chaining this hop to the previous ones |

The seal carries a chain validation value: `cv=none` on the first hop, then
`cv=pass` while the chain holds, or `cv=fail` once it doesn't.

## What ARC buys you

One thing: a receiver that trusts the intermediary *may* accept mail that fails
DMARC on arrival, because the chain shows it passed earlier. That is a local
policy decision on the receiving side, and it is the whole of the mechanism.

## What ARC does not buy you

This is the part that matters, because ARC is usually raised as a reason to
postpone enforcement.

- **There is nothing to publish.** ARC is not a DNS record and not a DMARC tag.
  You cannot switch it on for your domain — it is added by intermediaries handling
  your mail, or it isn't.
- **It is not a DMARC pass.** The message still fails DMARC. A receiver honouring
  the chain is choosing to override its own result.
- **It is entirely the receiver's choice.** Honouring a chain means trusting the
  sealer, and nothing obliges anyone to do either.
- **It fixes nothing you own.** If your own mail fails
  [alignment](/glossary/dmarc-alignment/), ARC is irrelevant — fix the alignment.
- **It is not widely used.** Ten years of work has gone into letting mailing lists
  preserve the `From:` header, ARC being the prominent attempt, and the current
  DMARC standard says plainly that none of those methods has achieved wide
  adoption. What list software actually does is rewrite the `From:` header so the
  mail aligns with the list's own domain.

Which leads to the conclusion that matters operationally: **ARC is not a reason to
stay at `p=none`.** Forwarding and list failures will never reach zero, with or
without it, so "wait until nothing fails" is not an achievable exit criterion.
Enforce on the basis of the sources you control — see
[monitoring to enforcement](/guides/from-monitoring-to-enforcement/).

In your reports, forwarded and list traffic shows up as failures and mostly is
not spoofing. Telling the two apart is the everyday work of
[reading an aggregate report](/guides/how-to-read-a-dmarc-aggregate-report/), and
across a portfolio of domains it is what [DMARC Analyzer](/) is for.
