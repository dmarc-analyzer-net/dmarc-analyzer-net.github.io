---
title: Set up SPF, DKIM & DMARC for Google Workspace
seoTitle: 'DMARC for Google Workspace: setup'
provider: Google Workspace
description: How to configure SPF, DKIM, and DMARC for Google Workspace (Gmail) — the exact DNS records, where to enable DKIM, and the gotchas specific to Google.
publishDate: 2026-07-23
---

Google Workspace sends your mail through Google's servers, so authenticating it
is mostly about publishing the right DNS records and **turning DKIM on** — which,
despite what people assume, is *off* by default. Here's the full setup.

## 1. SPF

Add a single [SPF](/glossary/spf/) `TXT` record at your root domain authorizing
Google to send:

```
v=spf1 include:_spf.google.com -all
```

If other services also send as your domain (a newsletter tool, CRM, etc.), add
their `include:` to the **same** record — never create a second SPF record. See
[SPF record syntax](/guides/spf-record-syntax/) for combining senders and the
10-lookup limit.

## 2. DKIM — you must generate and turn it on

This is the step most people miss: Google Workspace does **not** sign with
[DKIM](/glossary/dkim/) until you generate a key and start authentication.

1. In the **Google Admin console** → *Apps → Google Workspace → Gmail →
   Authenticate email*.
2. Select your domain, choose a **2048-bit** key, and click **Generate new
   record**.
3. Google gives you a `TXT` record with the selector **`google`** — publish it at
   `google._domainkey.yourdomain.com`.
4. Return to the console and click **Start authentication**.

The selector is always `google`, and the record can take up to 48 hours to be
recognized before you start authentication.

## 3. DMARC

Once SPF and DKIM are live, publish a [DMARC](/glossary/dmarc/) record in
monitoring mode at `_dmarc.yourdomain.com`:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` [monitors without affecting delivery](/glossary/dmarc-policy/); `rua=`
is where [aggregate reports](/glossary/dmarc-aggregate-report/) are sent. See
[publish your first DMARC record](/guides/publish-your-first-dmarc-record/) for
the safe rollout.

## Where reports come from

Google sends DMARC aggregate reports **once per day**, identified as coming from
`google.com`. Expect your first report roughly 24 hours after publishing.

## Google-specific gotchas

- **DKIM is off until you "Start authentication"** — generating the record isn't
  enough.
- **Don't list Google's IPs manually** in SPF; use `include:_spf.google.com`,
  which Google keeps current.
- **One SPF record only** — a leftover second record causes a `permerror` and a
  [DMARC failure](/guides/fix-dmarc-failure/).
- **Propagation** — DKIM changes can take up to 48h; don't move to
  `quarantine`/`reject` until reports confirm Gmail is aligned.

## What next

Give it a few days, then [read your aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/) and, once clean, follow
the [path to enforcement](/guides/from-monitoring-to-enforcement/).
