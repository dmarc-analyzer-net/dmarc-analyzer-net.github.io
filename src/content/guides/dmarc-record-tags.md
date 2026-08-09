---
title: 'DMARC record tags: every tag and what its default does'
seoTitle: DMARC record tags and their defaults
description: A field reference for every DMARC record tag — p, sp, np, pct, rua, ruf, adkim, aspf, fo, ri and rf — with each tag's default and whether you need it.
publishDate: 2026-07-28
---

**A DMARC record is a list of tags**, and most of them already have the default you
want. That is the useful thing to know before you start adding them: a short record
is not an incomplete one, and every tag you publish at its default is a tag you can
get wrong later.

## Every tag at a glance

| Tag | What it does | Default if absent | Do you need it? |
|---|---|---|---|
| `v` | Marks the record as DMARC | none — required, and must be first | Always |
| `p` | Policy for the domain itself | none | Always publish it |
| `sp` | Policy for existing subdomains | inherits `p` | Only to make subdomains *differ* |
| `np` | Policy for subdomains that don't exist | follows `sp`, or `p` if no `sp` | Optional; useful with parked names |
| `pct` | Apply the policy to a percentage of failing mail | `100` | As a temporary quarantine ramp only |
| `rua` | Where aggregate reports go | none — no reports are sent | Yes. This is the point of DMARC |
| `ruf` | Where per-message failure reports go | none | Almost never |
| `adkim` | DKIM alignment mode: relaxed or strict | `r` (relaxed) | Rarely |
| `aspf` | SPF alignment mode: relaxed or strict | `r` (relaxed) | Rarely |
| `fo` | When failure reports are generated | `0` | Only alongside `ruf` |
| `ri` | Requested seconds between aggregate reports | `86400` (a day) | No — advisory |
| `rf` | Requested failure-report format | `afrf` | No — one value is defined |
| `t` | Testing mode: apply the policy, or don't | `n` | See `pct` below |
| `psd` | Declares the name a public suffix domain | `u` (work it out) | No — registry operators only |

Anything not in that list is ignored by receivers, which is why a typo is silent
rather than fatal.

The list is a registry rather than a fixed set: `pct`, `rf` and `ri` are formally
**historic** as of [RFC 9989](/rfc/9989/), while `np` and `t` are new there.
Receivers still honour the historic three, so nothing breaks — they are simply
not what to reach for in a record you are writing today.

## The record you actually want

For most domains, starting out:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Three tags. Everything omitted is already at the default in the table above:
relaxed alignment on both mechanisms, the full mail stream, daily reports, no
failure reports. The [record generator](/tools/dmarc-generator/) builds records this
way deliberately — it leaves out every tag you haven't changed.

## `sp` and `np`: subdomains

This is the tag pair people get wrong most often, and the mistakes are quiet ones.

**Absent `sp` does not mean "no subdomain policy".** Subdomains inherit `p`. If you
publish `p=reject` on `yourdomain.com` and nothing else, mail failing DMARC from
`mail.yourdomain.com` is rejected too. That is usually what you want, and it means
`sp` is a tag for *exceptions*, not for switching subdomain protection on.

```
v=DMARC1; p=reject; sp=quarantine; rua=mailto:dmarc@yourdomain.com
```

Two things about it that surprise people:

- **`sp` is ignored in a record published *on* a subdomain.** It only has meaning on
  the organizational domain, because that is where a receiver looks it up. Putting
  `sp=` on `mail.yourdomain.com` does nothing at all.
- **`sp=none` under an enforcing `p` is a real hole**, not a cautious setting. It
  publishes "reject forgeries of my domain, and deliver forgeries of every
  subdomain" — and attackers read DNS.

`np` covers subdomains that don't resolve at all, which is worth having because
nobody sends legitimate mail from a name that doesn't exist:

```
v=DMARC1; p=quarantine; np=reject; rua=mailto:dmarc@yourdomain.com
```

It takes precedence over `sp` for those names, and falls back to `sp` — then `p` —
when it's absent.

## `pct`: what it really does, and where it's going

`pct` applies your policy to a share of *failing* messages, which makes it a ramp:
publish `p=quarantine; pct=25` and roughly a quarter of failing mail is quarantined
while the rest is delivered normally.

The trap is that the unselected mail is **not exempted** — it drops to the next
weaker policy. Under `quarantine` the next step down is `none`, so the ramp behaves
as expected. Under `reject` it doesn't: `p=reject; pct=25` rejects a quarter of
failing mail and *quarantines the other three quarters*. None of it is delivered
normally, which is not what "25%" suggests to anyone reading it.

It is also on its way out. The current revision of the DMARC specification removes
`pct` entirely, having found that receivers implemented values other than 0 and 100
inconsistently enough to be unreliable, and replaces the two values that did work
with `t=y` (test — apply one level below the stated policy) and `t=n` (the default —
apply it). Receivers honour `pct` today and will for some time, so a quarantine ramp
still works, but treat it as a transitional technique rather than part of a record
you intend to keep. Ramping by *scope* — one subdomain at a time with `sp` — has
none of these problems. [What changed in the new DMARC
standard](/guides/dmarc-rfc-9989/) covers this and the rest of the revision.

## `rua` vs `ruf`

Both take a comma-separated list of `mailto:` destinations, and they are not
variations on a theme:

- **`rua`** is the aggregate stream: one XML summary per receiver per day, counts
  and results, no message content. This is the tag that makes DMARC a source of
  information rather than a switch. Publish it from day one.
- **`ruf`** is per-message failure reports. Few receivers send them at all; those
  that do may redact heavily, and what arrives can include message content, so the
  destination mailbox carries a data-protection weight the `rua` mailbox does not.
  Most domains should leave it off.

`fo` only modifies `ruf` behaviour — with no `ruf`, receivers ignore it. Its values
are colon-separated: `0` (report when everything fails, the default), `1` (report
when anything fails, which is what people usually mean), `d` for DKIM failures
regardless of alignment and `s` for SPF ones. `1` and `0` are mutually exclusive.

### Reporting to a mailbox on another domain

If the mailbox in `rua` is on a different domain from the record — an analyzer you
run, or an agency inbox — the destination domain has to authorise it:

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

## `ri` and `rf`: the two you can ignore

`ri` asks for a reporting interval in seconds. Receivers must support daily and
*should* support hourly, but anything other than daily is best-effort, and in
practice you get daily reports whatever you ask for. `rf` names the failure-report
format, and exactly one format is defined, so the only value it can carry is its
default. The current revision of the specification drops both.

## `psd`: not for you, unless you run a registry

`psd` declares whether a name is a **public suffix domain** — the level above the
domains people register, like `co.uk`. It exists for registry and public-suffix
operators, who publish a policy covering names beneath them. Its default, `u`, means
"work it out", which is what receivers do for everyone else.

It is in this reference for one reason: if you find `psd=y` on an ordinary company
domain, it was almost certainly copied from someone else's record, and it changes how
policy is discovered for every name underneath you. Remove it. Our
[record checker](/tools/dmarc-checker/) flags it for exactly that case.

## Tags that don't exist

The failure mode for all of these is silence: the record parses, the setting is
ignored, and nothing tells you.

| Mistake | Why it fails |
|---|---|
| `v=dmarc1` | The version value is case-sensitive |
| `p=none; v=DMARC1` | `v` must come first, or the record may be ignored entirely |
| `rua=dmarc@yourdomain.com` | `rua` takes a URI — the `mailto:` scheme is required |
| `pct=25%` | An integer, no percent sign |
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
