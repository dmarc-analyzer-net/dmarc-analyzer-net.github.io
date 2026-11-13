---
title: "SPF, DKIM & DMARC: how the three work together"
seoTitle: 'SPF, DKIM & DMARC explained'
description: SPF, DKIM, and DMARC explained together — what each one actually does, how they combine to stop email spoofing, and why you need all three.
publishDate: 2026-07-23
updatedDate: 2026-11-12
---

SPF, DKIM, and DMARC work together to authenticate email and protect the domain
in your visible `From:` address. SPF authorizes sending servers; DKIM checks
a domain's signature; DMARC ties a passing check to that `From:` domain and lets
you request handling of failures and reports.

## The 30-second version

- **[SPF](/glossary/spf/)** (Sender Policy Framework, [RFC 7208](/rfc/7208/))
  authorizes servers to use a domain in the envelope sender.
- **[DKIM](/glossary/dkim/)** (DomainKeys Identified Mail, [RFC 6376](/rfc/6376/))
  lets a signing domain take responsibility for a message and detects changes
  to signed content.
- **[DMARC](/glossary/dmarc/)** (Domain-based Message Authentication, Reporting &
  Conformance, [RFC 9989](/rfc/9989/)) checks that a passing SPF or DKIM result
  aligns with the visible `From:` domain, and adds policy and reporting.

Set up all three for sending domains. DMARC itself needs only one mechanism to
pass and align; bulk-sender requirements can require both SPF and DKIM.

## SPF — who is allowed to send

SPF (Sender Policy Framework) is a DNS record listing the servers and services
authorized to send email for your domain. When a message arrives, the receiver
looks up your SPF record and checks whether the sending server is on the list.

```
v=spf1 include:_spf.google.com include:sendgrid.net -all
```

Its weakness on its own: SPF checks the hidden *envelope* sender, not the
`From:` address recipients see — so an attacker can pass SPF for their own
domain while forging yours in `From:`. That's the gap DMARC closes. (See [SPF record syntax and
examples](/guides/spf-record-syntax/) for the full breakdown.)

## DKIM — a signature tied to a domain

Your sending service adds a cryptographic **DKIM signature** to outgoing
messages using a private key it holds for the signing domain. The matching
public key lives in that domain's DNS, at a name made of a
[**selector**](/guides/find-your-dkim-selector/) naming the key and the fixed
label `_domainkey`:

```
selector1._domainkey.yourdomain.com
```

The signature names the selector in `s=` and the signing domain in `d=`, so a
receiver knows exactly which key to fetch. Verifying it proves two things: some
domain holding the private key **took responsibility** for the message, and the
signed content still matches after DKIM's permitted normalization, such as
whitespace changes. That does not prove where the message originated. A mailing
list or an outbound relay can sign validly with its own `d=`, which is precisely why DMARC also checks
[alignment](/glossary/dmarc-alignment/).

Because the selector is part of the name, you can publish several keys at once and
rotate without downtime. DKIM can survive **forwarding** when signed content
stays intact; a forwarder that changes the subject or adds a footer can break it.

## DMARC — the layer that makes them count

[DMARC](/glossary/dmarc/) (Domain-based Message Authentication, Reporting &
Conformance) adds the three things SPF and DKIM lack on their own:

1. **Alignment** — it requires that the domain SPF or DKIM authenticated
   actually *matches* your `From:` domain. This is what stops a spoofer from
   passing SPF for *their* domain and riding your `From:`. See
   [DMARC alignment](/glossary/dmarc-alignment/).
2. **Policy** — your [`p=` policy](/glossary/dmarc-policy/) requests handling of
   mail that fails: `none` (no DMARC-specific action), `quarantine` (treat as
   suspicious), or `reject` (refuse). Receivers make the final delivery decision.
3. **Reporting** — a `rua=` destination requests [aggregate
   reports](/glossary/dmarc-aggregate-report/) from participating receivers,
   showing the sources and authentication results they observed.

A message **passes DMARC** when *either* SPF *or* DKIM both authenticates **and**
aligns. Just one aligned mechanism is enough.

## Alignment, concretely

"Aligned" means the domain that authenticated matches the domain in the `From:`
header. DMARC offers two strictnesses, and **relaxed is the default**:

| Mode | `From:` | Authenticated domain | Aligned? |
|---|---|---|---|
| Relaxed | `yourdomain.com` | `mail.yourdomain.com` | Yes — same organizational domain |
| Strict | `yourdomain.com` | `mail.yourdomain.com` | No — must match exactly |
| Either | `yourdomain.com` | `other.example` | **No** |

Set strictness with `adkim=` (DKIM) and `aspf=` (SPF), each `r` for relaxed or
`s` for strict. Leave them alone unless you have a specific reason — relaxed is
almost always what you want.

That third row is the one that matters in practice. A marketing platform sending
on your behalf will happily pass SPF for *its own* domain, and that pass does
nothing for you. Fixing it means getting the platform to sign with DKIM as your
domain, or to use a custom Return-Path on your subdomain.

## What you lose if you skip one

| You have | The gap |
|---|---|
| SPF only | Forwarding can break SPF; nothing binds its result to the visible `From:` |
| DKIM only | No SPF authorization check or fallback if the signature breaks; no DMARC binding to `From:` |
| SPF + DKIM, no DMARC | Both can pass for a domain that isn't yours — and you get no reports, so you can't see it happening |
| DMARC at `p=none` forever | Reports if requested, but no request to quarantine or reject DMARC failures |

A monitoring policy is also the reason
["DMARC policy not enabled"](/guides/dmarc-policy-not-enabled/) warnings exist.

## The reason this stopped being optional

Bulk-sender rules make this operational, even at `p=none`. As checked on
November 12, 2026:

**Gmail:** [Google's requirements](https://support.google.com/mail/answer/81126)
call for SPF, DKIM and DMARC (at least `p=none`), plus alignment for direct mail.
Marketing and subscribed messages need [one-click unsubscribe](/rfc/8058/) and
a visible body link. Keep Postmaster Tools spam rates below 0.3%; valid forward/reverse DNS,
TLS and correctly formatted messages are also required.

Google's [bulk-sender FAQ](https://support.google.com/mail/answer/14229414)
counts roughly 5,000 messages or more to **personal Gmail accounts in 24 hours**,
combining the primary domain and its subdomains. Once classified as a bulk
sender, you keep that status.

**Yahoo:** [bulk senders](https://senders.yahooinc.com/best-practices/)
need SPF, DKIM, DMARC (at least `p=none`) and DMARC pass, alongside its
unsubscribe and complaint-rate requirements. Its
[FAQ](https://senders.yahooinc.com/faqs/) does not publish a numeric bulk threshold.

**Outlook.com:** [Microsoft's requirements](https://techcommunity.microsoft.com/blog/microsoftthreatprotectionblog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730)
apply to domains sending over 5,000 messages daily to its consumer service.
SPF and DKIM must pass, with DMARC at least `p=none` and one mechanism aligned.
Microsoft announced rejection of noncompliant traffic from May 5, 2025.

## How a single message flows through all three

1. Your server sends a message with a DKIM signature.
2. The receiver checks **SPF** (is the sending IP authorized?) and **DKIM** (is
   the signature valid?).
3. **DMARC** asks: did SPF or DKIM pass *and* align with the `From:` domain?
4. A pass clears DMARC, but spam and other checks still decide delivery. On a
   failure, the receiver considers your applicable DMARC policy alongside its
   own rules. Participating receivers include results in requested reports.

## Side by side

| | SPF | DKIM | DMARC |
|---|---|---|---|
| Checks | Sending server/IP | Message signature | Alignment + policy |
| Lives in | DNS `TXT` | DNS `TXT` + message header | DNS `TXT` |
| Survives forwarding | Can break | If signed content survives | Passes if one mechanism still passes and aligns |
| Gives you reports | No | No | **Yes** |

## The reports are the part people underestimate

Across many client domains, the ongoing work is reading reports and identifying
senders. Publish `rua=` to request XML reports, usually covering a day, from
receivers that support reporting. They summarize the mail those receivers saw;
they are not a complete census of every message sent as your domain.

That's what turns DMARC from a checkbox into an operation — and it's what
[DMARC Analyzer](/) exists to do: ingest reports, resolve the sending
sources, and show each domain's [path to enforcement](/docs/domain-detail/).
Self-hosted, so client report data stays on your infrastructure, and unlimited domains at no
per-domain cost.

## What next

Set them up in order: confirm SPF and DKIM exist, then
[publish your first DMARC record](/guides/publish-your-first-dmarc-record/) in
monitoring mode. If mail is already failing, see
[why your email is failing DMARC](/guides/fix-dmarc-failure/). When your reports
are clean, walk the [path to enforcement](/guides/from-monitoring-to-enforcement/).

For the DNS detail behind any of it: [SPF record syntax](/guides/spf-record-syntax/)
term by term, and [DMARC record tags](/guides/dmarc-record-tags/) tag by tag.
