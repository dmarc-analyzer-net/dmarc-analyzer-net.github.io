---
term: MTA-STS
seoTitle: "MTA-STS: enforced TLS for inbound mail"
description: MTA-STS lets your domain request authenticated TLS for inbound mail. Learn how its DNS record, HTTPS policy, modes and caching work with supporting senders.
aliases: ["MTA-STS record", "SMTP MTA Strict Transport Security"]
related: ["dmarc", "spf", "dkim", "tls-rpt"]
---

**MTA-STS** (SMTP MTA Strict Transport Security, [RFC 8461](/rfc/8461/)) lets
your domain publish a policy requiring authenticated TLS for inbound mail.
A supporting sender with a valid cached `enforce` policy must use an allowed
MX host over a validated TLS connection, or withhold delivery to that host.

SPF, DKIM and [DMARC](/glossary/dmarc/) authenticate sending identities;
MTA-STS protects the SMTP connection. Without a transport-security policy, an
attacker can strip the `STARTTLS` upgrade and cause an opportunistic-TLS sender
to fall back to plaintext. MTA-STS protects against that fallback once the
sender holds an enforcing policy. It does not encrypt the message end to end
or protect its contents after delivery.

A sender without MTA-STS support ignores your policy. Even a supporting sender
has a first-fetch gap: an attacker who prevents initial policy discovery can
leave it using ordinary opportunistic TLS. Cached policies and proactive
refreshes reduce that exposure; they do not eliminate it.

MTA-STS protects mail **arriving at** your domain. Your outbound mail is governed
by the recipient's policy and your sending server's support. Mailbox subdomains
need their own policy: a sender delivering to `user@news.yourdomain.com` does
not inherit the policy for `yourdomain.com`.

## How it's set up

Two pieces announce and authenticate the policy:

**1. A policy file** served over HTTPS at
`https://mta-sts.yourdomain.com/.well-known/mta-sts.txt`:

```text
version: STSv1
mode: testing
mx: mail.yourdomain.com
max_age: 604800
```

Replace the `mx` value with your actual mail exchanger's hostname. Use one
`mx:` line per hostname or allowed wildcard pattern, including backup MX hosts.
The endpoint must return HTTP **200**; senders do not follow redirects.
Serve the file as `text/plain`.

**2. A `TXT` record** at `_mta-sts.yourdomain.com` announcing it:

```text
v=STSv1; id=20260101000000
```

When editing a policy, publish the HTTPS file, then fetch
`https://mta-sts.yourdomain.com/.well-known/mta-sts.txt` and confirm it returns
the updated policy **before** changing the TXT `id`. Use a new ID for each
revision. Senders can use that change to discover an update without waiting for
cache expiry, but DNS caching still delays visibility.
They should also refresh proactively before expiry; an unchanged ID does not
forbid a refetch. Keep old policies compatible with delivery during the change.

Across many client domains, each policy hostname still needs a valid HTTPS
certificate. [DMARC Analyzer](/) can serve the policy files from your own
instance: configure the reverse proxy and TLS, create each domain's policy,
and publish its CNAME and TXT records. See [hosting MTA-STS
policies](/docs/mta-sts-hosting/).

## The three modes

| Mode | Effect for a sender applying the policy |
|---|---|
| `testing` | MTA-STS validation failures do not require withholding delivery; TLS-RPT senders can report them |
| `enforce` | Do not deliver to an MX that fails hostname matching, STARTTLS support or certificate validation |
| `none` | Treat the domain as having no active MTA-STS policy |

`testing` does not guarantee delivery: other SMTP or security failures can
still stop it. Under `enforce`, a sender can try another eligible MX. If none
works, it should queue and retry, and must check for a policy update before
permanently failing delivery.

Publish [TLS-RPT](/glossary/tls-rpt/) first, start in `testing`, and investigate
failures before moving to `enforce`. Reports come only from senders that
implement reporting and have found a valid reporting destination. Missing
reports do not prove the configuration is sound; test backup MX hosts too,
since ordinary traffic may never reach them.

To retire MTA-STS, publish `mode: none` with a short `max_age`, then bump the
`id`. Keep the TXT record and HTTPS endpoint until **all previously served
policies have expired**, accounting for each policy's last-served time and
`max_age`. Deleting them first does not cancel an unexpired cached policy.

## Requirements that catch people out

- **The policy host and MX hosts need valid certificates.** The HTTPS
  certificate must cover `mta-sts.yourdomain.com`. Each receiving mail server
  needs an unexpired certificate with a trusted chain and a DNS subject
  alternative name matching its MX hostname. An expired policy-host certificate
  prevents a new fetch; senders with an unexpired cached policy continue using
  it, while those without one proceed as though MTA-STS were absent.
- **An `mx` pattern authorizes a hostname.** You can list a future mail host
  before changing DNS. Cover every MX you intend senders to use, including
  backups. `*.yourdomain.com` matches `mail.yourdomain.com`, but neither
  `yourdomain.com` nor `mx.eu.yourdomain.com`.
- **`max_age` is a caching commitment.** The example's `604800` is seven days
  from fetch, not a DNS TTL. Stable policies are expected to use weeks or more.
  Before a migration, authorize the new hosts while keeping the old ones
  working. Lowering `max_age` does not shorten policies already cached with a
  longer lifetime; allow those to expire before relying on the shorter value.

## Pair it with TLS-RPT

Add a TLS-RPT record at `_smtp._tls.yourdomain.com` to request transport-security
reports:

```text
v=TLSRPTv1; rua=mailto:tls-reports@yourdomain.com
```

Use a mailbox or reporting service that can receive and process them. Like
[DMARC aggregate reports](/glossary/dmarc-aggregate-report/), these reports
cover participating senders, not every delivery. They can expose failed policy
fetches, MX mismatches and TLS failures, but their absence is not evidence that
mail arrived. MTA-STS enforcement does not depend on publishing TLS-RPT.

## MTA-STS vs DANE

Both can require authenticated TLS from supporting senders. **DANE**
([RFC 7672](/rfc/7672/)) authenticates mail servers through DNSSEC-protected
TLSA records identifying acceptable certificates or public keys. MTA-STS uses
HTTPS and the public certificate-authority system, without requiring DNSSEC,
but retains the first-fetch gap. They can coexist; a sender must not use a
successful MTA-STS check to override a failed DANE validation.

Transport security is independent of DMARC enforcement: you can deploy it
while still monitoring authentication. [MTA-STS: from testing to
enforce](/guides/mta-sts-testing-to-enforce/) covers the rollout.
