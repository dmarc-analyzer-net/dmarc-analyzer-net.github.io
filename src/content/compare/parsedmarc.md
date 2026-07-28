---
title: "parsedmarc alternative: one container, multi-tenant"
seoTitle: 'parsedmarc alternative: one container'
competitor: parsedmarc
description: A parsedmarc alternative that's also open source and self-hosted — a multi-tenant app in one container, rather than a parser you wire to your own stack.
publishDate: 2026-07-23
updatedDate: 2026-07-27
---

parsedmarc is the best-known open-source DMARC tool, and a genuinely good one: a
mature report parser with a wide choice of outputs — OpenSearch, Splunk,
PostgreSQL, Kafka, S3, Microsoft Sentinel, Graylog, syslog or a webhook — and it
parses more report types than we do. The difference is shape. parsedmarc is a
pipeline component you point at a data store of your choosing; DMARC Analyzer is
a finished multi-tenant application that ships as a **single container** backed
by PostgreSQL, with the console included.

## Side by side

*parsedmarc's capabilities as documented in July 2026.*

| | DMARC Analyzer | parsedmarc |
|---|---|---|
| Open source | Yes (Apache-2.0) | Yes (Apache-2.0) |
| [Self-hosted](/docs/install/); your data stays yours | Yes | Yes |
| What you actually run | [One container + PostgreSQL](/docs/install/) | A parser, plus whichever store and dashboard stack you choose |
| Dashboards | Built into the app | Prebuilt Kibana and Grafana dashboards you import into your own stack |
| Aggregate (RUA) reports | Yes | Yes |
| Forensic (RUF) reports | — | Yes |
| SMTP TLS (TLS-RPT) reports | — | Yes |
| Multi-tenant (many client domains) | Yes, per-client scoping | Not designed for it |
| Kubernetes | Maintained Helm chart | No official chart as of July 2026 |
| Maturity | Young project | Long-established, large community |
| Getting started | `docker compose up` | `pip install`, then choose and run a storage backend |

## Where parsedmarc fits

If you want a scriptable parser to feed a data pipeline you already run, or you
need **forensic (RUF) or [TLS-RPT](/glossary/tls-rpt/) reports**, parsedmarc is the better tool — we
handle aggregate reports only. It is also flexible about where data lands, and
has years of production use behind it.

## Where DMARC Analyzer fits

If you want [dashboards](/guides/how-to-read-a-dmarc-aggregate-report/) and
[agency multi-tenancy](/guides/dmarc-multiple-client-domains/) as a finished application rather than
components to assemble, DMARC Analyzer gives you the open-source, self-hosted
model with one container to run. Per-client scoping is the substantive
difference: parsedmarc is not built to keep many clients' data separate.

Both keep every [aggregate report](/glossary/dmarc-aggregate-report/) on your own
infrastructure — the shared reason to choose open source in the first place.

## Already running parsedmarc?

Then the question isn't which is better in the abstract, it's what a move costs.
[Migrating from parsedmarc](/parsedmarc-alternative/) covers the mechanics: your
mailbox is the migration path, the first sync reads all of it, and ingestion
never modifies the mailbox — so you can run both against the same reports for as
long as you like before deciding.
