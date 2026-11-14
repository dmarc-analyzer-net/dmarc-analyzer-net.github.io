---
title: What changed in the new DMARC standard (RFC 9989)
seoTitle: What changed in DMARC RFC 9989
description: DMARC has a new specification. What RFC 9989 changed — pct, ri and rf removed, t and psd added, the tree walk replacing the public suffix list — and what to do.
publishDate: 2026-07-28
---

**DMARC has a new specification.** [RFC 9989](/rfc/9989/) replaced
[RFC 7489](/rfc/7489/) in May 2026, along with two companion documents covering
reporting, and the work is often called DMARCbis after
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

**Receiver support can differ.** A receiver following the current specification
ignores `pct`; an older receiver may still interpret it and may ignore `t`.
Publishing `p=reject; pct=25` therefore does not reliably limit rejection to a
quarter of failing messages, and `p=reject; t=y` does not protect against rejection
by an implementation that ignores `t`.

`pct` still appears in newly published records: of the DMARC records first published
across the top million domains between August and October 2026, one in eight
included it ([three months of measurements](/blog/dmarc-t-tag-three-months/)).
That measures what domain owners publish, not what receivers implement. For a
gradual rollout, use explicit policies on individual sending subdomains. The
[monitoring-to-enforcement guide](/guides/from-monitoring-to-enforcement/) covers
the staged path.

## What was added

- **`t`**, above.
- **`psd`**, a flag for organizational boundaries: `y` declares a public suffix,
  while `n` declares the publishing domain an organizational domain for itself and
  its subdomains. Most company domains can omit it; delegated subdomains can use
  `psd=n` to establish their own boundary.
- **`np`** is now part of the core standard. It sets a policy for non-existent
  subdomains (`NXDOMAIN`), and previously lived in a separate experimental document.
  Missing A or MX records alone do not make a domain non-existent.

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

- **The walk can discover records at several levels.** It is bounded: for author
  domains longer than eight labels, some intermediate names are skipped. Policy
  discovery prefers a record at the author domain, then its organizational domain,
  then its public suffix. An intermediate record is not automatically inherited.
- **A delegated subdomain can declare itself an organizational domain**, by publishing
  `psd=n`. That is what makes its own `sp` and `np` govern the names beneath it, and
  it is what large organisations devolving DNS to departments or customers were
  asking for.
- The `sp` and `np` rules are unchanged in spirit: a record found above the author
  domain applies `sp` to existing subdomains and `np` to non-existent ones. An
  existing subdomain falls back to `p` when `sp` isn't published; a non-existent one
  falls back to `sp` first, and only then to `p`.

## `p` is no longer strictly required

Under RFC 7489 a record without `p` was invalid. Under RFC 9989 `p` is *recommended*,
and what happens without it is more specific than "it breaks":

- **With a valid `rua`**, receivers treat the record as `p=none` and carry on, so you
  get reports and no enforcement.
- **Without a syntactically valid reporting URI in `rua`**, receivers apply no
  DMARC processing to the message at all.

Publish `p` explicitly regardless — relying on a default that used to be an error is a
poor bet — but if you inherit a record with no policy, that is what it is doing.

## Reporting moved into its own documents

Aggregate and failure reporting now have dedicated specifications,
[RFC 9990](/rfc/9990/) and [RFC 9991](/rfc/9991/). The rules are largely as they were, with one detail worth knowing if you send
reports to a mailbox on another domain: the check that the destination has authorised
you now compares **organizational domains** rather than exact names, and the wildcard
form is explicitly sanctioned:

```
*._report._dmarc.agency.example.   TXT   "v=DMARC1"
```

If you run reporting for other people's domains, [DMARC for many client
domains](/guides/dmarc-multiple-client-domains/) covers that record and the trap that
comes with mixing it with per-client ones.

## What you should actually do

Three checks, and then get on with your day:

1. **Look for a sub-100 `pct`** in any record you meant to finish ramping. That is the
   one finding here with live consequences — a forgotten `pct=25` can produce different
   enforcement at receivers that sample and those that ignore it. Our
   [record checker](/tools/dmarc-checker/) flags it.
2. **Drop `ri` and `rf`** if you find them. They do nothing, they never did much, and
   they now name tags that are not in the specification.
3. **If you have delegated subdomains**, check which of them publish DMARC records,
   and whether any declare an organizational boundary with `psd=n`. The tree walk
   and the older public-suffix approach can select different organizational domains.

Nothing here requires a rushed change. The value of knowing it is that the next time
you read guidance recommending `pct`, or a tool tells you `t=y` is an unrecognised tag,
you will know which of you is out of date.

## What next

- [DMARC record tags](/guides/dmarc-record-tags/) — every tag, its default, and
  whether you need it.
- [From monitoring to enforcement](/guides/from-monitoring-to-enforcement/) — the
  staged path to `p=reject`, and where a ramp fits.
