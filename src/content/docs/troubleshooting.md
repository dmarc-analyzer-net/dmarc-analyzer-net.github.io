---
title: Troubleshooting
description: Fixes for the common problems — no reports arriving, mailbox authentication failures, a worker that stopped, parse failures, and lost admin access.
section: Operations
order: 2
---

## No reports are arriving

Work down the chain — most often it's the first item.

1. **Has it been 24 hours?** Reports are sent once a day per receiving provider.
   Nothing arrives within minutes of publishing a record.
2. **Is the DMARC record live?** Check it resolves and contains a `rua=`:
   ```bash
   dig +short TXT _dmarc.yourdomain.com
   ```
   The Domain detail page's record inspection shows the same thing, parsed.
3. **Does `rua=` point at the mailbox you connected?** A typo here fails silently —
   receivers just send reports somewhere else.
4. **Is the mailbox syncing?** Check Mailbox sources for the latest run status, and
   trigger a manual sync rather than waiting an hour.
5. **Is anyone actually sending mail from the domain?** A parked domain with no
   traffic legitimately produces no reports.

## Mailbox authentication fails

Nearly always credentials rather than configuration:

- Use an **app password**, not the account password — see [connecting a
  mailbox](/docs/mailbox-setup#app-passwords).
- Confirm IMAP is enabled for the account. Many Microsoft 365 tenants disable IMAP
  basic auth entirely; if so, that mailbox can't be used yet.
- Verify host and port (usually `993` with TLS).
- If you added `Security__CredentialEncryptionKey` *after* saving a mailbox, its
  password is re-encrypted on the next sync — re-save the mailbox if the key
  changed.

## The worker isn't ingesting anything

Check it's running and what it's saying:

```bash
docker compose ps
docker compose logs --tail=50 worker
```

- **`Exited`** — most likely it started against a database with no schema. The
  shipped compose files order startup so the worker waits for the API; if you wrote
  your own, reproduce that ordering. `docker compose up -d` again once the API is
  healthy.
- **Running but idle** — with default settings it polls every 60 minutes. Confirm
  at least one mailbox source is **active**, and that its protocol is IMAP.
- **Repeated `Worker scheduler pass failed`** — the message includes the underlying
  error; a database connection problem is the usual cause.

## Parse failures in the sync history

A run reporting `parseFailures` above zero means an attachment couldn't be read.
Common causes:

- An unusual ZIP compression variant.
- Something in the mailbox that isn't a DMARC report — many providers also send
  TLS-RPT reports, and marketing mail lands in shared inboxes.

The rest of the run still imports; failures are counted, not fatal. If a mailbox
shows persistent failures, it's worth
[opening an issue](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/issues)
with the attachment name.

## The dashboard looks empty but reports imported

Analytics windows anchor to your **newest report**, not today. If you imported only
historical data, "last 30 days" covers the 30 days before that newest report — so
data exists but the default window may sit past it. Widen the window with the day
selector.

## I can't sign in / lost the admin account

Registration is locked after the first-run bootstrap, so you can't simply
re-register. Options:

- Sign in with another `agency_admin` account and reset the user.
- If no admin remains, you'll need database access to promote an existing user:
  ```bash
  docker compose exec -T postgres psql -U postgres -d dmarc_analyzer \
    -c "update agency_user set \"Role\"='agency_admin' where \"Email\"='you@example.com';"
  ```

If you enabled SSO and it broke, this is why keeping one local admin password
matters.

## A domain landed under the wrong client

Domains are auto-created under the mailbox source's **default client**. Reassign
the domain from the Domains page, and change the mailbox's default client so future
domains land correctly.

## Cross-tenant requests return 404, not 403

Deliberate. A `client_viewer` requesting another client's data gets **404** so the
API never confirms that a resource exists. Not a bug — if you're seeing unexpected
404s, check the user's client grants.

## Getting help

Include the sync-run counters and the relevant `docker compose logs` excerpt when
[filing an issue](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/issues) —
and please redact domain names and credentials.
