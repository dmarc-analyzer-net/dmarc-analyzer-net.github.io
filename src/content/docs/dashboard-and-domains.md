---
title: Dashboard and domain list
description: What the four dashboard cards actually count, what "Needs attention" means, and how to read the domain list — including what an em dash is telling you.
section: Using the console
order: 2
publishDate: 2026-07-27
---

## The dashboard

Four cards summarise the [current window](/docs/using-the-console/#how-the-time-windows-work)
across every domain you can see:

- **Domains monitored** — domains with at least one report in the window.
- **DMARC compliance** — the share of messages that passed
  [aligned](/glossary/dmarc-alignment/) SPF or DKIM, across all of them.
- **Messages analyzed** — total message volume the reports describe.
- **Spoofing blocked** — messages that receivers **quarantined or rejected**,
  taken from the disposition field of the reports. This counts enforcement
  actually happening, so it stays at zero while every domain is still at
  `p=none` — which is correct, if uncomfortable: nothing is being blocked yet.
  The red badge on the card counts distinct failing sources.

**Messages by day** plots passing against failing volume for the window.

**Needs attention** lists the domains below the compliance target, worst first —
the same 98% line that separates *Monitoring* from *Spoofing* in the [status
vocabulary](/docs/using-the-console/#the-status-vocabulary). When it's empty the
card says so. This list is the day's work queue: each entry links to the
domain's [drill-down](/docs/domain-detail/).

## The domain list

Every monitored domain, one row each, with the columns sortable: domain,
published policy, compliance, messages, and status. The default sort is
compliance ascending — problems first.

Filter by free text ("Filter by domain or client…"), by client, or by published
policy (`p=reject`, `p=quarantine`, `p=none`).

### When the policy column shows —

An em dash in the policy column means one of four different things, and the
tooltip on the dash says which:

| Tooltip | What to do |
|---|---|
| *No DMARC record is published in DNS for this domain* | Publish one — see [your first DMARC record](/guides/publish-your-first-dmarc-record/) |
| *A DMARC record is published but names no policy* | The record is malformed; `p=` is required |
| *The last DNS lookup for this domain failed* | Check the domain resolves; the lookup retries on the next background pass |
| *This domain has not been checked yet* | Wait for the next DNS pass (roughly six-hourly), or open the domain to trigger a live check |

### Adding domains — and why some appear on their own

**Add domain** registers a domain and assigns it to a client. But ingestion also
creates domains automatically: when a report arrives for a domain nobody has
registered, it is created under the **default client of the mailbox source**
that received it. For an agency that matters — pre-create a client's domains
before connecting their reports, or new ones will quietly file under the wrong
client until you reassign them (edit the domain and change its client).
Domain names are globally unique across clients, so a domain can only ever
belong to one.
