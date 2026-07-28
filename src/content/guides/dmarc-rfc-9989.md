---
title: What changed in the new DMARC standard (RFC 9989)
seoTitle: What changed in DMARC RFC 9989
description: DMARC has a new specification. What RFC 9989 changed — pct, ri and rf removed, t and psd added, the tree walk replacing the public suffix list — and what to do.
publishDate: 2026-07-28
---

**DMARC has a new specification.** RFC 9989 replaced RFC 7489 in May 2026, along with
two companion documents covering reporting, and the work is often called DMARCbis after
the draft it came from. The headline is not any single tag: it is that DMARC is now a
Standards Track document rather than the Informational one it had been for eleven years.

For most readers the correct action is **nothing**. A record like
`v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com` means exactly what it did last
year and will keep working. There are three exceptions, all covered below: you have a
`pct` in a record you meant to finish ramping, you have `ri` or `rf` in a record doing
nothing, or you have deep subdomain delegation where policy discovery changed.

## What was removed

Three tags are gone from the specification.

**`pct`** is the significant one. It applied your policy to a percentage of failing
mail, and it was removed because operational experience showed receivers implemented
values other than 0 and 100 inconsistently — inconsistently enough that publishing
`pct=25` meant genuinely different things at different providers. The two values that
*were* implemented reliably survive as a new tag, `t`.

**`ri`** asked receivers for a reporting interval in seconds. Providers sent daily
reports regardless, so it never did much.

**`rf`** named the failure-report format, and only one format was ever defined, so the
tag could only carry its own default.

Also gone: the `!10m` size suffix you could append to a reporting address to cap report
size. It is now explicitly obsolete syntax, and reporters ignore it.

None of these break anything where they are already published — receivers that ignore
a tag behave exactly as they do for a tag they have never heard of. They are just
noise now, and noise naming something that no longer exists.

## What replaced `pct`

`t` — for testing. Two values:

```
v=DMARC1; p=reject; t=y; rua=mailto:dmarc@yourdomain.com
```

`t=y` asks receivers to apply the policy one level *below* the one you published: a
`p=reject` record behaves as quarantine, and `p=quarantine` behaves as none. `t=n` is
the default and means "apply the policy as published". It is the direct successor to
`pct=0` — the value people used to signal "I am watching, don't act yet".

The honest position on timing: **receivers honour `pct` today and will for a while**, so
a percentage ramp still works, and it is what most guidance on the internet still
describes. `t` is where the standard has gone. Treat a `pct` ramp as a transitional
technique with an end date rather than part of a record you intend to keep, and if
you want a gradual move to enforcement without either tag, ramp by *scope* instead —
one subdomain at a time with `sp`. The
[monitoring-to-enforcement guide](/guides/from-monitoring-to-enforcement/) walks
through that.

## What was added

- **`t`**, above.
- **`psd`**, a flag for registry and public-suffix operators, declaring that a name
  sits above the organizational domains beneath it. If you run a company domain this
  tag is not for you, and finding it in your record almost always means it was copied
  from someone else's.
- **`np`** is now part of the core standard. It sets a policy for subdomains that
  don't resolve at all, and it previously lived in a separate experimental document.
  Worth publishing: nobody sends legitimate mail from a name that doesn't exist.

Every tag with its default is on the [DMARC record tags](/guides/dmarc-record-tags/)
page, which is the reference to keep open.

## Policy discovery changed

This is the change with the widest reach and the least visibility, because it alters
what receivers *do* rather than what you publish.

RFC 7489 determined your organizational domain using a Public Suffix List — the same
kind of list browsers use to decide that `co.uk` is not a registrable domain. It never
mandated *which* list, or how often to refresh it, which meant two receivers could
disagree about where your organizational domain began.

RFC 9989 replaces that with a **DNS tree walk**. A receiver queries `_dmarc` at the
domain in the `From:` header; if there is no valid record there, it walks up the tree
looking for one. The practical consequences:

- **You can publish policy records at more than one level** and have them found, which
  is what large organisations with delegated DNS wanted.
- **A record on an intermediate name now matters** in a way it previously might not
  have. If you have delegated subdomains to teams or customers, it is worth knowing
  which of those names publish DMARC records, because they are now discoverable steps
  in the walk.
- The `sp` and `np` rules are unchanged in spirit: a record found above the author
  domain applies `sp` to existing subdomains and `np` to non-existent ones, falling
  back to `p`.

## `p` is no longer strictly required

Under RFC 7489 a record without `p` was invalid. Under RFC 9989 `p` is *recommended*,
and what happens without it is more specific than "it breaks":

- **With a valid `rua`**, receivers treat the record as `p=none` and carry on, so you
  get reports and no enforcement.
- **Without a `rua`**, receivers apply no DMARC processing to the message at all.

Publish `p` explicitly regardless — relying on a default that used to be an error is a
poor bet — but if you inherit a record with no policy, that is what it is doing.

## Reporting moved into its own documents

Aggregate and failure reporting now have dedicated specifications, RFC 9990 and
RFC 9991. The rules are largely as they were, with one detail worth knowing if you send
reports to a mailbox on another domain: the check that the destination has authorised
you now compares **organizational domains** rather than exact names, and the wildcard
form is explicitly sanctioned:

```
*._report._dmarc.agency.com.   TXT   "v=DMARC1"
```

If you run reporting for other people's domains, [DMARC for many client
domains](/guides/dmarc-multiple-client-domains/) covers that record and the trap that
comes with mixing it with per-client ones.

## What you should actually do

Three checks, and then get on with your day:

1. **Look for a sub-100 `pct`** in any record you meant to finish ramping. That is the
   one finding here with live consequences — a forgotten `pct=25` means three quarters
   of failing mail is being treated more softly than you think. Our
   [record checker](/tools/dmarc-checker/) flags it.
2. **Drop `ri` and `rf`** if you find them. They do nothing, they never did much, and
   they now name tags that are not in the specification.
3. **If you have delegated subdomains**, check which of them publish DMARC records,
   since the tree walk makes them discoverable where the old public-suffix approach
   might not have.

Nothing here requires a rushed change. The value of knowing it is that the next time
you read guidance recommending `pct`, or a tool tells you `t=y` is an unrecognised tag,
you will know which of you is out of date.

## What next

- [DMARC record tags](/guides/dmarc-record-tags/) — every tag, its default, and
  whether you need it.
- [From monitoring to enforcement](/guides/from-monitoring-to-enforcement/) — the
  staged path to `p=reject`, and where a ramp fits.
