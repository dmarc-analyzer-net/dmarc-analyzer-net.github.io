---
title: Install with Docker
description: Get DMARC Analyzer running in a few minutes with Docker Compose using the prebuilt image — no build step, no account, and your data stays on your server.
section: Getting started
order: 1
---

DMARC Analyzer ships as a single container image that runs in two modes — the API
(which also serves the web console) and a background worker. The quick start below
runs both plus PostgreSQL.

## Requirements

- Docker with Compose v2 (`docker compose`, not `docker-compose`).
- ~1 GB RAM and a little disk for PostgreSQL. Report data is small; a busy domain
  produces a few MB a month.
- A mailbox that receives your DMARC aggregate reports — see
  [connecting a mailbox](/docs/mailbox-setup/). You can install first and add it after.

## Quick start

```bash
mkdir dmarc-analyzer && cd dmarc-analyzer
curl -fsSL -o compose.yml https://raw.githubusercontent.com/dmarc-analyzer-net/DmarcAnalyzerApp/main/deploy/compose.yml
# generates the key that encrypts stored mailbox passwords
echo "DMARC_ENCRYPTION_KEY=$(openssl rand -base64 32)" > .env
docker compose up -d
```

Then open **http://localhost:8080** and create the first administrator account.

> **Keep `.env` safe and backed up.** `DMARC_ENCRYPTION_KEY` decrypts your stored
> mailbox credentials. Lose it and you must re-enter every mailbox password; leak
> it and anyone with your database can read them.

## What you just started

| Container | Role |
|---|---|
| `api` | HTTP API + web console on port 8080. Applies database migrations at startup. |
| `worker` | Polls your mailboxes, parses reports, writes them to the database. No HTTP port. |
| `postgres` | Storage, on a named Docker volume (`dmarc-pgdata`). |

Startup is ordered deliberately: Postgres must report healthy, then the API must
report healthy (which means migrations finished), and only then does the worker
start. The worker queries tables the API creates, so this ordering matters.

## Registries

The image is published to two registries on every release:

```
ghcr.io/dmarc-analyzer-net/dmarc-analyzer:latest   # recommended
dmarcanalyzernet/dmarc-analyzer:latest             # Docker Hub mirror
```

Both carry `latest`, a `sha-<commit>` tag, and semantic version tags, for
`linux/amd64` and `linux/arm64` (so a Raspberry Pi or Apple Silicon machine works).
GHCR is recommended because it doesn't rate-limit anonymous pulls.

To pin a version instead of tracking `latest`, edit the `image:` lines in
`compose.yml`.

## Running behind a reverse proxy

The container speaks plain HTTP on 8080. For anything internet-facing, terminate
TLS in front of it (Caddy, nginx, Traefik) and forward to the `api` container.
Sessions use a `Secure` cookie, so the browser must reach the app over HTTPS.

## Building from source instead

```bash
git clone https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp.git
cd DmarcAnalyzerApp
docker compose up -d --build
```

That uses the repository's development compose file, which builds the image
locally and polls mailboxes far more frequently than production defaults. For
local development without Docker (hot reload for API and frontend), see the
repository README.

## Next

Create your first client and domain in [first steps](/docs/getting-started/).
