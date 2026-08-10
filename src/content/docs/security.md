---
title: Security
seoTitle: "Security model: data, keys and roles"
description: What DMARC Analyzer stores, how mailbox credentials and passwords are protected, how roles work, and the settings worth getting right.
section: Operations
order: 2
publishDate: 2026-07-26
updatedDate: 2026-07-27
---

Self-hosting means the security posture is yours. This page is what you need to
know to judge it — what is stored, how the sensitive parts are protected, and the
few settings that matter.

## What is stored, and what isn't

DMARC aggregate reports are **statistical summaries**, not copies of your mail.
A report says "203.0.113.5 sent 412 messages claiming to be your domain, 400 passed
DKIM". There are no subjects, no bodies, no recipients, no attachments.

| Stored | Not stored |
|---|---|
| Sending IPs, message counts, pass/fail per report | Message content of any kind |
| Domains, clients, retention settings | Your users' mail |
| Mailbox host, username, encrypted password | The mail in that mailbox after parsing |
| Audit entries: who did what, when, from where | |

The application connects **outbound** to your IMAP mailbox. It never needs inbound
SMTP, and it does not need to be internet-facing at all unless you want the console
to be.

## The encryption key

`Security__CredentialEncryptionKey` encrypts stored mailbox passwords at rest with
AES-256-GCM. Generate 32 random bytes:

```bash
openssl rand -base64 32
```

This is the one piece of key management the product asks of you, and it has two
sharp edges:

- **Lose it** and every stored mailbox credential becomes undecryptable. They are
  not recoverable from a database backup — each mailbox source has to be entered
  again.
- **Leak it alongside a database dump** and you have leaked your mailbox passwords.

So keep it *with* your backups in the sense of not losing it, and *away* from them
in the sense of not storing it in the same place. A secret manager is the right
home; the `.env` file next to the dump is not.

> If the key is unset the app still starts, logs a warning, and stores credentials
> **in plaintext**. That is deliberate — it keeps a throwaway local test to one
> command — but it is not a state to be in otherwise. Adding a key later upgrades
> existing rows lazily as each mailbox next syncs.

On Kubernetes, use `auth.existingSecret` rather than `--set auth.encryptionKey`,
which would otherwise put the key in your values file, your shell history and
`helm get values`.

## Accounts and sessions

Passwords are hashed with **PBKDF2-SHA256, 100,000 iterations**, a 16-byte random
salt per password and a 32-byte derived key, compared in constant time.

The session cookie `dmarc_session` is `HttpOnly`, `SameSite=Lax`, times out after
**12 hours idle** and has a **7 day** absolute maximum. It is marked `Secure` when
the request arrives over HTTPS — including via `X-Forwarded-Proto` from a
[reverse proxy](/docs/reverse-proxy/) — and not when it arrives over plain HTTP,
which is what lets the console work on a LAN without a certificate.

Registration is open only for the **first** account, which becomes the
administrator, and closes permanently after that. Later users are created by an
admin.

## Roles and tenant isolation

Three roles: `agency_admin`, `agency_analyst`, `client_viewer`. Agency staff see
every client; a `client_viewer` sees only the clients explicitly granted to them.

Two properties worth knowing:

- **Authorisation is always evaluated in the application**, never delegated to an
  identity provider. Turning on [single sign-on](/docs/single-sign-on/) changes who
  can prove who they are, not what they may see.
- **Cross-tenant requests return 404, not 403.** A `client_viewer` asking for
  someone else's client cannot tell the difference between "not allowed" and "does
  not exist", which is the point.

Auto-provisioned SSO users get `Auth__Oidc__DefaultRole`, which defaults to
`client_viewer` — the least privileged role — and `Auth__Oidc__AutoProvision` is
off by default, so by default a user must already exist.

## The audit trail

Sign-ins, failed sign-ins, client and domain changes, mailbox source edits, schema
migrations and retention purges are all recorded, with the actor and their address.
Admins can read it under **Audit** in the console.

Behind a proxy this records the proxy's address for everything unless you configure
[forwarded headers](/docs/reverse-proxy/#the-audit-trail-problem). That is worth
doing before you need the audit trail rather than after.

Audit entries are kept for `Retention__AuditRetentionDays`, 730 by default, and are
purged on the same daily pass as report data.

## Network exposure

The container listens on plain HTTP on 8080 and terminates no TLS. Put a proxy in
front of anything internet-facing.

Nothing in the application needs to accept inbound connections from the internet.
A perfectly reasonable deployment keeps the console on a private network or behind
your VPN and lets only its outbound connections cross a boundary — IMAP to your
mailbox, plus DNS for published-policy lookups, SMTP if you enable alert or digest
mail, and HTTPS to your identity provider if you enable SSO.

> **Plain HTTP on a private network works, and costs you something.** The session
> cookie's `Secure` flag follows the request scheme, so reaching the console at
> `http://dmarc.internal:8080` or `http://10.0.5.7:8080` signs you in normally —
> which is what makes the app usable on a NAS or home server without a certificate.
> The cookie stays `HttpOnly` and `SameSite=Lax`, but it is no longer marked
> `Secure`, and the traffic is unencrypted: anyone who can see the network can read
> the session cookie and everything in the console. Fine behind a VPN you trust,
> not fine on a shared LAN. Put [TLS](/docs/reverse-proxy/) in front of it whenever
> you reasonably can.
>
> Behind a TLS-terminating proxy the app itself sees HTTP, so set
> `Network__UseForwardedHeaders` — `X-Forwarded-Proto` is what tells it the browser
> used HTTPS and restores the `Secure` flag. Without that the cookie works but is
> marked insecure even though the connection was not.

`AllowedHosts` defaults to `*`. Host filtering is usually better handled by the
proxy, but it is there.

## Operational guarantees worth knowing

- **Only one ingestion worker may run against a database.** The process takes a
  PostgreSQL advisory lock at startup and a second worker exits rather than
  starting. This prevents duplicated work and duplicate alert email — see
  [choosing a deployment](/docs/choose-your-deployment/#topology-one-container-or-two).
- **An unrecognised `APP_MODE` fails startup** instead of falling back, so a typo
  cannot leave you with a console that serves fine and silently ingests nothing.
- **Retention is deletion, not archival.** Purged reports are gone; take a
  [backup](/docs/upgrading-and-backup/#what-to-back-up) if you need the history.
  A client can be put on legal hold to exempt it entirely.

## Reporting a vulnerability

Open a security advisory on
[the repository](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/security/advisories)
rather than a public issue.
