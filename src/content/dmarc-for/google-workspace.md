---
title: Set up SPF, DKIM & DMARC for Google Workspace
seoTitle: 'DMARC for Google Workspace: setup'
provider: Google Workspace
description: How to configure SPF, DKIM, and DMARC for Google Workspace (Gmail) — the exact DNS records, where to enable DKIM, and the gotchas specific to Google.
publishDate: 2026-07-23
updatedDate: 2026-07-25
---

Google Workspace sends your mail through Google's servers, so authenticating it
is mostly about publishing the right DNS records and **turning DKIM on** — which,
despite what most people assume, is *off* by default. Here's the full setup.

## 1. SPF

Add a single [SPF](/glossary/spf/) `TXT` record at your root domain authorizing
Google to send:

```
v=spf1 include:_spf.google.com -all
```

`_spf.google.com` covers Gmail and the Workspace sending infrastructure, and
Google keeps it current — never list Google's IP addresses yourself.

### Adding other senders

If a newsletter tool, CRM, or helpdesk also sends as your domain, add its
`include:` to the **same** record. Never publish a second SPF record:

```
v=spf1 include:_spf.google.com include:servers.mcsv.net -all
```

Two SPF records is a `permerror`, which counts as a failure. Also watch the
**10-lookup limit** — `_spf.google.com` alone costs several lookups because it
nests further includes, so a domain with three or four services can quietly
exceed the cap. [SPF record syntax](/guides/spf-record-syntax/) covers counting
and flattening.

> **Using the Gmail SMTP relay or a routing service?** Mail relayed through a
> third party leaves that provider's IPs, not Google's. Its `include:` has to be
> in your record too, or the relayed mail fails SPF.

### Subdomains

SPF doesn't inherit. A subdomain that sends mail needs its own record; one that
sends none is better off with an explicit reject record:

```
v=spf1 -all
```

## 2. DKIM — you must generate your own key

Workspace signs your mail with [DKIM](/glossary/dkim/) from the start, and that is
exactly what makes this step easy to skip. Until you generate a key, Google signs
with a **default key it owns**, whose signing domain is a `*.gappssmtp.com` name —
something like `yourdomain-com.20260115.gappssmtp.com`.

That signature is real and it passes. What it does not do is
[align](/glossary/dmarc-alignment/): the `d=` is Google's domain, not yours, so it
contributes nothing to DMARC. A checker reports DKIM as working, your reports show
`dkim=pass`, and the domain still fails DMARC on every message that SPF doesn't
rescue.

So the step below is not "turn DKIM on" — it is "make the signature yours".

1. In the **Google Admin console**, go to *Menu → Apps → Google Workspace →
   Gmail → Authenticate email*.
2. Select your domain, choose a **2048-bit** key, and click **Generate new
   record**.
3. Google gives you a `TXT` record with the [selector](/glossary/dkim-selector/)
   **`google`** — publish it at `google._domainkey.yourdomain.com`.
4. Return to the console and click **Start authentication**.

The selector is always `google` unless you change it. Two timings catch people
out: after you first turn on Gmail for your organization you may have to wait
**24–72 hours** before the key is even available in the console, and once
published it can take up to **48 hours** for DKIM to start working.

> **2048-bit keys and older DNS hosts.** A 2048-bit public key exceeds the
> 255-character limit for a single TXT string. Most DNS providers split it
> automatically; a few require you to paste it as multiple quoted strings. If
> your host rejects the value outright, that's the reason — not a bad key.

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

## Verify it worked

Confirm all three records resolve:

```
dig +short TXT yourdomain.com
dig +short TXT google._domainkey.yourdomain.com
dig +short TXT _dmarc.yourdomain.com
```

Then send a message to an external mailbox and read its `Authentication-Results`
header. In Gmail, *Show original* displays SPF, DKIM, and DMARC results directly:

```
Authentication-Results: mx.example.net;
 spf=pass smtp.mailfrom=yourdomain.com;
 dkim=pass header.d=yourdomain.com;
 dmarc=pass header.from=yourdomain.com
```

The detail that matters is `header.d` — it must be **your** domain. A `dkim=pass`
on some other domain still fails DMARC, because DMARC requires
[alignment](/glossary/dmarc-alignment/), not merely a valid signature.

## Where reports come from

Google sends DMARC aggregate reports **once per day**, from `google.com`. Expect
your first one roughly 24 hours after publishing the record — and expect it to
cover only mail Google received, which is why you need reports from every
receiver, not just this one.

## Google-specific gotchas

- **`dkim=pass` is not the same as DKIM working.** Generating the record isn't
  enough — until you click *Start authentication*, Google keeps signing with its
  own `*.gappssmtp.com` key, which passes and never aligns. Check `header.d=` in
  your reports, not just the pass or fail.
- **Google Groups and forwarding break SPF.** A forwarded message arrives from
  the forwarder's IP, so SPF fails; DKIM survives forwarding, which is why you
  want both rather than either.
- **Calendar invites and aliases** send as the domain too — check them before
  enforcing.
- **One SPF record only** — a leftover second record causes a `permerror` and a
  [DMARC failure](/guides/fix-dmarc-failure/).
- **Propagation** — DKIM changes can take up to 48h; don't move to
  `quarantine`/`reject` until reports confirm Gmail is aligned.

## Common failures and what they mean

| Symptom | Usual cause |
|---|---|
| `dkim=pass` with `header.d=…gappssmtp.com` | Still Google's default key — "Start authentication" was never clicked |
| `dkim=none` on all mail | Mail is leaving via a non-Google server, which the default key never signs |
| DNS host rejects the DKIM value | 2048-bit key exceeds one 255-char TXT string |
| `spf=permerror` | Two SPF records, or over the 10-lookup limit |
| `spf=fail` on forwarded mail only | Expected — rely on DKIM alignment instead |
| `dmarc=fail` while DKIM passes | `header.d` isn't your domain — an alignment problem |

If you run Workspace for a portfolio of clients, the reports pile up fast: one
XML file per receiver per domain per day, all of it useless until something
parses and aggregates it. That's the job [DMARC Analyzer](/) does — self-hosted,
every client domain in one dashboard, no per-domain pricing.

## What next

Give it a few days, then [read your aggregate
reports](/guides/how-to-read-a-dmarc-aggregate-report/) and, once clean, follow
the [path to enforcement](/guides/from-monitoring-to-enforcement/).
