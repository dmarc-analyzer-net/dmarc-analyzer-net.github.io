---
title: "MTA-STS: from testing to enforce"
description: Roll out MTA-STS without losing mail — publish TLS-RPT first, cover every MX, and let the reports tell you when enforce is actually safe.
publishDate: 2026-08-07
---

Once a domain reaches [DMARC enforcement](/guides/from-monitoring-to-enforcement/),
the authentication story is finished: you know who is allowed to send as you, and
receivers reject everyone else. What that says nothing about is how the mail
*travelled*.

[MTA-STS](/glossary/mta-sts/) closes that gap. It tells sending servers they must
use a verified TLS connection to reach you, and refuse to deliver if they can't —
which shuts down the downgrade attack where someone strips `STARTTLS` and reads
your mail in plaintext.

It also, if you get it wrong, tells the entire internet to stop delivering your
mail. So it is rolled out in stages, the same way and for the same reason as
`p=none` → `p=reject`.

## Stage 0 — Publish TLS-RPT first

Do this before you publish any MTA-STS policy at all.

[TLS-RPT](/glossary/tls-rpt/) is the feedback channel. Add a TXT record at
`_smtp._tls.yourdomain.com`:

```
v=TLSRPTv1; rua=mailto:tls-reports@yourdomain.com
```

Without it, `testing` mode is silent — and a silent testing period teaches you
nothing. You would sit at `testing` for a month, learn nothing, flip to
`enforce`, and find out what was wrong from a customer.

Reports arrive daily from the large providers, so give this a week on its own
before moving on. You will also discover something useful straight away: whether
your current TLS setup is already failing for someone.

> **Not every sender reports.** Google, Microsoft and other large providers do.
> A small domain that mostly receives mail from small senders may never get a
> single report. That is normal, and it changes the rollout — see
> [When no reports ever arrive](#when-no-reports-ever-arrive).

## Stage 1 — Inventory every MX

The policy lists the mail hosts allowed to receive your mail. Miss one and, under
`enforce`, mail routed to it is refused.

Look up the domain's live MX records and account for **all** of them:

- Backup and secondary MX hosts, including the one nobody has thought about since
  it was set up.
- Filtering and security gateways that sit in front of your mailboxes.
- Anything a third party added on your behalf.

Then check the other half, which is the one people miss: **each of those hosts
must present a certificate that actually matches its name.** A backup MX serving
a certificate for a different hostname passes today and fails the moment you
enforce.

Wildcards help here — `*.yourdomain.com` covers one label, so `mail.yourdomain.com`
matches but `mx.eu.yourdomain.com` does not.

## Stage 2 — Publish in testing

Now publish the policy in `testing` mode. Failures get reported; mail still gets
delivered. Nothing can break.

```
version: STSv1
mode: testing
mx: mail.yourdomain.com
mx: *.yourdomain.com
max_age: 604800
```

Serve it over HTTPS at `https://mta-sts.yourdomain.com/.well-known/mta-sts.txt`,
and announce it with a TXT record at `_mta-sts.yourdomain.com`:

```
v=STSv1; id=20260807120000
```

Two things routinely go wrong at this step:

**The `mta-sts` subdomain needs its own valid certificate.** The whole scheme
rests on that HTTPS connection. An expired certificate on the policy host
silently invalidates your policy — senders can't fetch it, so they fall back to
behaving as if you have none.

**The id is the only refetch signal.** Change the policy and leave the id alone,
and senders keep using the cached old one until `max_age` runs out. Bump it every
single time.

Standing up a certificate-managed web host per domain is the part that stops most
fleets, especially anyone running domains for clients. Self-hosted
[DMARC Analyzer](/) serves the policy files itself, so onboarding a domain is one
CNAME plus one TXT record — see [hosting MTA-STS
policies](/docs/mta-sts-hosting/).

## Stage 3 — Read the reports

Give it at least two weeks. You are looking for one specific thing among the
failures, because the categories are not equally your problem:

| What you see | What it means |
|---|---|
| **Policy fetch failed / policy invalid** | **Stop.** Senders can't read your policy. Fix before enforcing |
| **Certificate validation failed** | **Stop.** A receiving host is presenting a certificate that doesn't validate |
| **`STARTTLS` not supported** | A receiving host isn't offering TLS at all. Fix it — enforcing will refuse mail to it |
| **DANE / TLSA / DNSSEC errors** | Only relevant if you publish DANE. Doesn't block MTA-STS |

Group failures by **receiving MX host** rather than reading the totals. One
misconfigured server in a pool of five is invisible in an aggregate success rate
and obvious the moment you split by host.

The bar for moving on: **two weeks with zero policy-fetch, policy-validity or
certificate-validation failures.** Not "mostly clean" — those three categories
are precisely the ones that turn into refused mail under `enforce`.

### When no reports ever arrive

If two weeks produce no reports at all, you have no evidence either way. Waiting
longer for reports that are never coming is not caution, it is just delay.

Instead, lean on time and on outside-in checks: sit at `testing` for around four
weeks, and confirm throughout that the record is valid, the policy is fetchable
over good TLS, and every live MX is covered by a pattern. Green on all of those
for a month, with no contrary evidence, is a reasonable basis to proceed.

## Stage 4 — Enforce

Change one word:

```
mode: enforce
```

Bump the id. Publish the new TXT value. That's the whole change.

Keep watching the reports for the first week — this is when a sender you'd never
heard from surfaces a host you missed. Backing out is fast: set `mode: testing`
again and bump the id. Senders that have already cached the enforcing policy will
honour it until `max_age` expires, which is the real reason to be sure before you
flip, and a good argument for a shorter `max_age` early on.

## The `max_age` trap

`max_age` is a commitment, not a preference. Senders cache your policy for that
long, and a week is typical.

Which means: **lower it before you change mail hosts, not during.** If you migrate
with `max_age: 604800` still published, senders spend up to a week enforcing a
policy that lists MX hosts you no longer use. Drop it to a few hours, wait out the
old value, migrate, then raise it again.

## Retiring MTA-STS

Don't just delete the records. Senders holding a cached enforcing policy will keep
enforcing it and start failing delivery to a host they can no longer verify.

Publish `mode: none`, bump the id, and wait out `max_age`. Then remove the records.

## The short version

1. TLS-RPT first — a week on its own.
2. Inventory every MX, including backups and gateways, and check their certificates.
3. `testing` for two weeks minimum, or about four with no reports.
4. Zero fetch, validity or certificate failures — then `enforce`.
5. Bump the id on every change, and lower `max_age` before any migration.
