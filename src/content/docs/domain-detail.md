---
title: Domain detail and enforcement
description: The per-domain drill-down — record inspection, the path-to-enforcement recommendation, and how to diagnose a failing source from its raw authentication results.
section: Using the console
order: 3
publishDate: 2026-07-27
updatedDate: 2026-07-28
---

Open any domain from the list or the dashboard and you get the drill-down —
the screen where DMARC problems actually get diagnosed. Top to bottom:

## The stat row

Messages in the window, compliance, **DKIM pass rate**, **SPF pass rate**,
distinct sending sources, and distinct reporters. The two pass rates are *raw*
authentication results — a high SPF pass rate with low compliance is the classic
[alignment problem](/guides/fix-dmarc-failure/), not a contradiction.

## Record inspection

The domain's DMARC record from two vantage points: what a **live DNS lookup**
returns right now, and what reporting receivers **observed** when they evaluated
your mail. The *Published vs observed* comparison works tag by tag, and each row
gets one of four states — only one of which is a finding:

| State | Meaning |
|---|---|
| match | Published and observed agree |
| **differs** | A receiver saw something else — stale DNS, a second record, or a recent edit still propagating |
| inherited | You didn't publish the tag, so the receiver used [its default](/guides/dmarc-record-tags/). Nothing to disagree with |
| not_reported | Published, but the reporter didn't echo a value for it |

The panel also inspects the SPF record — including its DNS lookup count against
the [limit of 10](/guides/spf-record-syntax/) — and flags record-level issues,
such as a published `sp=` weaker than `p=`. The timestamp shows when DNS was
last checked; the background pass refreshes roughly every six hours.

## Path to enforcement

The recommendation panel reads the window's data and answers one question:
**is this domain ready for its next policy step?**

- **Green** — the recommended action, with nothing blocking it.
- **Amber** — not yet, with the top five **blocking sources**: senders whose
  failing volume would be quarantined or rejected if you tightened the policy
  today. Each one is clickable and expands that source in the table below.

Treat the blocking list as a to-do list, not a veto: some entries are senders to
fix ([DKIM alignment, envelope domains](/guides/fix-dmarc-failure/)), some are
forwarders you will never fix and should knowingly accept. The staged rollout
itself — including why you should *not* ramp `p=reject` with `pct=` — is covered
in [from monitoring to enforcement](/guides/from-monitoring-to-enforcement/).

## Sending sources

Every IP that sent mail claiming to be this domain, sortable by source IP,
messages, compliance, reporters and last seen. Expanding a row is where the
real diagnosis happens — for that source you get:

- **DMARC evaluation** — the aligned verdict receivers acted on.
- **Raw DKIM authentication** and **raw SPF authentication** — what actually
  passed, and for *which domain*. This is the pair that answers "SPF passes,
  DMARC fails": the raw pass was for the ESP's envelope domain, not yours.
- **Header from / envelope from** — the two identities side by side.
- **Reporters** and a **daily volume** chart for the source.

Hostnames next to IPs come from reverse DNS (PTR) lookups the server makes on
demand, batched for the sources on screen — an unresolved name usually means the
IP has no PTR record, which is itself a signal. Reading the same evidence in the raw XML is covered in [how to read an
aggregate report](/guides/how-to-read-a-dmarc-aggregate-report/).

## Transport security

Below the sources, the **Transport security** card covers the other half of the
story — whether mail to this domain travels encrypted. It holds the
[MTA-STS](/glossary/mta-sts/) monitoring checks, the hosted policy if this
instance serves one, [TLS-RPT](/glossary/tls-rpt/) failure reporting, and the
gate that says when enforcement is safe. See [transport
security](/docs/transport-security/).
