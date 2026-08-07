---
title: Install with Docker
description: Get DMARC Analyzer running in a few minutes with Docker Compose using the prebuilt image — no build step, no account, and your data stays on your server.
section: Getting started
order: 1
---

DMARC Analyzer ships as a **single container image**. By default one container runs
the whole application — the web console and the background mailbox polling — next
to PostgreSQL. Two containers, and nothing else to install.

That is the right shape for most self-hosters. You can split the console and the
worker apart, point at a database you already run, or deploy to Kubernetes
instead — see [choosing a deployment](/docs/choose-your-deployment/).

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

Reaching it over plain HTTP at a hostname or LAN address works too — since 0.2.2
the session cookie is marked `Secure` only when the request arrives over HTTPS,
which is what makes the console usable on a NAS or home server without a
certificate. The traffic is unencrypted either way, so put [TLS in
front](/docs/reverse-proxy/) whenever you reasonably can. Create the first admin
before pointing public DNS at it: until that account exists, registration is open
to whoever reaches the page first.

> **Keep `.env` safe and backed up.** `DMARC_ENCRYPTION_KEY` decrypts your stored
> mailbox credentials. Lose it and you must re-enter every mailbox password; leak
> it and anyone with your database can read them.

## What you just started

| Container | Role |
|---|---|
| `app` | Web console on port 8080 **and** the mailbox polling loop, in one process (`APP_MODE=all`). Applies database migrations at startup. |
| `postgres` | Storage, on a named Docker volume (`dmarc-pgdata`). |

The app waits for Postgres to report healthy before starting, because it migrates
the database as it boots. On a first run that is quick; after an upgrade that adds
a large migration it can take a couple of minutes, and the container is reported
unhealthy until it finishes. That is the migration running, not a hang.

## Other shapes

Two overlay files sit next to `compose.yml` in the repository. They need Docker
Compose **v2.24 or newer** (`docker compose version`).

| Instead of the default | Command |
|---|---|
| Use a PostgreSQL you already run | `-f compose.yml -f compose.external-db.yml` |
| Run the console and worker separately | `-f compose.yml -f compose.split.yml` |
| Both | pass both `-f` flags |

Download them alongside `compose.yml`, then record the choice once so day-to-day
use stays a plain `docker compose up -d`:

```bash
curl -fsSL -O https://raw.githubusercontent.com/dmarc-analyzer-net/DmarcAnalyzerApp/main/deploy/compose.split.yml
echo "COMPOSE_FILE=compose.yml:compose.split.yml" >> .env
```

Every combination reads the same environment variables. [Choosing a
deployment](/docs/choose-your-deployment/) covers when each is worth it.

> **Only one worker may run at a time**, whichever shape you pick. The application
> takes a database lock at startup and a second worker exits rather than starting,
> so `--scale worker=2` will not silently double-poll your mailboxes.

## Registries

The image is published to two registries on every release:

```
ghcr.io/dmarc-analyzer-net/dmarc-analyzer:latest   # recommended
dmarcanalyzernet/dmarc-analyzer:latest             # Docker Hub mirror
```

Both carry `latest`, a `sha-<commit>` tag, and semantic version tags, for
`linux/amd64` and `linux/arm64` (so a Raspberry Pi or Apple Silicon machine works).
GHCR is recommended because it doesn't rate-limit anonymous pulls.

The quick start above tracks `latest`, which is fine for getting going. For
anything you depend on, **pin a version** — it makes an upgrade an explicit act
and a rollback unambiguous:

```yaml
image: ghcr.io/dmarc-analyzer-net/dmarc-analyzer:0.8.0
```

See [upgrading](/docs/upgrading-and-backup/#pinning-a-version).

## Running behind a reverse proxy

The container speaks plain HTTP on 8080. For anything internet-facing, terminate
TLS in front of it (Caddy, nginx, Traefik) and forward to the `app` container.
Sessions work over plain HTTP on a private network, but the traffic and the
session cookie are then unencrypted — put TLS in front of anything beyond a
network you fully trust.

There is one setting to get right that is easy to miss: without it, **every entry
in your audit trail records the proxy's address instead of the real caller**. See
[running behind a reverse
proxy](/docs/reverse-proxy/) for working Caddy, nginx and Traefik configs.

## Kubernetes

There is a Helm chart, published as an OCI artifact on every release:

```bash
helm install dmarc oci://ghcr.io/dmarc-analyzer-net/charts/dmarc-analyzer \
  --version 0.8.0 --namespace dmarc --create-namespace \
  --set auth.encryptionKey="$(openssl rand -base64 32)"
```

It exposes the same two choices as the Compose files, so a deployment can move
between them without relearning its configuration. See
[Kubernetes](/docs/kubernetes/).

## Building from source instead

```bash
git clone https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp.git
cd DmarcAnalyzerApp
docker compose up -d --build
```

That uses the repository's development compose file, which builds the image
locally, runs the console and worker as separate containers, and polls mailboxes
far more frequently than production defaults. For local development without Docker
(hot reload for API and frontend), see the repository README.

## Next

Create your first client and domain in [first steps](/docs/getting-started/).
