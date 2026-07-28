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
  reveal your sending infrastructure; [self-hosting keeps that
  in-house](/self-hosted-dmarc-monitoring/), along with the operational cost of
  owning it.
- **No per-domain / per-volume fees** — run [unlimited domains for
  free](/free-dmarc-analyzer/).
- **Auditability** — open source you can read, modify, and trust.

## The options

| Tool | Language | What you run | Dashboards | Multi-tenant | Helm chart |
|---|---|---|---|---|---|
| **DMARC Analyzer** | .NET + React | [One container + PostgreSQL](/docs/install/) | Built in | Yes ([per client](/docs/clients-users-and-audit/)) | [Yes](/docs/kubernetes/) |
| parsedmarc | Python | Parser + Elasticsearch/OpenSearch + Kibana/Grafana | Via Kibana/Grafana | No | No |
| dmarc-report-viewer | Rust | One ~10 MB container or a single binary — no database | Built in | No | No |
| dmarc-report-converter | Go | A scheduled CLI job — no service to run | Static HTML output, no dashboard | No | No |
| Other lightweight viewers | Go / PHP | A single small service + SQLite/MySQL | Basic, built in | Usually no | — |

- **[parsedmarc](/compare/parsedmarc/)** — the most established. A flexible parser
  with rich outputs, but dashboards mean standing up and maintaining a search
  stack (Elasticsearch/OpenSearch + Kibana/Grafana). Best if you already run one
  or want a CLI parser for your own pipeline.
- **DMARC Analyzer** — open source and self-hosted like parsedmarc, but ships as
  a single container with PostgreSQL and dashboards built in, plus per-client
  multi-tenancy for agencies. Turnkey, without a search cluster to babysit. It also
  ships a maintained Helm chart — which none of the named alternatives here do — if
  you would rather run it on Kubernetes than on a single host.
- **dmarc-report-viewer** — the smallest credible option: a single Rust binary or
  a small container with an IMAP client built in. It also reads SMTP TLS
  (TLS-RPT) reports, as parsedmarc does and this project does not. As of July
  2026 its documentation describes no database and a single IMAP mailbox per
  instance, so how much history you keep depends on what is still in the mailbox
  and there is no per-client separation — check the project before relying on
  either, since that is exactly the kind of thing a release changes.
- **dmarc-report-converter** — not a monitor at all, and useful to know that
  before you try to use it as one. It's a Go CLI that turns report XML into
  human-readable HTML, text or JSON, reading from a folder or straight from
  IMAP, and you schedule it. There's no database, no dashboard and no service —
  you get files you can serve or email. A good fit if you want a cron job and an
  artifact rather than something to log into.
- **Other lightweight viewers** — a wider wave of minimal single-binary projects
  (Go, PHP) aimed at small mail servers. Easy to start and low-footprint, but
  young, with smaller communities and few agency features.

## Which should you choose?

- **Already run Elasticsearch, or want a scriptable parser** → parsedmarc.
- **One mailbox, and you only care about recent reports** → a lightweight viewer
  such as dmarc-report-viewer.
- **You need SMTP TLS reporting today** → parsedmarc or dmarc-report-viewer both
  read [TLS-RPT](/glossary/tls-rpt/); this project is DMARC-only for now. parsedmarc also parses
  forensic (RUF) reports, which we do not.
- **You want a scheduled artifact, not a dashboard** → dmarc-report-converter.
- **Want turnkey dashboards, many client domains, and no search stack** →
  that's the gap DMARC Analyzer was built for.

Prefer a managed service, or comparing against the hosted platforms too? See the
[full buyer's guide](/compare/best-dmarc-monitoring-tools/).
