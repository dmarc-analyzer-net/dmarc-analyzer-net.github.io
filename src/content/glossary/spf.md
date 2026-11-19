---
term: SPF
seoTitle: "SPF (Sender Policy Framework)"
description: SPF checks whether a sending server may use the envelope sender's domain. Learn its DNS record, results, lookup limit and role in DMARC.
aliases: ["Sender Policy Framework"]
related: ["dkim", "dmarc", "dmarc-alignment"]
---

**SPF** (Sender Policy Framework, [RFC 7208](/rfc/7208/)) lets a domain publish
a DNS `TXT` record authorising sending servers. The receiver checks the connecting
server's IP against the record for the SMTP envelope sender's domain, rather than
the visible `From:` address. SPF can also check the `HELO`/`EHLO` domain; that
identity is used when the envelope sender is empty, as on delivery-status messages.

## What an SPF record means

This illustrative record authorises one documentation IP and a fictional mail
provider's senders:

```
v=spf1 ip4:192.0.2.10 include:_spf.sender.example -all
```

- `ip4:` authorises an IPv4 address or range; `ip6:` does the same for IPv6.
- `include:` evaluates another domain's SPF record. A pass there makes this
  mechanism match; it does not import the other domain's final policy.
- `-all` returns **fail** for every remaining IP: the domain says it is not
  authorised. Rejection is the receiver's decision, not a command in the record.
- `~all` returns **softfail**, a weaker statement of non-authorisation. Receivers
  should not reject solely on that result, but it is still not a pass.

SPF also has **neutral** (no assertion), **none** (no applicable record),
**temperror** (a temporary evaluation problem) and **permerror** (a record or
evaluation problem requiring correction). A pass authorises use of the checked
domain; it does not prove the message is safe or guarantee delivery.

## Why SPF alone does not protect the visible From address

An attacker can pass SPF for a domain they control while putting your domain in
the visible `From:` address. [DMARC](/glossary/dmarc/) closes that gap by requiring
a passing SPF result for an [aligned domain](/glossary/dmarc-alignment/), or a
passing, aligned [DKIM](/glossary/dkim/) signature. An SPF error alone therefore
does not establish a DMARC failure: aligned DKIM can still satisfy DMARC.

Plain forwarding often breaks SPF because the receiver sees the forwarder's IP,
while the original envelope sender stays the same. Rewriting the envelope sender
can make SPF pass for the forwarder, but that domain may not align with the
original visible `From:` domain. A surviving aligned DKIM signature can still pass
DMARC on forwarded mail.

## The 10-lookup limit

SPF evaluation has a limit of **10 DNS-querying terms**, including those reached
through nested includes and redirects. It is not simply a count of TXT records or
DNS packets. Evaluation stops at the first matching mechanism, so different
sending IPs can reach different parts of the same record.

| Counts toward the term limit | Does not count toward the term limit |
|---|---|
| `include:`, `a`, `mx`, `ptr`, `exists:`, `redirect=` | `ip4:`, `ip6:`, `all`, `exp=` |

Exceeding the limit returns `permerror`, not `fail`. Neither is an SPF pass.
Receivers can reject mail on a permanent error, so do not assume it will fail
silently. Additional limits apply to MX/PTR processing and empty DNS answers;
ten top-level terms are not a guarantee that evaluation will succeed.

Remove unused senders and unnecessary `a` or `mx` terms before replacing provider
includes with fixed IP ranges. That replacement, called flattening, makes you
responsible for tracking the provider's IP changes. The
[SPF record checker](/tools/spf-checker/) helps inspect nested includes; the
[SPF syntax guide](/guides/spf-record-syntax/) covers the individual mechanisms.

## One record per DNS name

Publish at most **one** `v=spf1` TXT record at each name. Two applicable SPF
records produce `permerror`; combine authorised senders in one record instead.
Unrelated TXT records can coexist with it. A subdomain needs its own SPF record
if it sends mail: SPF does not inherit the parent domain's record.

Across many client domains, [DMARC Analyzer](/) groups incoming reports in one
self-hosted console. Its [domain detail view](/docs/domain-detail/) separates
raw SPF results from DMARC evaluation, helping you distinguish authentication
errors from alignment problems in the mail receivers report.
