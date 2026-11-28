---
title: Why your email is failing DMARC (and how to fix it)
seoTitle: 'Why email fails DMARC & how to fix it'
description: Email failing DMARC? Diagnose authentication and alignment failures, repair SPF and DKIM, and separate forwarding problems from unauthorized senders.
publishDate: 2026-07-23
updatedDate: 2026-11-28
---

Email fails **DMARC** (Domain-based Message Authentication, Reporting, and
Conformance, [RFC 9989](/rfc/9989/)) when neither SPF nor DKIM produces a pass
aligned with the visible `From:` domain. Start with the failing message or
report row: identify the authenticated domains, check alignment, then repair the
legitimate sender. A failed check alone does not tell you whether mail was
rejected or delivered.

## The one rule behind every DMARC failure

A message passes DMARC when either:

- **SPF passes** for the envelope-sender domain and that domain aligns with the
  `From:` domain, or
- **At least one DKIM signature verifies** and its `d=` domain aligns with the
  `From:` domain.

By default, [alignment](/glossary/dmarc-alignment/) is relaxed: the domains must
share an organizational domain. For example, `bounce.yourdomain.com` can align
with `yourdomain.com`. Strict alignment (`aspf=s` or `adkim=s`) requires an exact
domain match for that mechanism. An aligned name with a failed authentication
check is not enough; neither is a passing check for an unrelated domain.

A missing policy or a policy-lookup error is a different diagnosis from a
message evaluated as `dmarc=fail`. Check the result reported by the receiver
before changing authentication records. Receivers also apply local filtering:
DMARC pass does not guarantee delivery, and DMARC fail does not guarantee
rejection.

## "SPF pass but DMARC fail" — the alignment trap

**SPF** (Sender Policy Framework, [RFC 7208](/rfc/7208/)) checks whether the
connecting server may use the SMTP `MAIL FROM` domain. This envelope sender is
normally recorded in `Return-Path` on delivery; it is separate from the visible
`From:` address. With an empty envelope sender, SPF derives the identity from
HELO/EHLO. An unrelated HELO pass does not rescue a failed non-empty envelope
identity for DMARC.

A sending platform can pass SPF for its own envelope domain while using
`you@yourdomain.com` in `From:`. That pass is unaligned. Adding the platform's
SPF include to `yourdomain.com` does not change the envelope identity it uses.

**Fix:** configure the platform's custom bounce/Return-Path domain and publish
its exact DNS instructions, or configure aligned DKIM. With relaxed alignment,
`bounce.yourdomain.com` can provide SPF alignment for `you@yourdomain.com`;
with strict SPF alignment, those two domains do not match. One aligned,
passing DKIM signature is sufficient even if SPF remains unaligned.

## Cause 1 — a sending service you never configured

A CRM, help desk or newsletter service sending with your `From:` domain needs
aligned authentication. First confirm that the source belongs to a service you
actually use. A passing SPF or DKIM result for an unrelated domain can also
appear on forged mail; it is not permission to authorize the source.

**Fix:** enable custom-domain DKIM and/or an aligned envelope domain using the
provider's instructions. Publish the requested TXT or CNAME records at the names
it specifies. Add an SPF include only at the domain actually checked by SPF and
only when the provider requires it. Keep existing authorized senders in the
single SPF record there. Send a test message and confirm an aligned pass at the
receiver.

## Cause 2 — SPF is broken

Check the record for the envelope domain the failing message used:

- **Too many DNS-querying terms.** The limit is ten evaluated `include`, `a`,
  `mx`, `ptr`, `exists` and `redirect` terms, including recursive evaluation.
  An early match can pass while a later sender reaches an eleventh term and gets
  `permerror`, so failures can be intermittent. This is not a count of DNS
  packets. Other DNS limits also apply; [SPF record
  syntax](/guides/spf-record-syntax/) explains them, and the [SPF record
  checker](/tools/spf-checker/) helps inspect the expansion.
- **Multiple SPF records or invalid syntax.** Multiple selected `v=spf1` TXT
  records produce `permerror`. Multiple quoted strings within one TXT record
  are different: DNS concatenates them into one value.
- **No matching authorization.** The sending IP is missing, an include points
  at the wrong name, or an earlier mechanism determines the result before the
  intended rule is reached. `softfail`, `neutral` and `none` are not SPF pass.
- **DNS errors.** A temporary lookup failure can produce `temperror`; retry and
  investigate DNS availability rather than adding more includes.

**Fix:** correct syntax, keep one SPF record per checked domain, and remove
unused includes before adding authorization. A sender can use a separate
envelope subdomain with its own evaluation budget, but moving an include alone
does not move the sender. Check alignment before changing its envelope domain.

Replacing includes with `ip4:`/`ip6:` ranges (flattening) makes you responsible
for tracking every provider range change. Missing or stale ranges can fail
legitimate mail or authorize addresses the provider no longer uses. Prefer
provider-managed records where feasible.

For a server whose only sending address is `192.0.2.10`, the record shape is:

```text
v=spf1 ip4:192.0.2.10 -all
```

That is a documentation address. Replace it with your authorized sending IPs;
do not copy it over a provider's working record. `-all` does not make an
unaligned pass align.

## Cause 3 — DKIM isn't signing (or is signing wrong)

**DKIM** (DomainKeys Identified Mail, [RFC 6376](/rfc/6376/)) verifies a signature
using the public key at `<selector>._domainkey.<signing-domain>`. Read `s=` and
`d=` from the actual message's `DKIM-Signature`, rather than guessing the
selector or looking under the `From:` domain automatically.

**Fix:** enable signing for your domain, publish the exact provider key or CNAME,
and verify the lookup with the [DKIM record checker](/tools/dkim-checker/).
A published key alone does not prove the provider signs outgoing mail. Send a
test and confirm both signature verification and `d=` alignment.

If verification fails, check for a wrong selector, missing/revoked key, DNS error,
or modification of signed headers or body content in transit. If verification
passes but DMARC fails, check `d=` alignment and `adkim`. A message may have
several signatures: one that verifies and aligns is enough, even if another
fails or uses the platform's domain.

## Cause 4 — forwarding or mailing-list changes

Plain forwarding often retains the original envelope sender but connects from
the forwarder's IP. If that IP is not authorized by the envelope domain's SPF
record, SPF does not pass. Forwarding does not invariably break SPF; the result
depends on the actual envelope and authorization.

SRS rewrites the envelope sender. It can let the forwarder pass SPF for its own
domain, but that does not provide alignment with your original `From:` domain.
Do not add arbitrary forwarders to your SPF record to compensate.

Aligned DKIM can survive forwarding that preserves signed content. Mailing-list
footers, subject changes and other alterations can invalidate it. Test the
actual path. **ARC** (Authenticated Received Chain,
[RFC 8617](/rfc/8617/)) can carry earlier authentication assessments through an
intermediary. A receiver that trusts that evidence may override a DMARC policy;
ARC does not turn the underlying DMARC failure into a pass or guarantee delivery.

**Fix:** sign legitimate outbound mail with aligned DKIM, identify paths that
modify it, and test forwarding and list delivery before tightening policy. A
path that still fails needs an explicit decision about delivery risk, rather
than an assumption that all forwarded mail is safe or that every failure is
repairable at your DNS.

## Cause 5 — a subdomain with unexpected authentication or policy

A missing subdomain DMARC record does not itself cause authentication failure.
Mail from `news.yourdomain.com` can pass using aligned SPF or DKIM under an
inherited policy. SPF records, however, do not automatically inherit from the
parent: check the actual envelope domain.

**Fix:** verify the `From:` subdomain, envelope domain and DKIM signing domain.
Check `_dmarc.news.yourdomain.com` first. If no DMARC policy record exists there,
policy discovery looks for the organizational-domain policy or, where
applicable, a public-suffix policy. This is not arbitrary nearest-parent
inheritance.

A retrieved record with an invalid `p` value does not trigger a parent-policy
search. If its `rua` contains at least one syntactically valid reporting URI,
the receiver treats the policy as `p=none` and continues processing. Otherwise,
it applies no DMARC processing to the message. Correct the invalid policy
rather than assuming the parent policy protects the subdomain.

For a policy inherited from `yourdomain.com`, existing subdomains use `sp`,
falling back to `p`. Non-existent subdomains use `np`, then `sp`, then `p`.
Non-existent means DNS returns NXDOMAIN for the domain itself, not merely that
its `_dmarc` record is missing. Publish a separate DMARC record only when you
need a distinct policy or reporting setup; it is not an authentication repair.

## How to diagnose which one it is

For an individual message, read the receiving system's authentication results
and delivery/rejection details. For patterns, use **aggregate reports**
([RFC 9990](/rfc/9990/)): participating receivers summarize the mail they
observed over each reported interval. Reports are optional and incomplete;
absence of a source is not proof it never sent mail.

In a failing report row, compare `header_from` with the domains in
`auth_results`. Those are raw authentication results. The `spf` and `dkim`
fields in `policy_evaluated` are the DMARC alignment results. If either is
`pass`, that row passes DMARC. `disposition` describes DMARC handling, not a
receipt confirming final inbox delivery.

| Evidence in a failing row | Next check |
|---|---|
| Raw SPF or DKIM pass, both DMARC results fail | Domain alignment and strict/relaxed settings |
| SPF `permerror` or `temperror` | Record syntax/limits or DNS availability |
| DKIM failure or no signature | Signing enabled, selector/key and message changes |
| Direct tests pass, forwarded/list mail fails | Envelope changes and signed-content modification |
| Unexpected `header_from` subdomain | Sender identity, authentication and inherited policy |

One IP can carry both legitimate and abusive traffic. Identify the service and
message path before authorizing it, and compare rows across reporters and dates.
[How to read a DMARC aggregate report](/guides/how-to-read-a-dmarc-aggregate-report/)
walks through the XML.

Across many client domains, [DMARC Analyzer](/) keeps those comparisons in one
self-hosted console. The [domain detail view](/docs/domain-detail/) separates
raw authentication from DMARC evaluation so you can investigate a source
without treating an unaligned pass as a success.

## Quick checklist

- [ ] At least one SPF or DKIM result **passes and aligns** at the receiver?
- [ ] SPF checked at the actual envelope domain, with one valid record and its
      evaluation within DNS limits?
- [ ] DKIM signing enabled, correct key published, and a verifying `d=` aligned?
- [ ] Legitimate services identified independently of raw authentication passes?
- [ ] Forwarding, mailing lists and subdomain policies tested?

## What next

Move toward enforcement when you have inventoried legitimate senders, corrected
aligned authentication and assessed the remaining indirect-mail risk. Include
infrequent senders such as monthly billing; a quiet reporting window alone does
not prove readiness. Follow [from monitoring to
enforcement](/guides/from-monitoring-to-enforcement/), preserving any existing
protection while you investigate individual sources.
