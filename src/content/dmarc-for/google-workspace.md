---
title: Set up SPF, DKIM & DMARC for Google Workspace
seoTitle: 'DMARC for Google Workspace: setup'
provider: Google Workspace
description: How to set up SPF, DKIM and DMARC for Google Workspace (Gmail) — the DNS records, custom DKIM signing, alignment checks, and reporting limits.
publishDate: 2026-07-23
updatedDate: 2026-11-23
---

Set up DMARC for Google Workspace by authorizing your senders with SPF,
enabling DKIM signing for your domain, and publishing a DMARC record in DNS.
Check existing records first: preserve working authentication and any
quarantine or reject policy already in place.

## 1. SPF

[SPF](/glossary/spf/) ([RFC 7208](/rfc/7208/)) checks the sending IP against
the SMTP envelope domain, not the visible `From:` address. If Google Workspace
is your only sender and you have no SPF record, Google's
[recommended record](https://knowledge.workspace.google.com/admin/security/set-up-spf)
is a `TXT` record at your root domain:

```text
v=spf1 include:_spf.google.com ~all
```

Google maintains the authorized ranges behind `_spf.google.com`. `~all`
returns softfail for other IPs; `-all` returns fail. Neither result determines
delivery by itself. Preserve an existing record's qualifier unless you intend
to change that policy.

### Adding other senders

Inventory newsletters, forms, CRMs and helpdesks before editing SPF. Add only
the authorization each provider requires for the envelope domain it actually
uses. A service using its own return-path domain may need no apex SPF change;
configure its aligned DKIM or custom return path instead.

Keep one SPF record per name. Two selected `v=spf1` records return
`permerror`, not `fail`. An aligned DKIM pass can still make DMARC pass.

The limit is **ten DNS-querying terms evaluated**, including nested terms,
not ten providers or ten DNS packets. Google's include currently contains IP
ranges without nested includes, but its contents can change. The
[SPF syntax guide](/guides/spf-record-syntax/) explains the budget; the
[SPF checker](/tools/spf-checker/) inspects current DNS, rather than predicting
every message's evaluation.

> **SMTP relay and outbound gateways differ.** Google's SMTP relay sends
> through Google. A third-party outbound gateway sends the final hop from its
> own IPs: authorize those for the envelope domain too. A gateway that changes
> signed content can also break DKIM. Check a message after the whole route.

### Subdomains

SPF does not inherit from the root. Publish authorization at each envelope
subdomain you use. A name that must never be used for an envelope sender or
HELO identity can publish:

```text
v=spf1 -all
```

That record does not protect a visible `From:` address on its own.

## 2. DKIM — sign with your domain

[DKIM](/glossary/dkim/) ([RFC 6376](/rfc/6376/)) verifies a signature using
the domain in `d=` and selector in `s=`. A valid signature for Google's domain
does not authenticate your visible sender domain for DMARC.

Check your current signing domain before generating another key. Some partner
setups already configure custom DKIM; a `*.gappssmtp.com` signing domain does
not align with `yourdomain.com`.

Follow Google's [DKIM setup](https://knowledge.workspace.google.com/admin/security/set-up-dkim):

1. Sign in as a **super administrator**. Open *Menu → Apps → Google Workspace
   → Gmail → Authenticate email* and select the domain.
2. If a new key is needed, click **Generate New Record**, select **2048 bits**
   where your DNS host supports it, choose a selector, then click **Generate**.
   The default selector is `google`; use a different one if that name is
   already serving another key.
3. Publish the exact TXT name and value Google supplies. With the default
   selector, the full name is `google._domainkey.yourdomain.com`. A DNS panel
   that appends your domain needs only `google._domainkey` in its host field.
4. Once the record resolves, return to the selected domain and click
   **Start authentication**. Verify the status and a delivered test message.

Newly enabled Gmail can require **24–72 hours** before key generation is
available. Authentication can take up to **48 hours** after publication.
Repeat the setup and test for each sending domain.

A 2048-bit key needs multiple TXT character-strings when each is limited to
255 characters. Keep them in **one TXT record**; DNS joins the strings without
adding spaces. Check your DNS host's input format if it rejects or truncates
the value. A TXT record cannot be proxied through Cloudflare.

## 3. DMARC

[DMARC](/glossary/dmarc/) ([RFC 9989](/rfc/9989/)) passes when SPF or DKIM
passes with a domain aligned to the visible `From:` domain. Configure both
paths, then test actual mail.

If you have no DMARC record, create a mailbox that accepts report attachments
and add a TXT record at `_dmarc.yourdomain.com`:

```text
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` requests no DMARC-specific delivery action; spam filters still apply.
`rua` requests aggregate reports. If a record already exists, edit it without
adding a second record or weakening an established policy. These changes are
made at your DNS host, not in Gmail's Admin console.

## Verify it worked

Check DNS, substituting your domain and the selector you actually chose:

```sh
dig +short TXT yourdomain.com
dig +short TXT google._domainkey.yourdomain.com
dig +short TXT _dmarc.yourdomain.com
```

Send to a separate recipient mailbox. In Gmail, open *More → Show original*
and inspect the recipient's trusted `Authentication-Results` header. A
successful example is:

```text
Authentication-Results: mx.example.net;
 spf=pass smtp.mailfrom=yourdomain.com;
 dkim=pass header.d=yourdomain.com;
 dmarc=pass header.from=yourdomain.com
```

Compare `smtp.mailfrom` and each passing `header.d` with `header.from`.
Default relaxed [alignment](/glossary/dmarc-alignment/) allows domains sharing
an organizational domain; strict alignment requires an exact match. One
unaligned DKIM signature does not prevent another aligned signature or aligned
SPF from passing DMARC.

## Where reports come from

[Aggregate reports](/glossary/dmarc-aggregate-report/) ([RFC 9990](/rfc/9990/))
cover mail evaluated by reporting receivers. Google is one reporter, not a
record of everything Workspace sent. Reports usually arrive daily, but the
first report is not guaranteed within 24 hours. Coverage can be incomplete
and delivery delayed; silence does not prove that no mail failed.

For many client domains, [DMARC Analyzer](/) groups received reports in one
self-hosted console without per-domain fees. Its [domain detail
view](/docs/domain-detail/) separates raw SPF/DKIM results from the aligned
DMARC verdict, so you can investigate failures by source and reporter.

## Google-specific gotchas

- **Publishing a key is only part of setup.** Confirm *Start authentication*
  and test the signing domain on delivered mail.
- **Forwarding can break SPF.** The forwarder's IP may be unauthorized for
  the original envelope domain. Rewriting that domain can make SPF pass
  without preserving alignment. DKIM can survive unchanged forwarding, but
  mailing-list subject changes or footers can break it.
- **Test every route.** Include aliases, Calendar invitations, applications,
  outbound gateways and any Google Groups or mailing lists your users use.
- **DNS publication is not proof of signing.** Cached answers and reports
  can lag behind changes. Check fresh messages as well as incoming reports.

## Common failures and what they mean

| Symptom | What to check |
|---|---|
| `dkim=pass` with an unaligned `header.d` | Custom signing setup and any other passing signatures; aligned SPF can still pass DMARC |
| `dkim=none` | No signature was evaluated; inspect the message route and signing configuration |
| DNS host rejects the DKIM value | Hostname format, truncation and support for multiple strings in one TXT record |
| `spf=permerror` | Duplicate SPF records, syntax errors or exceeded evaluation limits |
| SPF fails after forwarding | Whether an aligned DKIM signature survives the route |
| `dmarc=fail` while DKIM passes | Alignment of every passing signature; a raw DKIM pass alone is insufficient |

## What next

[Read your aggregate reports](/guides/how-to-read-a-dmarc-aggregate-report/)
and test legitimate sources before tightening policy. Include infrequent mail
such as billing runs. Clean reports do not prove every route is safe.

For a Workspace domain whose users may post to Internet mailing lists,
`p=reject` is not a universal goal. If considering it despite that risk, monitor
with `p=none` for at least a month, then `p=quarantine` for an equally long
period, and assess the effects on those users before deciding.
