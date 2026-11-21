---
title: SPF record syntax and examples
description: A field reference for SPF record syntax — every mechanism and qualifier, the 10-lookup limit, and copy-paste examples for common email providers.
publishDate: 2026-07-23
updatedDate: 2026-11-21
---

An [SPF](/glossary/spf/) record lists which servers may send mail using a domain
in the SMTP envelope or HELO identity. SPF record syntax — specified by
[RFC 7208](/rfc/7208/) — combines mechanisms that match senders, qualifiers that
set the result, and modifiers that control evaluation. Publish it as one DNS
TXT record at each name you use for those identities.

## Anatomy of a record

An SPF record is a `TXT` record on your domain that always starts with `v=spf1`
and usually ends with an `all` mechanism:

```
v=spf1 include:_spf.google.com ip4:198.51.100.10 -all
```

Read left to right, the receiver evaluates each **mechanism** until one matches
the sending server, then applies that mechanism's **qualifier**. An error can
stop evaluation before a match.

## What SPF actually checks

SPF does **not** look at the `From:` address your recipient sees — the one
[RFC 5322](/rfc/5322/) defines. It checks the **envelope sender**, the
`MAIL FROM` address, whose value appears in the delivered Return-Path header,
and the IP that connected. Receivers can also check the HELO/EHLO domain. With
an empty `MAIL FROM`, as on a delivery-status message, SPF uses the HELO domain.

This is the source of most SPF confusion. A message can pass SPF perfectly while
the visible `From:` shows a completely different domain, which is precisely the
gap [DMARC](/glossary/dmarc/) closes by requiring a passing result with
[alignment](/glossary/dmarc-alignment/) to the visible From domain. Either
aligned SPF or aligned DKIM can satisfy DMARC. For SPF, DMARC uses the
`MAIL FROM` result, with the HELO-derived identity only when `MAIL FROM` is
empty. A separate HELO pass cannot satisfy DMARC if a non-empty `MAIL FROM`
fails SPF. SPF does not inherit: a record at `yourdomain.com` does not cover
`news.yourdomain.com`.

## Mechanisms

Eight mechanisms exist. Their DNS work differs from the number of terms they
consume in the evaluation budget:

| Mechanism | Matches | Counts toward the ten-term limit | Example |
|---|---|---|---|
| `all` | [Everything — always last](#the-all-mechanism) | 0 | `-all` |
| `ip4` | [An IPv4 address or range](#the-ip4-mechanism) | 0 | `ip4:198.51.100.0/24` |
| `ip6` | [An IPv6 address or range](#the-ip6-mechanism) | 0 | `ip6:2001:db8::/32` |
| `a` | [The domain's own A/AAAA records](#the-a-mechanism) | 1 | `a` or `a:mail.yourdomain.com` |
| `mx` | [The domain's MX hosts](#the-mx-mechanism) | Yes; additional limits below | `mx` |
| `include` | [Another domain's SPF (e.g. a provider)](#the-include-mechanism) | 1 | `include:_spf.google.com` |
| `exists` | [Whether a name resolves, after macro expansion](#the-exists-mechanism) | 1 | `exists:%{ir}.spf.yourdomain.com` |
| `ptr` | [Validated reverse DNS names](#the-ptr-mechanism) | Yes; additional limits below | `ptr` — **do not use** |

`include`, `a`, `mx`, `ptr`, `exists` and the `redirect` modifier consume the
ten-term budget when evaluated, including recursive evaluations. This is not a
count of DNS packets: caching does not remove a term's cost, and `mx` and `ptr`
have additional DNS processing limits. See [counting your lookups](#counting-your-lookups).

### The `all` mechanism

`all` always matches, so put it after the other mechanisms. Mechanisms after it
are ignored, and `redirect` is ignored wherever it appears if `all` is present.
Its qualifier decides the outcome for senders that reach it:

```
v=spf1 include:_spf.google.com -all
```

If no mechanism matches and there is no `redirect`, the result is `neutral`:
no opinion. Use `all` for an explicit default, or `redirect` to share a policy.

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

List the IPv6 addresses your hosts actually send from. An `ip4:` term cannot
match an IPv6 connection; its result depends on the remaining mechanisms and
default. `a` and `mx` compare A records for IPv4 connections and AAAA records
for IPv6. An `include` only authorizes IPv6 if its referenced policy does.

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

`mx` can require several DNS queries: fetch the MX records, then resolve their
hosts' addresses. The MX records queried are included in the overall lookup
limit; counting the written `mx` term alone does not check all its DNS work.

A second, separate limit sits underneath it: resolving any one MX host must not
require more than ten address records. That cap is independent of the budget of
ten, and breaching it returns `permerror` for the whole record — evaluation
stops at `mx`, and nothing after it can authorize the sender.

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
- **Errors propagate.** An included `temperror` or `permerror` stops the outer
  evaluation with that error. If the target has no SPF record, `include`
  returns `permerror`, not a non-match. A removed provider record can therefore
  break senders evaluated after that include. `permerror` is distinct from
  SPF `fail`, and receiver handling can differ.

Each evaluated `include` costs one term, plus the DNS-querying terms evaluated
inside its target. If it matches, the outer qualifier applies: `-include:`
returns fail when the included policy passes.

### The `exists` mechanism

Matches if a hostname resolves to any A record after
macro expansion — `%{i}` is
the connecting IP, `%{ir}` its reversed form, `%{d}` the domain:

```
v=spf1 exists:%{ir}.spf.yourdomain.com -all
```

You are unlikely to write this, and likely to meet it: it is how allow-list and
reputation services plug into SPF, and how per-sender rules get expressed. If you
inherit one, check what it authorizes before changing it. It queries A records
even for an IPv6 connection, and consumes one term when evaluated.

### The `ptr` mechanism

Looks up the connecting IP's reverse DNS names, validates them by resolving
their addresses back to that IP, and matches a validated name equal to or
below the target domain. Reverse DNS alone is not enough.

Do not add it. It is slow, less reliable on DNS errors, and burdens the `.arpa`
servers; compliant receivers must still support it. Before removing an
inherited `ptr`, authorize any legitimate senders that depend on it using
more reliable mechanisms. Removing it saves a term only on paths that reach it.

## Qualifiers

A prefix on a mechanism sets the result when that mechanism matches. `+` is the
default, so a mechanism with no prefix means pass:

| Qualifier | Result | On `all` |
|---|---|---|
| `+` | Pass (default if omitted) | `+all` — **never do this**, authorizes the world |
| `-` | Fail (hard) | `-all` — declare all remaining IPs unauthorised |
| `~` | SoftFail | `~all` — weaker non-authorisation; not a pass |
| `?` | Neutral | `?all` — no opinion |

### `-all` vs `~all`

This is the decision people agonise over, and under DMARC it matters less than it
looks. Neither result is an SPF pass, so neither can satisfy DMARC through SPF.
A passing, aligned DKIM signature can still satisfy DMARC. Receivers may also
apply SPF policy independently when deciding whether to accept mail:

```
v=spf1 include:_spf.google.com ~all
```

Here `~all` declares weaker non-authorisation. Changing it to `-all` makes that
a fail. Inventory legitimate senders and test important forwarding routes
before tightening the default; neither qualifier guarantees delivery or
rejection, and ordinary forwarding can break SPF.

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

Evaluates another domain's policy only if no mechanism in the current record
matches, then returns its result:

```
v=spf1 redirect=_spf.yourdomain.com
```

Use it to share a policy across domains you administer. It consumes a term when
evaluated; a missing target SPF record produces `permerror`. It is **ignored
if an `all` mechanism is present**, regardless of ordering. Keep `redirect`
last for readability, and use `include` for a provider's independently managed
sender list.

### The `exp=` modifier

Names a TXT record providing an explanation when a mechanism produces `fail`:

```
v=spf1 include:_spf.google.com exp=why.yourdomain.com -all
```

The explanation is macro-expanded; receiving software can use it in an SMTP
response. It does not guarantee a message will reach the sender. It applies to
fail, not softfail or neutral, and its later DNS lookup does not consume the
ten-term evaluation budget. An invalid or unavailable explanation is ignored.
Neither `exp` nor `redirect` may appear more than once in a record.

## The rules that trip people up

- **One record only.** Publish at most one SPF `TXT` record at each DNS name. Two
  produces a `permerror`. That cannot satisfy DMARC through SPF, though a
  passing, aligned DKIM signature can still do so; see
  [diagnosing DMARC failures](/guides/fix-dmarc-failure/).
- **Ten DNS-querying terms per evaluation.** `include`, `a`, `mx`, `ptr`,
  `exists` and `redirect` count recursively when reached. Attempting an
  eleventh produces `permerror`; a sender that matches earlier can still pass.
- **[`mx`](#the-mx-mechanism) and [`ptr`](#the-ptr-mechanism) count more than
  once.** MX or PTR records queried count against that same ten, which
  is how a record showing a term count of 1 still `permerror`s. Underneath that,
  resolving any single MX or PTR host is capped at **10 address records** of its
  own — over the cap, `mx` is fatal while `ptr` merely ignores the extras. The
  spec draws that distinction because you control your MX records and not the
  reverse DNS of whoever is connecting.
- **Void lookups.** Receivers should limit empty answers and NXDOMAIN answers
  to two; the limit can be configurable. Exceeding the configured limit
  produces `permerror`. A missing include target is already an error in its
  own right, even if the void budget has not been spent.
- **255-octet strings.** Split a longer SPF value into adjacent quoted strings
  within **one TXT record**. They concatenate without inserted spaces, so keep
  the space between mechanisms inside one of the strings. Unrelated TXT records
  at the same name are fine.
- **`ip4:` and `ip6:` are free.** They cost no lookups, which is what makes
  flattening work.

## Counting your lookups

The count is recursive. For a reproducible example, suppose you publish these
two TXT values at the indicated names:

```
yourdomain.com:
v=spf1 include:_spf.yourdomain.com -all

_spf.yourdomain.com:
v=spf1 a:mail.yourdomain.com ip4:198.51.100.10 -all
```

If evaluation reaches `a:mail.yourdomain.com`, it has consumed two DNS-querying
terms: the outer include and the inner `a`. The `ip4` and `all` mechanisms add
none. The initial TXT lookup is not one of those ten terms.

Provider policies can change their nesting without a change to your own record.
The [SPF record checker](/tools/spf-checker/) expands includes and redirects
to help inspect that structure. Its static count is not an exact evaluation
for every message: matching can stop early and macros depend on message inputs.
The checker expands each target only once; a receiver can evaluate a repeated
include's subtree again, so the displayed count can be too low. MX/PTR
processing and void limits also need separate attention. A policy that
exceeds the budget on one path may still pass for a sender matched earlier,
making the problem appear intermittent.

### When you exceed 10

In rough order of preference:

1. **Remove senders you no longer use**, including unnecessary `a` and `mx`
   mechanisms. Check that legitimate mail does not depend on them first.
2. **Move a sender's envelope domain to a subdomain.** `news.yourdomain.com`
   needs its own SPF record and has its own evaluation budget. Changing only
   the visible From address does not do this; retain DMARC alignment.
3. **Flatten only if you can maintain the address list.** Replacing an include
   with `ip4` and `ip6` ranges removes its DNS-querying terms, but you must track
   every provider change. A one-time snapshot can remove legitimate senders
   later or keep authorizing old addresses.

## Examples

Use these as starting points for the domain in your envelope sender. Merge
needed senders into its existing SPF record rather than adding a second one.

**Google Workspace only:**
```
v=spf1 include:_spf.google.com -all
```

**Microsoft 365 only:**
```
v=spf1 include:spf.protection.outlook.com -all
```

**An envelope domain used by Google Workspace, SendGrid and a fixed IP:**
```
v=spf1 include:_spf.google.com include:sendgrid.net ip4:198.51.100.10 -all
```

SendGrid domain authentication normally configures a separate return-path
subdomain. Follow its generated DNS records for that name; adding an include
to your apex does not change the envelope domain it uses.

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

For a name you intend to authorize, look for one SPF record beginning `v=spf1`.
Two separate SPF records produce `permerror`; several quoted strings on one
answer line can be a single valid record. Query the actual envelope domain,
including its subdomain when applicable.

`dig` shows the published value. Use the [SPF record checker](/tools/spf-checker/)
to inspect recursive terms, then send test mail and inspect the receiver's
authentication results for the actual domain and connection.

## Common mistakes

- `+all` or a trailing bare `all` — authorizes any server on earth.
- More than one `v=spf1` record on the domain.
- Reaching more than ten DNS-querying terms during evaluation.
- A stale `include:` whose target no longer publishes SPF.
- Assuming SPF covers the `From:` header — it doesn't; see above.
- Adding a provider to the apex SPF record when it uses a different envelope
  domain. Authorize it where SPF is actually checked.

Across a portfolio of domains, the lookup count is the thing that quietly drifts
out of range as clients add tools — and you are not the one adding them. Watching
received SPF results across client domains helps you spot failures, though
reports are delayed and not every receiver sends them. [DMARC Analyzer](/)
groups that evidence by client and domain, with raw authentication details in
the [domain drill-down](/docs/domain-detail/). It is self-hosted, with no
per-domain fee, and is one part of
[running DMARC for many client domains](/guides/dmarc-multiple-client-domains/).

## What next

After publishing, confirm alignment in your [aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/) — SPF passing isn't enough
on its own; it must **align** with your `From:` domain to satisfy DMARC. If it
isn't, see [why your email is failing DMARC](/guides/fix-dmarc-failure/), and
remember SPF is only one leg of [SPF, DKIM &
DMARC](/guides/spf-dkim-dmarc/).
