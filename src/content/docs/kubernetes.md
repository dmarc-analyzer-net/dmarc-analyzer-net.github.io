---
title: Kubernetes
description: Install DMARC Analyzer with the Helm chart — the same two deployment choices as Compose, a migration Job, secret handling, backup and restore.
section: Getting started
order: 4
publishDate: 2026-07-26
updatedDate: 2026-08-05
---

There is a Helm chart, published as an OCI artifact on every release. It exposes
the **same two choices** as the Compose files — bundled or external PostgreSQL,
one container or two — so a deployment can move between the two platforms without
relearning its configuration.

Use it if you already run Kubernetes. It is not a reason to start:
[Compose](/docs/install/) is simpler for a single host, and most self-hosted
installs are a single host.

## Install

```bash
helm install dmarc oci://ghcr.io/dmarc-analyzer-net/charts/dmarc-analyzer \
  --version 0.7.1 \
  --namespace dmarc --create-namespace \
  --set auth.encryptionKey="$(openssl rand -base64 32)"
```

```bash
kubectl -n dmarc port-forward svc/dmarc-dmarc-analyzer 8080:80
```

Open **http://localhost:8080** and create the first administrator account.

That default is a trial: bundled PostgreSQL and the encryption key in your shell
history. See [production](#production) before relying on it.

## The two choices

```yaml
mode: combined        # or: split
postgres:
  enabled: true       # or: false, with externalDatabase
```

| | |
|---|---|
| `combined` | one Deployment running the console and the polling loop |
| `split` | two Deployments — `app` (`APP_MODE=api`) and `worker` |
| `postgres.enabled: true` | a single-replica StatefulSet with a PVC |
| `postgres.enabled: false` | uses `externalDatabase.*` |

## Production

```bash
kubectl -n dmarc create secret generic dmarc-creds \
  --from-literal=encryption-key="$(openssl rand -base64 32)" \
  --from-literal=db-password='…'

helm install dmarc oci://ghcr.io/dmarc-analyzer-net/charts/dmarc-analyzer \
  --version 0.7.1 --namespace dmarc \
  --set auth.existingSecret=dmarc-creds \
  --set postgres.enabled=false \
  --set externalDatabase.host=db.internal \
  --set externalDatabase.username=dmarc
```

Four things worth doing deliberately:

- **`auth.existingSecret`.** Otherwise the encryption key sits in your values file,
  your shell history, and `helm get values`.
- **Back that key up.** Lose or change it and every stored mailbox credential
  becomes undecryptable — each source has to be entered again. It is not
  recoverable from a database backup.
- **`postgres.enabled=false`.** The bundled StatefulSet has no replication, no
  backups and no pooling. It exists to make a trial one command.
- **Pin the chart version.** Chart `version` and `appVersion` are equal and come
  from the release tag, so the chart version alone determines which application
  version you get.

## What the chart refuses

Some configurations would install successfully and then misbehave in ways that are
hard to attribute, so the chart fails at template time instead, with the reason.

| Configuration | Why |
|---|---|
| `mode=combined` with `app.replicas > 1` | every app pod runs its own polling loop, so N replicas are N schedulers on the same mailboxes |
| `worker.replicas != 1` | there is no claim mechanism in the queue; two workers duplicate every pass and can send duplicate alert and digest email |
| `migrations.strategy=startup` with more than one replica | replicas race to apply the same migration |
| `postgres.enabled=false` with no `externalDatabase.host` | nowhere to connect |
| neither `auth.encryptionKey` nor `auth.existingSecret` | mailbox credentials would be stored in plaintext |

**Scale the console, not the worker.** `app.replicas` is free in `mode=split` —
`APP_MODE=api` pods run no loop and take no lock. The single-worker limit is a
property of the application, not of Kubernetes: the process holds a PostgreSQL
advisory lock, so a second worker would exit even if the chart let you ask for one.

## Migrations

`migrations.strategy` chooses between a pre-install/pre-upgrade `Job` and letting
the app migrate as it boots. Left empty it picks `startup` with bundled PostgreSQL
and `job` without, and the reason is ordering rather than preference: a pre-install
hook runs before the bundled StatefulSet exists, so on a first install a Job would
wait for a database that is not there yet.

The Job runs `APP_MODE=migrate`, which applies pending migrations and exits without
serving or ingesting anything, so it finishes before any application pod starts.
Re-running it with nothing pending logs `No pending migrations; nothing to do.` and
succeeds — an unchanged upgrade is a clean no-op.

```bash
kubectl -n dmarc logs job/dmarc-dmarc-analyzer-migrate-1
```

`migrations.activeDeadlineSeconds` defaults to 900. The largest migration shipped
so far rewrites about 5.3 million rows in roughly 94 seconds, so there is room, but
a very large database may want more.

## Backup and restore

Same as on [Compose](/docs/upgrading-and-backup/#what-to-back-up), including the
[configuration export](/docs/upgrading-and-backup/#the-configuration-export), which is the
primary backup and can be shipped straight to object storage. The two things below remain
the pre-upgrade artifact and the key that makes any of it restorable:
the database, and the encryption key.

### Database

With the bundled StatefulSet:

```bash
kubectl -n dmarc exec statefulset/dmarc-dmarc-analyzer-postgres -- \
  pg_dump -U postgres dmarc_analyzer | gzip > dmarc-$(date +%F).sql.gz
```

With an external database, back it up wherever you already back that up — the app
holds no state outside PostgreSQL.

### The encryption key

```bash
# your own Secret, as created under Production above
kubectl -n dmarc get secret dmarc-creds -o jsonpath='{.data.encryption-key}' | base64 -d

# or, if you let the chart create one (release name "dmarc")
kubectl -n dmarc get secret dmarc-dmarc-analyzer-secrets \
  -o jsonpath='{.data.encryption-key}' | base64 -d
```

Store it in your secret manager, not only beside the dump. **A database backup
without this key leaves you re-entering every mailbox credential.** Keep the two in
separate places: together they expose your mailbox passwords, but restoring without
both means manual work.

### Restore

```bash
kubectl -n dmarc scale deploy/dmarc-dmarc-analyzer --replicas=0
kubectl -n dmarc scale deploy/dmarc-dmarc-analyzer-worker --replicas=0   # if split

# recreate the database empty — the dump contains no DROP statements, so
# restoring over the existing schema fails on every object
kubectl -n dmarc exec statefulset/dmarc-dmarc-analyzer-postgres -- \
  psql -U postgres -d postgres \
  -c 'DROP DATABASE IF EXISTS dmarc_analyzer;' -c 'CREATE DATABASE dmarc_analyzer;'

gunzip -c dmarc-2026-07-26.sql.gz | kubectl -n dmarc exec -i \
  statefulset/dmarc-dmarc-analyzer-postgres -- \
  psql -v ON_ERROR_STOP=1 -U postgres -d dmarc_analyzer

kubectl -n dmarc scale deploy/dmarc-dmarc-analyzer --replicas=1
kubectl -n dmarc scale deploy/dmarc-dmarc-analyzer-worker --replicas=1   # if split
```

Scale the application down first. Restoring underneath a running worker means it
is writing while you restore.

**Scale the worker back up.** In `split` mode it is the only thing that ingests, so
leaving it at zero gives you a console that works perfectly and never receives
another report. Nothing surfaces that as an error, and the next `helm upgrade`
quietly restores it, which hides the cause.

`-v ON_ERROR_STOP=1` matters as much here as on Compose: without it `psql` reports
errors and still exits 0, so a restore that populated almost nothing is
indistinguishable from one that worked.

Make sure the Secret holds the **original** encryption key before scaling back up,
or mailbox syncs will fail to decrypt their credentials.

## Notes on the chart's internals

- **An init container waits for the database.** Kubernetes has no equivalent of
  Compose's `depends_on: condition: service_healthy` — every pod in a release
  starts at once — so without it the app comes up before PostgreSQL is reachable,
  fails, and restarts until it is. It converges either way, but the restarts look
  like a crash-loop and the backoff can turn a 20-second wait into minutes.
- **The Secret and ServiceAccount are pre-install hooks**, because hooks run before
  ordinary resources and the migration Job needs both to exist. One consequence:
  `helm uninstall` leaves them behind.
- **The worker Deployment uses `Recreate`.** A rolling update would briefly run the
  old and new worker together — the exact overlap the single-worker rule exists to
  prevent.
- **`readOnlyRootFilesystem` is on**, with an `emptyDir` at `/tmp` because .NET
  needs somewhere to write.

The [chart README](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/deploy/helm/dmarc-analyzer/README.md)
carries the full values reference.
