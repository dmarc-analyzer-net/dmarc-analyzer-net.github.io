---
title: SPF record syntax and examples
description: A field reference for SPF record syntax — every mechanism and qualifier, the 10-lookup limit, and copy-paste examples for common email providers.
publishDate: 2026-07-23
---

An [SPF](/glossary/spf) record is a single line of DNS that lists who may send
email for your domain. The syntax is small but unforgiving — one wrong qualifier
or one record too many and it silently fails. This is the field reference.

## Anatomy of a record

An SPF record is a `TXT` record on your domain that always starts with `v=spf1`
and usually ends with an `all` mechanism:

```
v=spf1 include:_spf.google.com ip4:198.51.100.10 -all
```

Read left to right, the receiver evaluates each **mechanism** until one matches
the sending server, then applies that mechanism's **qualifier**.

## Mechanisms

| Mechanism | Matches | Example |
|---|---|---|
| `ip4` | An IPv4 address or range | `ip4:198.51.100.0/24` |
| `ip6` | An IPv6 address or range | `ip6:2001:db8::/32` |
| `a` | The domain's own A record | `a` or `a:mail.example.com` |
| `mx` | The domain's MX hosts | `mx` |
| `include` | Another domain's SPF (e.g. a provider) | `include:_spf.google.com` |
| `all` | Everything — always last | `-all` |

Avoid `ptr` — it's slow, unreliable, and deprecated.

## Qualifiers

A prefix on a mechanism sets the result when it matches:

| Qualifier | Meaning | On `all` |
|---|---|---|
| `+` | Pass (default if omitted) | `+all` — **never do this**, authorizes the world |
| `-` | Fail (hard) | `-all` — reject everything else (recommended) |
| `~` | SoftFail | `~all` — mark suspicious but accept (use while testing) |
| `?` | Neutral | `?all` — no opinion |

Most domains want `-all` once they're confident every real sender is listed;
`~all` is a safe stepping stone.

## The rules that trip people up

- **One record only.** A domain must have exactly one SPF `TXT` record. Two
  produces a `permerror` — and a [DMARC failure](/guides/fix-dmarc-failure).
- **Ten DNS-lookup limit.** Every `include`, `a`, `mx`, and `ptr` costs a
  lookup; the total must stay **≤ 10**. Chained providers blow past this fast.
  Flatten or prune when you approach it.
- **255-character strings.** A single TXT string can't exceed 255 chars; longer
  records must be split into multiple quoted strings.

## Examples

**Google Workspace only:**
```
v=spf1 include:_spf.google.com -all
```

**Microsoft 365 only:**
```
v=spf1 include:spf.protection.outlook.com -all
```

**Google Workspace + SendGrid + a fixed IP:**
```
v=spf1 include:_spf.google.com include:sendgrid.net ip4:198.51.100.10 -all
```

**Still testing (soft fail):**
```
v=spf1 include:_spf.google.com ~all
```

## Common mistakes

- `+all` or a trailing bare `all` — authorizes any server on earth.
- More than one `v=spf1` record on the domain.
- More than 10 DNS lookups (a hidden `permerror`).
- Forgetting a real sender — every marketing, CRM, and ticketing platform needs
  representing, or its mail fails.

## What next

After publishing, confirm alignment in your [aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report) — SPF passing isn't enough
on its own; it must **align** with your `From:` domain to satisfy DMARC. If it
isn't, see [why your email is failing DMARC](/guides/fix-dmarc-failure), and
remember SPF is only one leg of [SPF, DKIM &
DMARC](/guides/spf-dkim-dmarc).
