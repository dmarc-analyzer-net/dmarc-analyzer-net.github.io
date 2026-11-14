---
title: 'DMARC record tags: every tag and what its default does'
seoTitle: DMARC record tags and their defaults
description: DMARC record tags and defaults — p, sp, np, rua, ruf, adkim, aspf, fo, t and psd — plus historic pct, ri and rf, and when to use each.
publishDate: 2026-07-28
---

**A DMARC record is a list of tags**, and most of them already have the default you
want. That is the useful thing to know before you start adding them: a short record
is not an incomplete one, and every tag you publish at its default is a tag you can
get wrong later.

## Current tags at a glance

**DMARC** (Domain-based Message Authentication, Reporting, and Conformance,
[RFC 9989](/rfc/9989/)) defines these current policy-record tags.

| Tag | What it does | Default if absent | Do you need it? |
|---|---|---|---|
| `v` | Marks the record as DMARC | none — required, and must be first | Always |
| `p` | Policy for the domain itself | `none` with a valid `rua`; otherwise no DMARC processing | Always publish it explicitly |
| `sp` | Policy for existing subdomains | inherits `p` | Only to make subdomains *differ* |
| `np` | Policy for non-existent subdomains | follows `sp`, or `p` if no `sp` | Optional; useful with parked names |
| `rua` | Where aggregate reports go | none — no aggregate reports requested | Yes, to monitor results |
| `ruf` | Where per-message failure reports go | none — no failure reports requested | Usually leave it off |
| `adkim` | DKIM alignment mode: relaxed or strict | `r` (relaxed) | Rarely |
| `aspf` | SPF alignment mode: relaxed or strict | `r` (relaxed) | Rarely |
| `fo` | When failure reports are requested | `0` | Only alongside `ruf` |
| `t` | Test the applicable policy one level below enforcement | `n` — apply the published policy | Only for testing; check receiver support |
| `psd` | Identifies a public suffix or an organizational-domain boundary | `u` — discover the boundary via DNS | For public suffixes or explicit organizational boundaries |

Unknown tags are ignored. That makes a misspelt tag easy to overlook; errors in
recognised tags can instead change how the record is processed.

### Historic tags

`pct`, `ri` and `rf` have been removed from the current specification and are
registered as **historic**. Their defaults below describe the older standard,
not settings a current receiver must implement.

| Tag | Historic purpose | Historic default | Use in a new record? |
|---|---|---|---|
| `pct` | Percentage of failing mail subject to the published policy | `100` | Avoid relying on percentage sampling |
| `ri` | Requested seconds between aggregate reports | `86400` (a day) | No |
| `rf` | Requested failure-report format | `afrf` | No |

A receiver using the current specification ignores these as unknown tags. An
older implementation may still interpret them. Publishing a tag does not prove
that a receiver supports it.

## The record you actually want

For most domains, starting out:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Three tags. Relaxed alignment and normal policy application are already the
defaults. `rua` requests aggregate reports; it does not guarantee that every
receiver will send them or that they will arrive on an exact daily schedule.
The [record generator](/tools/dmarc-generator/) can build this starting record.

## `p`: publish the policy explicitly

`p` is recommended rather than required in the current specification. If an
otherwise valid record omits it, a `rua` containing at least one syntactically
valid reporting URI lets processing continue as `p=none`. Without such a `rua`,
the receiver applies no DMARC processing to the message. The same fallback
applies to an invalid `p`, `sp` or `np` value.

Publish `p=none`, `p=quarantine` or `p=reject` explicitly. That makes your intent
clear and avoids depending on a fallback that older implementations may not share.
These policies express your handling preference; receivers retain local control
over delivery.

## `sp` and `np`: subdomains

**Absent `sp` does not mean "no subdomain policy".** When a subdomain inherits
its organizational domain's record, it inherits `p` unless `sp` or `np` changes
the applicable policy. With `p=reject` at `yourdomain.com`, an existing
`mail.yourdomain.com` without its own record inherits that rejection request.

```
v=DMARC1; p=reject; sp=quarantine; rua=mailto:dmarc@yourdomain.com
```

This record requests rejection for the domain itself and quarantine for existing
subdomains that inherit it. `sp=none` would instead request no DMARC enforcement
for those subdomains, even with `p=reject` on the parent.

A record at the exact domain in the message's `From:` address takes precedence
and uses its own `p`. Otherwise, the DNS tree walk selects a record at the
organizational domain, or at the public suffix if appropriate; an intermediate
record is not automatically the policy for every name beneath it.

**A delegated subdomain can be an organizational domain.** For example, publish
this at `_dmarc.department.yourdomain.com`:

```
v=DMARC1; p=reject; sp=quarantine; np=reject; psd=n; rua=mailto:dmarc@yourdomain.com
```

For receivers using the tree walk, `psd=n` makes `department.yourdomain.com` an
organizational boundary. Its `sp` and `np` then govern inheriting names beneath
it. Merely delegating DNS does not establish that boundary. A subdomain record
that is not selected as an organizational-domain or public-suffix policy does
not pass its `sp` down the tree.

`np` applies to **non-existent subdomains**, meaning a DNS response of `NXDOMAIN`.
A name without an A or MX record is not necessarily non-existent. For those
non-existent names, `np` takes precedence over `sp`; if `np` is absent, the
policy falls back to `sp`, then `p`:

```
v=DMARC1; p=quarantine; np=reject; rua=mailto:dmarc@yourdomain.com
```

Older receivers using a public suffix list can identify a different
organizational domain and may not support `np`. Publish explicit records at
sending domains when you need a specific policy across implementations.

## `t`: testing the applicable policy

`t=n` is the default: request the policy specified by the applicable `p`, `sp`
or `np`. `t=y` requests testing one level below that policy:

| Applicable policy | With `t=y` |
|---|---|
| `reject` | `quarantine` |
| `quarantine` | `none` |
| `none` | `none` — unchanged |

```
v=DMARC1; p=reject; t=y; rua=mailto:dmarc@yourdomain.com
```

This requests quarantine for failing messages while testing a rejection policy.
`t` does not change report generation or sample a percentage of messages.
Receivers may also use special handling associated with test mode.

An older receiver that does not recognise `t` ignores it and sees `p=reject`.
Do not depend on `t=y` alone to prevent rejection during a rollout; publish
`p=none` explicitly when you want monitoring without a DMARC enforcement request.

## `pct`: historic percentage sampling

Under the [previous DMARC specification](/rfc/7489/), `pct` selected a share of
failing messages for the published policy. `p=quarantine; pct=25` requested
quarantine for roughly a quarter; the rest reverted to normal local handling.
With `p=reject; pct=25`, the receiver was advised to reject the selected quarter
and treat the rest as `quarantine`. Neither case guaranteed inbox delivery.

Percentage sampling was removed because implementations handled intermediate
values inconsistently. `t=y` replaces the testing use of `pct=0`; `t=n` is normal
policy application. It does not replace a percentage ramp.

**A receiver following the current specification ignores `pct`.** A record with
`p=reject; pct=25` can therefore request rejection for all failing messages at
that receiver, while an older receiver may still sample. Do not use `pct` as a
reliable limit on enforcement. Roll out by scope using explicit records on
individual sending subdomains. [What changed in the new DMARC
standard](/guides/dmarc-rfc-9989/) covers the broader transition.

## `rua` vs `ruf`

Both accept comma-separated reporting URIs. Use `mailto:` destinations for
email reporting:

- **`rua`** is the aggregate stream: XML summaries of counts and results,
  usually daily, without message content. This is the tag that makes DMARC a source of
  information rather than a switch. Publish it from day one.
- **`ruf`** is per-message failure reports. Few receivers send them at all; those
  that do may redact heavily, and what arrives can include message content, so the
  destination mailbox carries a data-protection weight the `rua` mailbox does not.
  Most domains should leave it off.

`fo` only modifies `ruf` behaviour — with no `ruf`, receivers ignore it. Its values
are colon-separated: `0` (request a report when neither mechanism produces an aligned pass, the
default), `1` (request one when either mechanism fails to produce an aligned pass), `d` for DKIM failures
regardless of alignment and `s` for SPF ones. `1` and `0` are mutually exclusive.

### Reporting to a mailbox on another domain

If the mailbox in `rua` is outside the record's own organizational domain — an
analyzer you run, or an agency inbox — the destination domain has to authorise
it. `dmarc@mail.yourdomain.com` under a record at `yourdomain.com` is inside that
organizational domain and needs nothing; a second domain you also own is outside
it and still does:

```
yourdomain.com._report._dmarc.analyzer.example.   TXT   "v=DMARC1"
```

Miss it and conforming receivers discard the request silently. See
[reports won't arrive if `rua=` is wrong](/guides/no-dmarc-record-found/) for the
single-domain case.

## `adkim` and `aspf`: relaxed vs strict

Both default to relaxed, which matches a subdomain against its organizational
domain — so a DKIM signature from `mail.yourdomain.com` aligns with a `From:` of
`yourdomain.com`. Strict (`s`) demands an exact match.

Relaxed is right for almost everyone, because email platforms routinely sign and
send from a subdomain of yours. Reach for strict only when you have a specific
reason to reject subdomain-signed mail, and check your reports first — see
[alignment](/glossary/dmarc-alignment/) for what the comparison actually is.

## `ri` and `rf`: historic reporting preferences

`ri` requested a reporting interval in seconds, with a default of `86400`.
The older specification required support for daily reports and recommended
hourly reports on request, with non-daily intervals supplied on a best-effort
basis. It was never a guarantee of hourly delivery. The current specification
has no `ri` setting; leaving it out avoids an unsupported scheduling request.

`rf` requested the failure-report format. The older specification defined only
`afrf`, its default. The current specification removes the tag rather than
requiring it to select that format. Neither historic tag belongs in a new record.

## `psd`: public suffixes and organizational boundaries

`psd` helps the DNS tree walk identify organizational domains:

- **`y`** declares a public suffix domain, the level above domains registered
  beneath it. Public-suffix operators must use this value on their policy records.
- **`n`** declares the publishing domain an organizational domain for itself and
  its subdomains. This can be useful for delegated departments or customers.
- **`u`**, the default, leaves organizational-domain discovery to the tree walk.

Most company domains can omit `psd`. Do not copy `psd=y` into an ordinary company
record: it changes the organizational boundary used for policy discovery and
alignment. Our [record checker](/tools/dmarc-checker/) flags that case.

Use `psd=n` only when you intend to establish that boundary. Older receivers can
still use a public suffix list, and the tree walk has a depth limit: for author
domains longer than eight labels it skips some intermediate names. Publish a
record at the exact sending domain rather than relying on a deeply nested
boundary to be found.

## Tags that don't exist

Some mistakes are ignored; others prevent DMARC processing. DNS will still
publish the TXT record, so check its contents after saving it.

| Mistake | Why it fails |
|---|---|
| `v=dmarc1` | The version value is case-sensitive |
| `p=none; v=DMARC1` | `v` must come first, or the record may be ignored entirely |
| `rua=dmarc@yourdomain.com` | `rua` takes a URI; use `mailto:` for email delivery |
| `pct=25%` | Historic `pct` took an integer; current receivers ignore the tag |
| `policy=reject`, `subdomain_policy=none` | Not tag names; unknown tags are ignored |
| Two DMARC records at `_dmarc` | Ambiguous, so receivers apply no policy at all |

## Reading the tags a receiver actually saw

Aggregate reports echo the policy the receiver applied, tag by tag, alongside the
record it found. That is how a stale record, a second record, or an `sp` you thought
you'd removed shows up — the published record and the observed one stop matching.
Across one domain that is a spot check; across a portfolio it is a per-domain
comparison every day, which is what [DMARC Analyzer](/) does, and what the
[published-vs-observed view](/docs/domain-detail/) exists for.

## What next

- [Publish your first DMARC record](/guides/publish-your-first-dmarc-record/) if you
  are starting from nothing.
- [From monitoring to enforcement](/guides/from-monitoring-to-enforcement/) for the
  staged path to `p=reject`.
