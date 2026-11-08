---
term: MTA-STS
seoTitle: "MTA-STS: enforced TLS for inbound mail"
description: MTA-STS tells sending servers to require verified TLS when they deliver to your domain, closing a downgrade-attack gap SPF, DKIM, and DMARC leave open.
aliases: ["MTA-STS record", "SMTP MTA Strict Transport Security"]
related: ["dmarc", "spf", "dkim", "tls-rpt"]
---

**MTA-STS** (SMTP MTA Strict Transport Security, [RFC 8461](/rfc/8461/)) tells
other mail servers that
they **must** use an encrypted, authenticated **TLS** connection when delivering
mail to your domain — and refuse to deliver if they can't. It closes a gap the
authentication standards leave open.

Where [SPF](/glossary/spf/), [DKIM](/glossary/dkim/), and [DMARC](/glossary/dmarc/)
verify *who sent* a message, MTA-STS protects *how it travels*: without it, an
attacker can strip the `STARTTLS` upgrade and force mail to be sent in plaintext
(a downgrade attack). MTA-STS makes the *sending* server refuse that fallback: you
publish the policy, and the other side is the one that enforces it by declining to
deliver over a connection it can't secure. A server that hasn't implemented
MTA-STS never looks for your policy and delivers exactly as it did before, so the
protection you get is the protection your senders have built. And protection
begins only once a sender holds your policy: block its very first fetch and it
has never heard of you. Caching is what closes that window, which is why senders
hold a policy for weeks rather than fetching one per message.

Note the direction: MTA-STS protects mail **arriving at** your domain. It says
nothing about mail you send — that's governed by the recipient's policy.

## How it's set up

Two pieces, and both must be present:

**1. A policy file** served over HTTPS at
`https://mta-sts.yourdomain.com/.well-known/mta-sts.txt`:

```
version: STSv1
mode: enforce
mx: mail.yourdomain.com
mx: *.yourdomain.com
max_age: 604800
```

**2. A `TXT` record** at `_mta-sts.yourdomain.com` announcing it:

```
v=STSv1; id=20260101000000
```

Bump the `id` whenever you change the policy — that's the only signal telling
servers to refetch it. Leave it unchanged and your edit may go unnoticed for
`max_age` seconds.

The HTTPS endpoint is the expensive half: a certificate-managed web host per
domain, serving four lines of text. [DMARC Analyzer](/) can serve that file for
the domains you monitor: enable hosting, write the domain's policy, and
publishing it is a CNAME and a TXT record — see [hosting MTA-STS
policies](/docs/mta-sts-hosting/).

## The three modes

| Mode | Effect |
|---|---|
| `testing` | Mail is delivered as normal; failures are reported to you, if you publish TLS-RPT |
| `enforce` | Delivery is refused if TLS can't be validated |
| `none` | Senders treat your domain as having no policy at all |

Publish [TLS-RPT](/glossary/tls-rpt/) first, start in `testing`, watch the
reports, then move to
`enforce`. The pattern mirrors `p=none` → `p=reject` in DMARC, and for the same
reason: you want to discover breakage from a report, not from missing mail. The
order matters, because a sender reports a `testing` failure only if it has
implemented TLS-RPT *and* you have published a record giving it somewhere to send
the report — without that record, `testing` is silent and you learn nothing from
it.

`none` is the first step out, not the whole of it, and deleting the records is
not how you leave: a sender holding a valid cached policy has to keep applying it
even once the TXT record and the policy file are gone. Publish `mode: none` with
a short `max_age`, bump the `id`, wait out the longest `max_age` you previously
served, and only then remove the records.

## Requirements that catch people out

- **The `mta-sts` subdomain needs a valid HTTPS certificate.** The whole scheme
  rests on that TLS connection, and an expired cert on the policy host breaks it
  two ways at once: senders that already hold your policy go on applying it until
  `max_age` runs out, while senders that don't have one deliver as though you had
  never published. Publish TLS-RPT and the failed fetches come back to you from
  the senders that implement it.
- **Every MX host that actually receives your mail must be covered by an `mx`
  pattern.** The requirement runs that way round: the policy lists the hosts
  senders are *allowed* to use, so naming one you haven't cut over to yet is
  fine, while a live MX the policy misses is one senders refuse under `enforce`.
  The certificate each of those hosts presents must match its name too.
- **`max_age` is a caching commitment.** A long value (a week is typical) means
  senders keep enforcing an old policy after you change hosts — lower it *before*
  a migration, not during.

## Pair it with TLS-RPT

Add a [**TLS-RPT**](/glossary/tls-rpt/) record at `_smtp._tls.yourdomain.com` to
receive reports about TLS delivery failures:

```
v=TLSRPTv1; rua=mailto:tls-reports@yourdomain.com
```

It plays the same role for transport that [DMARC aggregate
reports](/glossary/dmarc-aggregate-report/) play for authentication: without it,
`enforce` mode fails silently and you learn about it from the sender.

## MTA-STS vs DANE

Both force authenticated TLS. **DANE** ([RFC 7672](/rfc/7672/)) publishes
in DNS the certificate or public key your mail hosts will present — in full or
as a hash — and depends on DNSSEC; **MTA-STS** uses the public web PKI and HTTPS instead,
which is why it's far easier to deploy on domains without DNSSEC. They can
coexist, and large providers support one, the other, or both.

MTA-STS and TLS-RPT are the natural next step after your domain reaches DMARC
enforcement — the authentication story is finished, so you move on to the
transport one. [MTA-STS: from testing to
enforce](/guides/mta-sts-testing-to-enforce/) walks through the rollout.
