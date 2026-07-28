---
title: "SPF, DKIM & DMARC: how the three work together"
seoTitle: 'SPF, DKIM & DMARC explained'
description: SPF, DKIM, and DMARC explained together — what each one actually does, how they combine to stop email spoofing, and why you need all three.
publishDate: 2026-07-23
---

SPF, DKIM, and DMARC are three separate standards that only do their real job
**together**. SPF and DKIM are the two ways a receiver can check that a message
is genuine; DMARC is the layer that ties them to your domain, tells receivers
what to do about fakes, and reports back to you. Here's how they fit.

## The 30-second version

- **[SPF](/glossary/spf/)** says *which servers are allowed to send* for your
  domain.
- **[DKIM](/glossary/dkim/)** adds a *tamper-proof signature* proving a message
  really came from your domain and wasn't altered.
- **[DMARC](/glossary/dmarc/)** ties SPF and DKIM to the `From:` address people
  see, tells receivers what to do when both fail, and sends you **reports**.

You need all three. SPF and DKIM are the checks; DMARC is the policy and
visibility that make those checks actually protect your domain.

## SPF — who is allowed to send

SPF (Sender Policy Framework) is a DNS record listing the servers and services
authorized to send email for your domain. When a message arrives, the receiver
looks up your SPF record and checks whether the sending server is on the list.

```
v=spf1 include:_spf.google.com include:sendgrid.net -all
```

Its weakness on its own: SPF checks the hidden *envelope* sender, not the
`From:` address recipients see — so it can pass for a lookalike. That's exactly
the gap DMARC closes. (See [SPF record syntax and
examples](/guides/spf-record-syntax/) for the full breakdown.)

## DKIM — a signature that proves authenticity

DKIM (DomainKeys Identified Mail) attaches a cryptographic **signature** to every
message, generated with a private key only you hold. The matching public key lives
in your DNS, at a name made of a **selector** you choose and the fixed label
`_domainkey`:

```
selector1._domainkey.yourdomain.com
```

The signature names the selector in `s=` and the signing domain in `d=`, so a
receiver knows exactly which key to fetch. Verifying it proves two things: some
domain holding the private key **took responsibility** for the message, and the
signed parts weren't modified in transit. Note what that is *not* — proof of where
the message originated. A mailing list or an outbound relay can sign validly with
its own `d=`, which is precisely why DMARC also checks
[alignment](/glossary/dmarc-alignment/).

Because the selector is part of the name, you can publish several keys at once and
rotate without downtime. Unlike SPF, DKIM survives most **forwarding** — which is
why aligned DKIM is the sturdiest way to pass DMARC.

## DMARC — the layer that makes them count

[DMARC](/glossary/dmarc/) (Domain-based Message Authentication, Reporting &
Conformance) adds the three things SPF and DKIM lack on their own:

1. **Alignment** — it requires that the domain SPF or DKIM authenticated
   actually *matches* your `From:` domain. This is what stops a spoofer from
   passing SPF for *their* domain and riding your `From:`. See
   [DMARC alignment](/glossary/dmarc-alignment/).
2. **Policy** — your [`p=` policy](/glossary/dmarc-policy/) tells receivers what
   to do with mail that fails: `none` (monitor), `quarantine` (spam folder), or
   `reject` (block).
3. **Reporting** — receivers send you [aggregate
   reports](/glossary/dmarc-aggregate-report/) showing every source sending as
   your domain.

A message **passes DMARC** when *either* SPF *or* DKIM both authenticates **and**
aligns. Just one aligned mechanism is enough.

## Alignment, concretely

"Aligned" means the domain that authenticated matches the domain in the `From:`
header. DMARC offers two strictnesses, and **relaxed is the default**:

| Mode | `From:` | Authenticated domain | Aligned? |
|---|---|---|---|
| Relaxed | `yourdomain.com` | `mail.yourdomain.com` | Yes — same organizational domain |
| Strict | `yourdomain.com` | `mail.yourdomain.com` | No — must match exactly |
| Either | `yourdomain.com` | `sendgrid.net` | **No** |

Set strictness with `adkim=` (DKIM) and `aspf=` (SPF), each `r` for relaxed or
`s` for strict. Leave them alone unless you have a specific reason — relaxed is
almost always what you want.

That third row is the one that matters in practice. A marketing platform sending
on your behalf will happily pass SPF for *its own* domain, and that pass does
nothing for you. Fixing it means getting the platform to sign with DKIM as your
domain, or to use a custom Return-Path on your subdomain.

## What breaks if you skip one

| You have | The gap |
|---|---|
| SPF only | Fails the moment mail is forwarded; nothing checks the `From:` |
| DKIM only | Nothing states which servers are legitimate |
| SPF + DKIM, no DMARC | Both can pass for a domain that isn't yours — and you get no reports, so you can't see it happening |
| DMARC at `p=none` forever | Full visibility, zero protection |

The last row is the most common real-world state, and the reason
["DMARC policy not enabled"](/guides/dmarc-policy-not-enabled/) warnings exist.

## The reason this stopped being optional

For years all three were best practice you could postpone. Since **February 2024**
they are entry requirements at the two largest consumer mailbox providers, and that
is the most concrete answer to "why do I have to care about this now".

Anyone sending **more than 5,000 messages a day** to Gmail accounts must:

- **Publish SPF and DKIM** for the sending domain.
- **Publish DMARC.** Google's own wording is explicit that this is a low bar —
  "Your DMARC enforcement policy can be set to none" — so a monitoring record
  satisfies it. You need *a* record, not enforcement.
- **Align.** "The domain in the sender's `From:` header must be aligned with either
  the SPF domain or the DKIM domain" — one of the two is enough, which is why
  [alignment](/glossary/dmarc-alignment/) is the thing to understand rather than
  SPF and DKIM in isolation.
- **Offer one-click unsubscribe** on marketing and promotional mail, via the
  `List-Unsubscribe` headers. Transactional mail is out of scope.
- **Keep the spam rate below 0.30%** as reported in Postmaster Tools.

Yahoo introduced matching requirements on the same timetable, including the 0.3%
spam-rate ceiling, and Microsoft has since added its own for high-volume senders to
consumer Outlook accounts.

Two things worth drawing out. The 5,000/day threshold is per *sending domain to that
provider*, so it catches ordinary companies running a newsletter, not just bulk
marketers. And "aligned SPF **or** DKIM" is a lower bar than DMARC enforcement — but
you cannot tell whether you clear it without reading your
[reports](/glossary/dmarc-aggregate-report/), which is the same work either way.

## How a single message flows through all three

1. Your server sends a message with a DKIM signature.
2. The receiver checks **SPF** (is the sending IP authorized?) and **DKIM** (is
   the signature valid?).
3. **DMARC** asks: did SPF or DKIM pass *and* align with the `From:` domain?
4. If yes → delivered. If no → the receiver applies your `p=` policy and logs it
   in a report.

## Side by side

| | SPF | DKIM | DMARC |
|---|---|---|---|
| Checks | Sending server/IP | Message signature | Alignment + policy |
| Lives in | DNS `TXT` | DNS `TXT` + message header | DNS `TXT` |
| Survives forwarding | No | Usually | — |
| Gives you reports | No | No | **Yes** |

## The reports are the part people underestimate

Publishing all three records takes an afternoon. The ongoing work is the
reporting: every receiver that handles your mail sends an XML file, every day,
per domain. Individually they're unreadable; in aggregate they're the only
picture you get of who is sending as you.

That's what turns DMARC from a checkbox into an operation — and it's what
[DMARC Analyzer](/) exists to do: ingest every report, resolve the sending
sources, and show each domain's path to enforcement. Self-hosted, so client
report data stays on your infrastructure, and unlimited domains at no
per-domain cost.

## What next

Set them up in order: confirm SPF and DKIM exist, then
[publish your first DMARC record](/guides/publish-your-first-dmarc-record/) in
monitoring mode. If mail is already failing, see
[why your email is failing DMARC](/guides/fix-dmarc-failure/). When your reports
are clean, walk the [path to enforcement](/guides/from-monitoring-to-enforcement/).

For the DNS detail behind any of it: [SPF record syntax](/guides/spf-record-syntax/)
term by term, and [DMARC record tags](/guides/dmarc-record-tags/) tag by tag.
