---
title: "Best open-source & self-hosted DMARC analyzers"
seoTitle: 'Best open-source DMARC analyzers'
competitor: Open source & self-hosted
roundup: true
description: The open-source, self-hosted DMARC analyzers worth knowing — parsedmarc, DMARC Analyzer, and lighter-weight projects — compared on setup, dashboards, and scale.
publishDate: 2026-07-23
---

If you'd rather **not** send your DMARC report data to a vendor's cloud, the
open-source, self-hosted route keeps everything on your own infrastructure — and
avoids per-domain pricing entirely. The options split cleanly into "powerful but
heavy" and "so light it keeps no history."

> Full disclosure: **DMARC Analyzer** (this project) is one of the options
> below. We've described the others accurately and where they fit best.

## Why self-host

- **Data sovereignty** — [aggregate reports](/glossary/dmarc-aggregate-report/)
  reveal your sending infrastructure; self-hosting keeps that in-house.
- **No per-domain / per-volume fees** — run [unlimited domains for
  free](/free-dmarc-analyzer/).
- **Auditability** — open source you can read, modify, and trust.

## The options

| Tool | Language | What you run | Dashboards | Multi-tenant |
|---|---|---|---|---|
| **DMARC Analyzer** | .NET + React | One container + PostgreSQL | Built in | Yes (per client) |
| parsedmarc | Python | Parser + Elasticsearch/OpenSearch + Kibana/Grafana | Via Kibana/Grafana | No |
| dmarc-report-viewer | Rust | One ~10 MB container or a single binary — no database | Built in | No |
| Other lightweight viewers | Go / PHP | A single small service + SQLite/MySQL | Basic, built in | Usually no |

- **[parsedmarc](/compare/parsedmarc/)** — the most established. A flexible parser
  with rich outputs, but dashboards mean standing up and maintaining a search
  stack (Elasticsearch/OpenSearch + Kibana/Grafana). Best if you already run one
  or want a CLI parser for your own pipeline.
- **DMARC Analyzer** — open source and self-hosted like parsedmarc, but ships as
  a single container with PostgreSQL and dashboards built in, plus per-client
  multi-tenancy for agencies. Turnkey, without a search cluster to babysit.
- **dmarc-report-viewer** — the smallest credible option: a single Rust binary or
  a ~10 MB container with an IMAP client built in and no database at all. It also
  reads SMTP TLS (TLS-RPT) reports, which most DMARC tools including this one
  don't. The trade-off is that it keeps everything in memory and re-reads the
  mailbox on each run, so your history is whatever is still in the inbox — and
  it handles one mailbox per instance, with no per-client separation.
- **Other lightweight viewers** — a wider wave of minimal single-binary projects
  (Go, PHP) aimed at small mail servers. Easy to start and low-footprint, but
  young, with smaller communities and few agency features.

## Which should you choose?

- **Already run Elasticsearch, or want a scriptable parser** → parsedmarc.
- **One mailbox, and you only care about recent reports** → a lightweight viewer
  such as dmarc-report-viewer.
- **You need SMTP TLS reporting today** → dmarc-report-viewer reads TLS-RPT; this
  project is DMARC-only for now.
- **Want turnkey dashboards, many client domains, and no search stack** →
  that's the gap DMARC Analyzer was built for.

Prefer a managed service, or comparing against the hosted platforms too? See the
[full buyer's guide](/compare/best-dmarc-monitoring-tools/).
