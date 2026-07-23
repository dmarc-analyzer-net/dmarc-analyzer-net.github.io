---
title: "SPF, DKIM & DMARC: how the three work together"
description: SPF, DKIM, and DMARC explained together — what each one actually does, how they combine to stop email spoofing, and why you need all three.
publishDate: 2026-07-23
---

SPF, DKIM, and DMARC are three separate standards that only do their real job
**together**. SPF and DKIM are the two ways a receiver can check that a message
is genuine; DMARC is the layer that ties them to your domain, tells receivers
what to do about fakes, and reports back to you. Here's how they fit.

## The 30-second version

- **[SPF](/glossary/spf)** says *which servers are allowed to send* for your
  domain.
- **[DKIM](/glossary/dkim)** adds a *tamper-proof signature* proving a message
  really came from your domain and wasn't altered.
- **[DMARC](/glossary/dmarc)** ties SPF and DKIM to the `From:` address people
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
examples](/guides/spf-record-syntax) for the full breakdown.)

## DKIM — a signature that proves authenticity

DKIM (DomainKeys Identified Mail) attaches a cryptographic **signature** to every
message, generated with a private key only you hold. The matching public key
lives in your DNS. The receiver verifies the signature, which proves two things:
the message really came from your domain, and it wasn't modified in transit.

Unlike SPF, DKIM survives most **forwarding** — which is why aligned DKIM is the
sturdiest way to pass DMARC.

## DMARC — the layer that makes them count

[DMARC](/glossary/dmarc) (Domain-based Message Authentication, Reporting &
Conformance) adds the three things SPF and DKIM lack on their own:

1. **Alignment** — it requires that the domain SPF or DKIM authenticated
   actually *matches* your `From:` domain. This is what stops a spoofer from
   passing SPF for *their* domain and riding your `From:`. See
   [DMARC alignment](/glossary/dmarc-alignment).
2. **Policy** — your [`p=` policy](/glossary/dmarc-policy) tells receivers what
   to do with mail that fails: `none` (monitor), `quarantine` (spam folder), or
   `reject` (block).
3. **Reporting** — receivers send you [aggregate
   reports](/glossary/dmarc-aggregate-report) showing every source sending as
   your domain.

A message **passes DMARC** when *either* SPF *or* DKIM both authenticates **and**
aligns. Just one aligned mechanism is enough.

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

## What next

Set them up in order: confirm SPF and DKIM exist, then
[publish your first DMARC record](/guides/publish-your-first-dmarc-record) in
monitoring mode. If mail is already failing, see
[why your email is failing DMARC](/guides/fix-dmarc-failure). When your reports
are clean, walk the [path to enforcement](/guides/from-monitoring-to-enforcement).
