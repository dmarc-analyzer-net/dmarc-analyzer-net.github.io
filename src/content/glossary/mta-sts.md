---
term: MTA-STS
description: MTA-STS forces mail sent to your domain to use encrypted TLS, closing a downgrade-attack gap that SPF, DKIM, and DMARC don't address.
aliases: ["MTA-STS record", "SMTP MTA Strict Transport Security"]
related: ["dmarc", "spf", "dkim"]
---

**MTA-STS** (SMTP MTA Strict Transport Security) tells other mail servers that
they **must** use an encrypted, authenticated **TLS** connection when delivering
mail to your domain — and refuse to deliver if they can't. It closes a gap the
authentication standards leave open.

Where [SPF](/glossary/spf/), [DKIM](/glossary/dkim/), and [DMARC](/glossary/dmarc/)
verify *who sent* a message, MTA-STS protects *how it travels*: without it, an
attacker can strip the `STARTTLS` upgrade and force mail to be sent in plaintext
(a downgrade attack). MTA-STS makes receivers reject that fallback.

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

## The three modes

| Mode | Effect |
|---|---|
| `testing` | Failures are reported but mail is still delivered |
| `enforce` | Delivery is refused if TLS can't be validated |
| `none` | Policy is withdrawn — use this to retire MTA-STS cleanly |

Start in `testing`, watch the reports, then move to `enforce`. The pattern
mirrors `p=none` → `p=reject` in DMARC, and for the same reason: you want to
discover breakage from a report, not from missing mail.

## Requirements that catch people out

- **The `mta-sts` subdomain needs a valid HTTPS certificate.** The whole scheme
  rests on that TLS connection, so an expired cert on a static policy file
  silently invalidates your policy.
- **Every `mx` in the policy must match your real MX records**, and the
  certificate presented by those mail hosts must match too.
- **`max_age` is a caching commitment.** A long value (a week is typical) means
  senders keep enforcing an old policy after you change hosts — lower it *before*
  a migration, not during.

## Pair it with TLS-RPT

Add a **TLS-RPT** record at `_smtp._tls.yourdomain.com` to receive reports about
TLS delivery failures:

```
v=TLSRPTv1; rua=mailto:tls-reports@yourdomain.com
```

It plays the same role for transport that [DMARC aggregate
reports](/glossary/dmarc-aggregate-report/) play for authentication: without it,
`enforce` mode fails silently and you learn about it from the sender.

## MTA-STS vs DANE

Both force authenticated TLS. **DANE** publishes certificate fingerprints in DNS
and depends on DNSSEC; **MTA-STS** uses the public web PKI and HTTPS instead,
which is why it's far easier to deploy on domains without DNSSEC. They can
coexist, and large providers support one, the other, or both.

MTA-STS and TLS-RPT are the natural next step after your domain reaches DMARC
enforcement — the authentication story is finished, so you move on to the
transport one.
