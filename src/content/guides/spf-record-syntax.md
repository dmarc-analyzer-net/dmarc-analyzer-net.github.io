---
title: SPF record syntax and examples
description: A field reference for SPF record syntax — every mechanism and qualifier, the 10-lookup limit, and copy-paste examples for common email providers.
publishDate: 2026-07-23
---

An [SPF](/glossary/spf/) record is a single line of DNS that lists who may send
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

## What SPF actually checks

SPF does **not** look at the `From:` address your recipient sees. It checks the
**envelope sender** — the `MAIL FROM` address, also called the Return-Path — and
the IP that connected.

This is the source of most SPF confusion. A message can pass SPF perfectly while
the visible `From:` shows a completely different domain, which is precisely the
gap [DMARC](/glossary/dmarc/) closes by additionally requiring
[alignment](/glossary/dmarc-alignment/) between the two. Chasing an SPF pass
without checking alignment is the most common wasted afternoon in a DMARC
rollout.

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

Under DMARC the practical gap between `-all` and `~all` is smaller than it
looks: both produce an SPF result that fails alignment, and your DMARC policy
decides what happens next. Get to `-all` anyway — but don't delay a DMARC
rollout over it.

## Modifiers

Two modifiers are easy to miss because they use `=` rather than `:`:

| Modifier | Meaning |
|---|---|
| `redirect=` | Replace this record with another domain's entirely. Ignored if an `all` mechanism is present |
| `exp=` | Names a TXT record with a human-readable explanation for failures |

`redirect=` is genuinely useful for keeping one SPF record shared across many
domains — an agency pattern — but it costs a lookup and hides the real record
one level down.

## The rules that trip people up

- **One record only.** A domain must have exactly one SPF `TXT` record. Two
  produces a `permerror` — and a [DMARC failure](/guides/fix-dmarc-failure/).
- **Ten DNS-lookup limit.** Every `include`, `a`, `mx`, `ptr`, and `redirect`
  costs a lookup; the total must stay **≤ 10**. Chained providers blow past this
  fast.
- **Two void lookups.** Separately from the limit above, no more than two
  lookups may return an empty answer. A stale `include:` for a service you
  cancelled can `permerror` a record that's otherwise fine.
- **255-character strings.** A single TXT string can't exceed 255 chars; longer
  records must be split into multiple quoted strings.
- **`ip4:` and `ip6:` are free.** They cost no lookups, which is what makes
  flattening work.

## Counting your lookups

The count is recursive, and that's what catches people. `include:_spf.google.com`
is one lookup, but the record it fetches contains its own `include:`s, and each
of those counts too. A record that looks like three includes can easily be nine
lookups.

```
v=spf1 include:_spf.google.com include:sendgrid.net include:servers.mcsv.net -all
```

Three includes, but the true cost is whatever those three records expand to —
you have to resolve them to know. When a record `permerror`s and you can't see
why, over-limit expansion is the usual answer.

### When you exceed 10

In rough order of preference:

1. **Remove senders you no longer use.** Most over-limit records are archaeology.
2. **Replace an `include:` with the `ip4:` ranges** it resolves to, if the
   provider publishes stable IPs. This is "flattening" — it costs no lookups, but
   you now own the maintenance when the provider renumbers.
3. **Move a sender to a subdomain.** `news.yourdomain.com` gets its own SPF
   record and its own budget of 10.
4. **Drop `mx` and `a`** if they aren't actually senders. They're frequently
   present out of habit.

Flattening is the popular answer and the one that silently breaks a year later.
Prefer pruning and subdomains first.

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

**A subdomain that never sends:**
```
v=spf1 -all
```

## Checking your record

```
dig +short TXT yourdomain.com
```

You want exactly one string beginning `v=spf1`. Two is a `permerror` regardless
of how correct each one looks individually — and DNS providers make this easy to
do by accident, because adding a second TXT record is a perfectly ordinary
operation.

## Common mistakes

- `+all` or a trailing bare `all` — authorizes any server on earth.
- More than one `v=spf1` record on the domain.
- More than 10 DNS lookups (a hidden `permerror`).
- A stale `include:` that no longer resolves, burning void lookups.
- Assuming SPF covers the `From:` header — it doesn't; see above.
- Forgetting a real sender — every marketing, CRM, and ticketing platform needs
  representing, or its mail fails.

Across a portfolio of domains, the lookup count is the thing that quietly drifts
out of range as clients add tools — and you are not the one adding them. Watching
every domain's SPF result in the aggregate reports is how you catch it before
someone's invoices stop arriving — that's the job [DMARC Analyzer](/) does,
self-hosted, with no per-domain fee, and it is one part of
[running DMARC for many client domains](/guides/dmarc-multiple-client-domains/).

## What next

After publishing, confirm alignment in your [aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/) — SPF passing isn't enough
on its own; it must **align** with your `From:` domain to satisfy DMARC. If it
isn't, see [why your email is failing DMARC](/guides/fix-dmarc-failure/), and
remember SPF is only one leg of [SPF, DKIM &
DMARC](/guides/spf-dkim-dmarc/).
