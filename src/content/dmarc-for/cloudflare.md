---
title: Set up SPF, DKIM & DMARC on Cloudflare DNS
seoTitle: SPF, DKIM & DMARC on Cloudflare DNS
provider: Cloudflare
description: Cloudflare hosts your DNS, not your mail — where to publish SPF, DKIM and DMARC, and the proxy and flattening settings that silently break DKIM.
publishDate: 2026-07-28
---

Cloudflare is the odd one out on this list, because **it is not where your mail
lives**. Your mailboxes are at [Google Workspace](/dmarc-for/google-workspace/),
[Microsoft 365](/dmarc-for/microsoft-365/), [GoDaddy](/dmarc-for/godaddy/) or
somewhere similar; Cloudflare is where the DNS records those services ask for get
published. So read this alongside your provider's page, not instead of it.

It earns a page of its own because Cloudflare has two features that break email
authentication in ways nothing in your provider's instructions warns you about, and
both fail silently.

## Where to edit records

**Dashboard → your domain → DNS → Records.** Each record has a *Proxy status*
column, shown as an orange or grey cloud. That column is the whole story below.

## The orange cloud breaks DKIM

Proxying is Cloudflare's core feature: traffic for that name routes through
Cloudflare instead of straight to your server. Only records that resolve to an
address can be proxied — **A, AAAA and CNAME** — and a proxied CNAME is *flattened*,
meaning Cloudflare answers with its own anycast IP addresses rather than returning
your CNAME.

That is fine for a website and fatal for DKIM. Microsoft 365 publishes DKIM as two
**CNAME** records:

```
selector1._domainkey  ->  selector1-yourdomain-com._domainkey.<prefix>.onmicrosoft.com
selector2._domainkey  ->  selector2-yourdomain-com._domainkey.<prefix>.onmicrosoft.com
```

A verifier needs to follow that CNAME to find the key. Proxy it and there is no
CNAME to follow — just an IP address, which is not a DKIM key. Signatures stop
validating, and because the record still *exists* in the dashboard, nothing looks
wrong.

**So: every email record stays DNS-only (grey cloud).** Cloudflare knows this well
enough to warn you, and in some cases to refuse outright — it will show a warning or
prevent proxying for records it recognises as DKIM validation. Don't rely on it
catching yours.

One piece of good news: **SPF and DMARC cannot be proxied at all.** They are `TXT`
records, and only A, AAAA and CNAME are proxyable, so there is no orange cloud to
get wrong. This trap is DKIM-specific, and specifically about CNAME-based DKIM.

## CNAME flattening breaks it the same way

Separate setting, same outcome, and this one has no orange cloud to notice.

Flattening resolves a CNAME chain down to an address and returns that. It is **on by
default at the zone apex** — harmless, since nobody puts DKIM there — but paid plans
can flatten **all** CNAME records, or individual ones. Cloudflare's own caution is
about third-party verification CNAMEs: turning it on for all records "may cause the
verification to fail since the CNAME record itself will not be returned directly."

DKIM breaks for exactly that reason. If DKIM stopped validating and nobody touched
the DKIM records, check whether flattening was switched to all-CNAMEs — the change
is a zone-wide setting, so it breaks every CNAME-based selector at once and looks
like a provider outage rather than a DNS change.

## Email Routing rewrites your SPF story

Cloudflare Email Routing forwards mail for your domain to an existing mailbox. Turn
it on and it wants three things: **MX records pointing at Cloudflare**, a DKIM
record, and this SPF include:

```
v=spf1 include:_spf.mx.cloudflare.net ~all
```

Three consequences worth knowing before you enable it:

- **You cannot run it alongside an external mail server.** Email Routing requires
  Cloudflare's MX records, so it is not something to switch on "to try" while
  Microsoft 365 or Workspace is handling your mail.
- **Merge that include, don't add it.** If you already publish SPF, edit the existing
  record to include both. A second `v=spf1` record is a `permerror`, which counts as
  an SPF failure — see [SPF record syntax](/guides/spf-record-syntax/).
- **It costs one of your ten lookups.** `include:_spf.mx.cloudflare.net` counts
  against the [10-lookup limit](/guides/spf-record-syntax/) like any other include,
  which matters if your record is already close to it.

## The DMARC record itself

Nothing Cloudflare-specific — a `TXT` record, DNS-only by nature:

```
Type: TXT   Name: _dmarc   Content: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Cloudflare appends your domain automatically, so the *Name* is `_dmarc`, not
`_dmarc.yourdomain.com`. Start at `p=none` and read reports before tightening:
[publish your first DMARC record](/guides/publish-your-first-dmarc-record/) walks
through it, and the [tag reference](/guides/dmarc-record-tags/) covers what every
tag defaults to.

If your reports go to a mailbox on a domain you don't control, that domain needs to
authorise it with a `_report._dmarc` record — the single most common reason a
correct-looking record produces no reports at all.

## Confirming it worked

```
dig +short TXT _dmarc.yourdomain.com
dig +short CNAME selector1._domainkey.yourdomain.com
```

The second one is the check that matters here. If it returns an **IP address**, or
nothing, the record is proxied or flattened rather than published — that is this
page's whole subject, and no amount of re-adding the record will fix it until the
proxy status is grey. Our [DKIM checker](/tools/dkim-checker/) reports the key it
actually finds, which is the fastest way to tell a proxy problem from a missing key.

## Cloudflare-specific gotchas

| Symptom | Usual cause |
|---|---|
| DKIM stopped validating, records unchanged | CNAME flattening switched to all CNAME records |
| `dig CNAME selector1._domainkey` returns an IP | The record is proxied — set it to DNS-only |
| `spf=permerror` right after enabling Email Routing | Two SPF records instead of one merged record |
| SPF suddenly over the lookup limit | The Email Routing include pushed it past 10 |
| Records look right but nothing resolves | Cloudflare isn't authoritative yet — the nameservers at your registrar still point elsewhere |

## What next

- Your mail provider's own records: [Google
  Workspace](/dmarc-for/google-workspace/), [Microsoft
  365](/dmarc-for/microsoft-365/), [GoDaddy](/dmarc-for/godaddy/).
- [Why your email is failing DMARC](/guides/fix-dmarc-failure/) if reports are
  already showing failures.
