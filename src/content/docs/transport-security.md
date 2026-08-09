---
title: Transport security
seoTitle: MTA-STS and TLS-RPT in the console
description: Read the per-domain MTA-STS and TLS-RPT panel — what the monitoring checks mean, how TLS failures are grouped, and when it is safe to enforce.
section: Using the console
order: 7
---

Where [DMARC](/glossary/dmarc/) tells you *who* sent a message, transport
security tells you *how it travelled*. The **Transport security** card on the
[domain detail page](/docs/domain-detail/) covers both halves of that story:
[MTA-STS](/glossary/mta-sts/) ([RFC 8461](/rfc/8461/)), which asks senders to
require verified TLS, and
[TLS-RPT](/glossary/tls-rpt/), which reports back on whether they could.

The card appears for every domain. Monitoring needs no configuration and runs
whether the policy is hosted here or somewhere else entirely — a domain with no
MTA-STS at all just shows a quiet "not configured" line.

## MTA-STS monitoring

A background pass checks each domain roughly every six hours, from the outside
in, exactly as a sending mail server would:

| Check | What it means |
|---|---|
| **TXT record** | `_mta-sts.yourdomain.com` publishes exactly one valid `v=STSv1` record. Two records, or a malformed one, reads as `invalid` — senders treat that as no policy at all |
| **Policy fetch** | The file at `https://mta-sts.yourdomain.com/.well-known/mta-sts.txt` was retrieved over a valid TLS connection. A redirect counts as a failure; the spec does not allow one |
| **Policy valid** | The body parses, and the mode, `max_age` and `mx` entries are all well-formed |
| **MX coverage** | Every live MX record for the domain matches at least one `mx` pattern in the policy. This is the check that predicts broken delivery |

The card shows the mode as a badge, the current policy id, `max_age`, and the
policy body itself. If a lookup or fetch fails, the last known-good result stays
on screen with a "last verified" timestamp rather than blanking out — a resolver
hiccup shouldn't look like a withdrawn policy.

**Recheck now** (agency staff) runs all of it immediately and queries the
domain's authoritative nameserver directly, bypassing every DNS cache in
between. A record you published a moment ago shows up straight away.

### Alerts

Three rules fire from this state, and the severity scales with how much bite the
policy has — anything broken under `enforce` is critical, because that is when
mail actually stops:

- **Policy changed** — the id moved. Informational; useful for spotting an
  unannounced change on a domain you don't administer.
- **MTA-STS broken** — the record is invalid, the fetch failed, or the policy
  doesn't parse.
- **MX mismatch** — a live MX host isn't covered by the policy.

See [alerts and notifications](/docs/alerts-and-notifications/) for routing.

## Hosted policy

If this instance serves the domain's policy, a **Hosted policy** section appears
with the mode, `mx` patterns, id, and copy-ready publish instructions. Admins get
the editor; everyone else sees the current state. The two states that look
similar are worth distinguishing:

- **Hosting off** — settings kept, the policy URL answers 404.
- **No policy** — nothing hosted here. The domain may still publish MTA-STS
  elsewhere, and monitoring above will report on it either way.

Setting one up is covered in [hosting MTA-STS
policies](/docs/mta-sts-hosting/).

## TLS-RPT

TLS reports arriving in your [reporting mailboxes](/docs/mailbox-setup/) are
parsed and stored alongside DMARC aggregate reports — no extra configuration,
though the domain does need a `_smtp._tls` TXT record pointing at the mailbox
before any reporter will send them.

The panel shows successful and failed sessions for the selected window, then
breaks the failures down. Grouping is the useful part, because the categories
mean very different things:

| Category | Cause | Your problem? |
|---|---|---|
| **STS** | Policy fetch failed, policy invalid, or certificate validation failed | **Yes** — this is what blocks enforcement |
| **DANE** | DNSSEC or TLSA record problems | Only if you publish DANE |
| **Transport** | `STARTTLS` unsupported, certificate expired or mismatched | Usually the receiving host — check it |
| **Other** | Anything the reporter sent that doesn't map above | Read the raw result type |

Below that, failures are listed by raw result type and by receiving MX host, so
a single misconfigured server in a pool is visible rather than averaged away.

An empty panel is normal and is not an error. Plenty of domains never attract a
reporting sender; the gate below accounts for that.

## The enforcement gate

Moving a policy from `testing` to `enforce` is the one step here that can stop
real mail. The card tells you when the evidence supports it, and shows one of
four states:

| State | Meaning |
|---|---|
| **Ready** | Checks are green and the evidence backs it. A Promote button appears |
| **Not ready** | Something concrete is wrong — a named failing check, or STS-category failures in the window |
| **Insufficient data** | Nothing is wrong, there just isn't enough history yet. Shows how many days remain |
| **Not applicable** | Already enforcing, or nothing hosted here to promote |

Two paths reach **ready**, because waiting for reports that may never arrive
would make the gate useless:

- **With TLS-RPT evidence** — at least 14 days in `testing` and no STS-category
  failures in the last 14 days.
- **Without any reports at all** — at least 28 days in `testing` with every
  monitoring check green.

Transport- and DANE-category failures never block promotion. They are receiving-
side problems that `enforce` mode does not change.

A newly created policy reads as **insufficient data**, not as failing. Until the
first successful fetch, the app treats the domain as still being set up rather
than broken — the two look identical in the raw checks but mean opposite things.

Promoting writes an audit event, and because the policy content changes, the id
moves too — so publish the new TXT value the console shows.

The staged rollout, and what to actually watch during it, is walked through in
[MTA-STS: from testing to enforce](/guides/mta-sts-testing-to-enforce/).
