---
title: What "No DMARC record found" means (and how to fix it)
seoTitle: '"No DMARC record found": how to fix'
description: Getting "No DMARC record found"? Check the DNS name, TXT record and inherited policy, then publish or repair DMARC without weakening existing protection.
publishDate: 2026-07-23
updatedDate: 2026-11-25
---

**"No DMARC record found"** means a checker did not find a DMARC policy record
at the name it checked. For `yourdomain.com`, that name is
`_dmarc.yourdomain.com`. Check the DNS name and any inherited policy before
adding a record: a missing record on a subdomain does not necessarily mean
DMARC is absent.

## Why it happens

A **DMARC** policy record ([RFC 9989](/rfc/9989/)) is published as a `TXT`
record under `_dmarc`. A missing-record warning can mean:

- you've **never published** one;
- it's on the **wrong host**, such as the root domain instead of `_dmarc`;
- you're checking a **subdomain** with no record of its own;
- a resolver still has a **cached answer** from before the change; or
- the lookup failed, or the checker discarded records it could not use.

A DNS timeout or `SERVFAIL` is a lookup error, not proof that no policy exists.
Check again and investigate the DNS error before adding another record.

## The fix

For a **new setup with no existing or inherited policy**, add one `TXT` record
at `_dmarc.yourdomain.com` in monitoring mode:

```text
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Create the report mailbox first, or replace the address with one that accepts
reports. If a policy already exists, repair that record instead of adding a
second one. Keep its policy and other valid tags when correcting the host or
report address. Publishing `p=none` on a subdomain that inherits `p=reject`
would weaken its protection.

- The **Name/Host** is often `_dmarc`; check whether your DNS host appends the
  domain or expects the full name.
- `p=none` expresses no handling preference for mail that fails DMARC. Receivers
  can still filter or reject mail under their own rules.
- `rua=` requests [aggregate reports](/glossary/dmarc-aggregate-report/) from
  participating receivers. It does not guarantee reports from every receiver.

Use the DNS provider serving your domain's **authoritative nameservers**;
editing a zone elsewhere has no effect. Provider-specific steps are under
[DMARC setup](/dmarc-for/).

## Confirm it's actually there

Check outside your DNS provider's control panel:

```sh
dig TXT _dmarc.yourdomain.com
```

Read the response status as well as the answer. `NXDOMAIN` means the queried
name does not exist; `NOERROR` with no TXT answer can mean the name exists
without a TXT record. Neither says whether a parent policy applies.

You want **one DMARC TXT record**, beginning with `v=DMARC1`. Other unrelated
TXT records can coexist at the name. Two quoted strings on the same TXT
record are joined in order without added spaces; they are not two records.

- **No DMARC answer** — check the authoritative zone, the exact name and any
  cached negative answer.
- **Two DMARC records** — receivers discard both at that name. Policy discovery
  can still find an applicable policy above it. Combine the intended settings
  into one record; keep the enforcement policy you intend to apply.
- **A DNS error** — fix resolution rather than treating the result as an absent
  record.

The [DMARC record checker](/tools/dmarc-checker/) checks the record's syntax
and looks for external reporting authorization records. It does not determine
organizational domains: sibling hosts such as `news.yourdomain.com` and
`mail.yourdomain.com` can trigger an authorization warning even when they share
one. That warning alone does not establish that reports will be withheld.
When a subdomain has no record, the checker prompts you to check the parent;
follow that check to investigate inheritance.

If your control panel and the public answer disagree, find the authoritative
nameservers:

```sh
dig NS yourdomain.com
```

For a subdomain, query its name first. If `dig NS news.yourdomain.com`
returns no NS answer because the subdomain is not delegated, remove the
leftmost label and query `dig NS yourdomain.com`. Continue toward the root
until you find the enclosing zone's nameservers. Use those servers to query
the original `_dmarc.news.yourdomain.com` name.

Query one of the returned servers directly, using `dig @nameserver TXT`
followed by `_dmarc.yourdomain.com`. A correct authoritative answer alongside
an old recursive answer points to caching. Existing records can remain cached
for their previous TTL; earlier missing-record answers can also be cached.
There is no universal one-hour propagation deadline.

## The doubled-domain mistake

Some DNS hosts append your domain to the *Name* field. If you enter
`_dmarc.yourdomain.com` where only `_dmarc` is expected, the record can end up at
`_dmarc.yourdomain.com.yourdomain.com`.

Check that name directly:

```sh
dig +short TXT _dmarc.yourdomain.com.yourdomain.com
```

If it returns your record, correct the host according to your provider's
instructions and confirm the answer at `_dmarc.yourdomain.com`.

## Missing policy versus invalid syntax

An unusable policy and a bad report address need different fixes. A checker
may label them differently; inspect the returned TXT value.

| Problem | Effect and fix |
|---|---|
| Wrong version case | `v=dmarc1` is not the required `v=DMARC1`. Correct the value. |
| `v=` not first | `p=none; v=DMARC1` does not start with the version tag. Move `v=DMARC1` first. |
| Literal curly quotes | Typographic quotes copied into the value can break syntax. Use plain text; distinguish literal characters from quotes the DNS tool uses to display a TXT string. |
| Missing scheme in `rua` | `rua=dmarc@yourdomain.com` is not a valid reporting URI. Use `rua=mailto:dmarc@yourdomain.com`; a bad reporting URI does not by itself mean the policy is missing. |

## The subdomain case

If `news.yourdomain.com` has no record at `_dmarc.news.yourdomain.com`, a
receiver can still find an applicable policy at `yourdomain.com`. A checker
that reports only on the exact name may say "not found" while a receiver
applies that policy.

When `yourdomain.com` is the organizational domain, its `sp=` governs existing
subdomains without their own policy, falling back to `p=` when absent.
For a non-existent subdomain, `np=` applies, falling back to `sp=` and then
`p=`. Non-existent means DNS returns `NXDOMAIN` for the domain, not merely
that it lacks an A, MX or `_dmarc` record.

The current specification discovers organizational domains through a **DNS tree
walk**, replacing the older public-suffix-list method. The walk is bounded to
eight queries, so deeply nested names can have intermediate labels skipped.
A record at an intermediate name does not automatically govern everything
below it. Publishing `psd=n` declares that name an organizational domain for
itself and its subdomains; where none of the records establishes a boundary,
the record at the name with the fewest labels determines the organizational
domain. A public-suffix policy can also apply when discovery finds no policy
at the From or organizational domain.

A sending subdomain can inherit a policy even when it has more than eight
labels. For those longer names, discovery checks the full name, then skips
to the ancestor with seven labels; a policy at a skipped ancestor cannot
supply the intended inheritance. Check which policy discovery actually finds. If it does not
supply the settings you need, publish a record at the sending subdomain.
See [what changed in the current DMARC standard](/guides/dmarc-rfc-9989/) for the discovery rules and
[DMARC policy](/glossary/dmarc-policy/) for enforcement choices.

## "Please try a different email" on signup forms

A signup form may impose its own domain checks. If it specifically requires a
DMARC record, publishing a valid one can satisfy that check after cached
answers expire. It cannot guarantee acceptance: the service may also require
an enforcement policy or apply unrelated restrictions. Follow its stated
requirements rather than weakening an existing policy to `p=none`.

## Reports won't arrive if `rua=` is wrong

A working policy does not prove reports can reach you. Confirm that the
mailbox accepts external mail and check filtering or attachment limits.

**External reporting authorization** ([RFC 9990](/rfc/9990/)) is required when
the policy domain and reporting destination have different organizational
domains. Assuming `yourdomain.com` is the organizational domain for both,
`dmarc@mail.yourdomain.com` needs no external authorization for a policy at
`yourdomain.com`. A destination on another organizational domain needs it even
if you own both.

For a policy at `yourdomain.com` requesting reports at
`reports@analyzer.example`, the destination's DNS operator can authorize it
with:

```text
yourdomain.com._report._dmarc.analyzer.example.   TXT   "v=DMARC1"
```

Without authorization, receivers must ignore that external destination; the
policy can still apply, and other valid destinations can still receive
reports. There need not be a notification to the policy publisher. Confirm
that the destination is external before treating the checker's missing
authorization warning as a reporting failure.

Reporting is optional, and delayed or missing reports are not proof that the
policy is absent. When reports arrive for many client domains,
[DMARC Analyzer](/) parses the XML into one self-hosted console without
per-domain pricing.

## What next

Confirm the public answer and applicable policy, then learn to [read the
reports](/guides/how-to-read-a-dmarc-aggregate-report/) before changing
how failing mail should be handled.
