---
title: SPF record syntax and examples
description: A field reference for SPF record syntax — every mechanism and qualifier, the 10-lookup limit, and copy-paste examples for common email providers.
publishDate: 2026-07-23
---

An [SPF](/glossary/spf/) record is a single line of DNS that lists who may send
email for your domain. The syntax — specified by [RFC 7208](/rfc/7208/) — is
small but unforgiving: one wrong qualifier or one record too many and it
silently fails. This is the field reference.

## Anatomy of a record

An SPF record is a `TXT` record on your domain that always starts with `v=spf1`
and usually ends with an `all` mechanism:

```
v=spf1 include:_spf.google.com ip4:198.51.100.10 -all
```

Read left to right, the receiver evaluates each **mechanism** until one matches
the sending server, then applies that mechanism's **qualifier**.

## What SPF actually checks

SPF does **not** look at the `From:` address your recipient sees — the one
[RFC 5322](/rfc/5322/) defines. It checks the **envelope sender**, the
`MAIL FROM` address, also called the Return-Path, and the IP that connected.

This is the source of most SPF confusion. A message can pass SPF perfectly while
the visible `From:` shows a completely different domain, which is precisely the
gap [DMARC](/glossary/dmarc/) closes by additionally requiring
[alignment](/glossary/dmarc-alignment/) between the two. Chasing an SPF pass
without checking alignment is the most common wasted afternoon in a DMARC
rollout.

## Mechanisms

Eight mechanisms exist. In practice you will write four of them.

| Mechanism | Matches | DNS lookups | Example |
|---|---|---|---|
| [`all`](#the-all-mechanism) | Everything — always last | 0 | `-all` |
| [`ip4`](#the-ip4-mechanism) | An IPv4 address or range | 0 | `ip4:198.51.100.0/24` |
| [`ip6`](#the-ip6-mechanism) | An IPv6 address or range | 0 | `ip6:2001:db8::/32` |
| [`a`](#the-a-mechanism) | The domain's own A/AAAA records | 1 | `a` or `a:mail.yourdomain.com` |
| [`mx`](#the-mx-mechanism) | The domain's MX hosts | 1 | `mx` |
| [`include`](#the-include-mechanism) | Another domain's SPF (e.g. a provider) | 1 | `include:_spf.google.com` |
| [`exists`](#the-exists-mechanism) | Whether a name resolves, after macro expansion | 1 | `exists:%{ir}.spf.yourdomain.com` |
| [`ptr`](#the-ptr-mechanism) | Reverse DNS of the connecting IP | 1 | `ptr` — **deprecated, don't** |

The lookup column is the one to watch: only `ip4` and `ip6` are free, and the
total across a record must stay at or below ten. That budget is what
[counting your lookups](#counting-your-lookups) is about.

### The `all` mechanism

`all` always matches, so it must be the last term in the record — anything after
it is never evaluated. Its qualifier is what decides the outcome for every sender
you did not list:

```
v=spf1 include:_spf.google.com -all
```

A record without `all` produces a `neutral` result for unlisted senders, which is
the same as having no opinion. Always end with one.

### The `ip4` mechanism

Authorizes a single IPv4 address or a CIDR range. A bare address is treated as
`/32`:

```
v=spf1 ip4:198.51.100.10 ip4:203.0.113.0/24 -all
```

Costs no DNS lookup, which is why replacing an `include:` with the ranges behind
it ("flattening") relieves the ten-lookup limit — and why it becomes your problem
when the provider renumbers.

### The `ip6` mechanism

The same, for IPv6. A bare address is treated as `/128`:

```
v=spf1 ip6:2001:db8::1 ip6:2001:db8:1000::/36 -all
```

If your sending hosts have AAAA records, list them. An `ip4:` term can never
match a host that connected over IPv6 — so a record that lists only IPv4 ranges
fails for that connection, even though the same host would pass over IPv4.
`a`, `mx` and `include` are unaffected: they resolve whichever address family
the connection used.

### The `a` mechanism

Matches if the connecting IP appears in the A (or AAAA) records of the domain.
Bare `a` means "this domain"; `a:host.yourdomain.com` names another:

```
v=spf1 a a:mail.yourdomain.com -all
```

A CIDR suffix widens the match to a network around each resolved address —
`a:mail.yourdomain.com/24`. Costs one lookup either way. Most records carry `a`
out of habit; if your web server does not send mail, drop it.

### The `mx` mechanism

Matches if the connecting IP is one of the domain's MX hosts. Convenient when
your inbound and outbound mail share hosts, and pointless when they don't:

```
v=spf1 mx -all
```

`mx` costs one lookup, but it carries a **second, separate limit**: resolving it
must not require more than ten address lookups. A domain with a dozen MX hosts
therefore `permerror`s on a single `mx` term, with a term count of one. This is
the most confusing way an SPF record can fail.

### The `include` mechanism

The workhorse. It evaluates another domain's SPF record and matches if *that*
record returns a `pass`:

```
v=spf1 include:_spf.google.com include:sendgrid.net -all
```

Two details cause most `include` confusion:

- **Only `pass` matches.** If the included record returns fail, softfail or
  neutral, the `include` simply does not match and evaluation continues to the
  next term. It does not fail the whole record.
- **A missing record is fatal.** If the included domain has no SPF record at all,
  the result is `permerror` — the entire record fails, not just that term. This
  is how cancelling a service silently breaks a domain months later.

Each `include` costs one lookup, plus every lookup inside the record it fetches.

### The `exists` mechanism

Matches if a hostname resolves to any A record after
[macro](https://www.rfc-editor.org/rfc/rfc7208#section-7) expansion — `%{i}` is
the connecting IP, `%{ir}` its reversed form, `%{d}` the domain:

```
v=spf1 exists:%{ir}.spf.yourdomain.com -all
```

You are unlikely to write this, and likely to meet it: it is how allow-list and
reputation services plug into SPF, and how per-sender rules get expressed. If you
inherit one, it is deliberate. It costs one lookup.

### The `ptr` mechanism

Matches on the reverse DNS of the connecting IP.
[RFC 7208](https://www.rfc-editor.org/rfc/rfc7208#section-5.5) deprecates it in
as many words: it is slow, it loads the receiver, and the result depends on
reverse DNS you do not control. Some receivers skip it entirely.

Do not add it. If you find it in a record you inherited, removing it is usually
safe and always frees a lookup.

## Qualifiers

A prefix on a mechanism sets the result when that mechanism matches. `+` is the
default, so a mechanism with no prefix means pass:

| Qualifier | Result | On `all` |
|---|---|---|
| `+` | Pass (default if omitted) | `+all` — **never do this**, authorizes the world |
| `-` | Fail (hard) | `-all` — reject everything else (recommended) |
| `~` | SoftFail | `~all` — mark suspicious but accept (use while testing) |
| `?` | Neutral | `?all` — no opinion |

### `-all` vs `~all`

This is the decision people agonise over, and under DMARC it matters less than it
looks. Both produce an SPF result that fails alignment, and your DMARC policy —
not the SPF qualifier — decides what happens to the message:

```
v=spf1 include:_spf.google.com ~all    # while you are still finding senders
v=spf1 include:_spf.google.com -all    # once the list is complete
```

Use `~all` while you are still discovering senders in your aggregate reports, and
move to `-all` once nothing legitimate is missing. Get there — but don't hold up a
DMARC rollout over it.

`+all` deserves its own warning: it authorizes every server on the internet to
send as your domain. It appears in records where someone was debugging and never
reverted.

## Modifiers

Two modifiers are easy to miss because they use `=` rather than `:`, and because
order does not matter for them — a modifier applies to the whole record wherever
it sits.

| Modifier | Meaning |
|---|---|
| `redirect=` | Replace this record with another domain's entirely |
| `exp=` | Names a TXT record explaining failures |

### The `redirect=` modifier

Hands evaluation entirely to another domain's SPF record, and returns whatever
that record returns:

```
v=spf1 redirect=_spf.yourdomain.com
```

Genuinely useful for keeping one shared record across many domains — an agency
pattern, where a single authoritative record covers a client portfolio. Two
catches: it costs a lookup, and it is **ignored if an `all` mechanism is present**,
because `all` always matches first. A record ending `-all redirect=…` silently
does nothing with the redirect.

### The `exp=` modifier

Names a TXT record whose contents are returned to the sender when the record
produces a `fail`:

```
v=spf1 include:_spf.google.com exp=why.yourdomain.com -all
```

The explanation string is macro-expanded, and only used for `fail` — never for
softfail or neutral. It is a diagnostic nicety, not a control, and most operators
never set one.

## The rules that trip people up

- **One record only.** A domain must have exactly one SPF `TXT` record. Two
  produces a `permerror` — and a [DMARC failure](/guides/fix-dmarc-failure/).
- **Ten DNS-lookup limit.** Six terms cost a lookup — `include`, `a`, `mx`,
  `ptr`, `exists` and `redirect` — and the total must stay **≤ 10**. Ten is
  allowed; eleven `permerror`s. Chained providers blow past this fast.
- **[`mx`](#the-mx-mechanism) and [`ptr`](#the-ptr-mechanism) have their own
  sub-limits**, which is how a record with a term count of 1 still fails: each is
  capped at **10 address lookups** of its own. Over the cap, `mx` is fatal while
  `ptr` merely ignores the extras — the difference being that you control your MX
  records and not the reverse DNS of whoever is connecting.
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
