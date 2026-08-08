---
title: How to find your DKIM selector
description: Your DKIM selector is the s= value in a signed message's header. Here is how to find it, what each provider uses, and how to verify the key in DNS.
publishDate: 2026-08-08
---

Your **DKIM selector** is the label that tells a receiver which signing key to
fetch. You cannot list a domain's selectors from DNS, which is why finding one
feels harder than it should be — but a message you have already sent will tell
you the answer exactly.

## Where the selector appears

A selector shows up in two places, and they have to agree.

In every signed message, as the `s=` tag of the `DKIM-Signature` header:

```
DKIM-Signature: v=1; a=rsa-sha256; d=yourdomain.com; s=google; ...
```

And in DNS, as the first label of the record holding the public key:

```
google._domainkey.yourdomain.com
```

The `_domainkey` part is fixed — every DKIM key sits under it. Only the selector
in front of it changes. A receiver reads `s=google` from the header, prepends it
to `_domainkey.yourdomain.com`, and looks up the key there.

## How to find your DKIM selector

Three ways, in descending order of how much you should trust them.

### From a message you have already sent

This is authoritative. Documentation describes what a provider *should* use; the
header records what it *did* use.

Send yourself a message from the domain, then open the raw source — "Show
original" in Gmail, "View source" in Outlook, or the `.eml` file — and find the
`DKIM-Signature` header. The `s=` value is your selector. If the message carries
several `DKIM-Signature` headers, it was signed more than once, and each has its
own selector.

Check `d=` while you are there: it names the signing domain, and it must
[align](/glossary/dmarc-alignment/) with your `From:` domain for
[DMARC](/glossary/dmarc/) to pass. A valid signature under the wrong `d=` is a
DMARC failure.

### From your provider's DNS instructions

The records your provider asked you to publish contain the selector — it is the
label before `._domainkey` in whatever they gave you. If DKIM is set up but you
have lost the paperwork, your DNS zone still has it: look for any record whose
name contains `_domainkey`.

### By probing common selectors

If you have no sent message and no zone access, you are reduced to guessing. Our
[DKIM record checker](/tools/dkim-checker/) tries a list of common selectors
against live DNS and reports which resolve, along with the real key length behind
each.

This is a guess, not an enumeration. `_domainkey` is not a listable zone, so a
selector nobody thought to try stays invisible. It is why every "check if DKIM is
set up" tool asks you for a selector, or quietly probes a list.

## Selectors by provider

Common defaults, as a starting point for a guess — not as the answer. Providers
change them, and many let you choose your own:

| Provider | Selector commonly seen | Record type |
|---|---|---|
| Google Workspace | `google` | `TXT` |
| Microsoft 365 | `selector1`, `selector2` | `CNAME` |
| Amazon SES | three token-named records | `CNAME` |
| SendGrid | `s1`, `s2` | `CNAME` |
| Mailchimp | `k1` | `CNAME` |
| HubSpot | `hs1`, `hs2` | `CNAME` |
| Zendesk | `zendesk1`, `zendesk2` | `CNAME` |
| Klaviyo | `kl`, `kl2` | `CNAME` |

Treat this table as a hint. The `s=` header above beats any of it, and a provider
that changed its default last quarter will not have told you.

## What a selector can be called

A selector is a DNS label, so the rules are DNS's: letters, digits and hyphens,
and it may contain dots to form multiple labels. There is no registry and no
reserved format — `google`, `s1`, `selector2`, `20240115` and
`k1.marketing` are all legal selectors.

That freedom is why guessing works poorly, and why conventions vary so widely:
some providers use a fixed word, some number them for rotation, some use a date,
and some use an opaque token unique to your account.

## Looking a selector up in DNS

Once you know the selector, read the key like any other record:

```
dig +short TXT google._domainkey.yourdomain.com
```

A published key looks like this:

```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
```

- **`v=`** — always `DKIM1`.
- **`k=`** — key type, almost always `rsa`.
- **`p=`** — the public key. An **empty `p=`** is meaningful: it is the documented
  way to revoke a key, not a broken record.

If the provider published a `CNAME` rather than a `TXT`, `dig TXT` still returns
the key — the resolver follows the alias for you. To see the alias itself, ask
for the `CNAME`:

```
dig +short CNAME selector1._domainkey.yourdomain.com
```

## TXT or CNAME

Both are valid, and which you get is the provider's choice:

- A **`TXT`** record holds the key directly. You published it, so you own
  rotating it.
- A **`CNAME`** points at a record the provider controls, letting them rotate the
  key without you touching DNS.

The CNAME approach is why Microsoft 365 asks for two selectors rather than one:
one is live and the other is staged for the next rotation. Both must stay
published permanently — removing the "unused" one breaks the rotation it exists
to enable.

## More than one selector

A domain has as many selectors as it has signers. Your mailbox provider, your
marketing platform and your helpdesk each publish their own, and they do not
conflict, because each names itself in `s=`.

For DMARC, only one signature needs to verify **and** align. A message signed by
three services passes on the strength of whichever signature aligns with the
`From:` domain — the others failing does not matter.

## Rotating a selector

You rotate by publishing a new key under a *new* selector, switching signing to
it, and only then retiring the old one. Keep the old selector published until
every message signed with it has plausibly been delivered and any receiver's
cache has expired — a day is generous, an hour is usually enough.

Never edit a key in place. Between the DNS change propagating and the signer
picking it up, messages get signed with a key that is no longer published, and
they fail.

## When a selector does not resolve

| Symptom | Cause |
|---|---|
| `dkim=none` | No signature at all — signing is not enabled |
| `dkim=permerror` | The selector in `s=` has no matching DNS record |
| `dkim=fail` | Key found, signature did not verify — often a rewritten message |
| `dkim=pass`, DMARC still fails | Signature is valid but `d=` does not align with `From:` |

A missing or wrong selector is one of the most common causes of DKIM not
verifying. If you are chasing one, the
[aggregate reports](/guides/how-to-read-a-dmarc-aggregate-report/) name the
selector every sender used, which turns guessing into reading.

Across a portfolio of client domains that is the only practical way to keep
track — every provider signs with its own selector, they change without telling
you, and nobody emails you when one stops resolving. Watching the selectors that
actually appear in the reports is the job [DMARC Analyzer](/) does, self-hosted,
with no per-domain fee, and it is one part of
[running DMARC for many client domains](/guides/dmarc-multiple-client-domains/).

## What next

If the selector resolves but DMARC still fails, the problem is alignment rather
than the key — see [why your email is failing
DMARC](/guides/fix-dmarc-failure/). For the definition on its own, see
[DKIM selector](/glossary/dkim-selector/); for how DKIM fits beside the other two
records, see [SPF, DKIM & DMARC](/guides/spf-dkim-dmarc/).
