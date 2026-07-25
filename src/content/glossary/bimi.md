---
term: BIMI
description: BIMI (Brand Indicators for Message Identification) displays your brand logo beside authenticated email — but only once your domain is at DMARC enforcement.
aliases: ["BIMI record", "Brand Indicators for Message Identification"]
related: ["dmarc", "dmarc-policy", "dkim"]
---

**BIMI** (Brand Indicators for Message Identification) is a standard that
displays your **brand logo** next to your messages in supporting inboxes (Gmail,
Apple Mail, Yahoo, and others). It's the visible reward for getting email
authentication right.

BIMI is published as a `TXT` record at `default._bimi.yourdomain.com` pointing to
your logo:

```
v=BIMI1; l=https://yourdomain.com/logo.svg; a=https://yourdomain.com/vmc.pem
```

- **`l=`** — an HTTPS URL to your logo, in a specific **SVG Tiny PS** format.
- **`a=`** — link to a **Verified Mark Certificate (VMC)**, which several
  providers (notably Gmail) require before showing the logo.

`default` is the selector. A message can name a different one with a
`BIMI-Selector` header, which is how a brand runs distinct logos for, say,
transactional and marketing streams.

## The catch: BIMI needs DMARC enforcement

BIMI only works if your domain is already at **enforcement** — a
[DMARC](/glossary/dmarc/) [policy](/glossary/dmarc-policy/) of `p=quarantine` or
`p=reject`, not `p=none`. In other words, BIMI is a reason to *finish* your DMARC
rollout, not a shortcut around it.

Two details beyond the policy value itself:

- The policy must apply to **all** your mail. A partial rollout via `pct=`
  disqualifies the domain.
- Check `sp=` as well. A root at `p=reject` with `sp=none` leaves subdomains
  unenforced, and mail from those subdomains won't qualify.

## The logo has strict requirements

Not any SVG will do. It must be **SVG Tiny Portable/Secure (SVG Tiny PS)** —
a deliberately restricted profile with no scripts, no external references, and
no animation. In practice:

- Square aspect ratio, with a solid (non-transparent) background
- Centred artwork that stays legible when rendered very small
- Served over HTTPS

Most brand SVGs need converting rather than uploading as-is.

## VMC: the expensive part

A **Verified Mark Certificate** proves the logo is really yours. It's issued by
a small number of certificate authorities, generally requires a **registered
trademark**, involves identity verification, and carries an annual cost — this,
not the DNS record, is what stops most organisations.

A related **Common Mark Certificate (CMC)** covers marks without trademark
registration, but provider support differs from VMC support, so check what your
target inboxes accept before buying either.

Support varies by provider: some display a BIMI logo without a certificate,
while Gmail requires one. The record is harmless either way — an unsupported
inbox simply ignores it.

## Why the logo isn't showing

| Cause | Check |
|---|---|
| Policy still `p=none` | The domain isn't at enforcement |
| `pct=` below 100 | Partial enforcement disqualifies the domain |
| `sp=none` on the root | Subdomain mail isn't enforced |
| No VMC | Required by Gmail and some others |
| Logo rejected | Not valid SVG Tiny PS, or not square |
| Message failed DMARC | BIMI applies only to mail that passes |

The usual answer is the first row. The typical order is: authenticate with SPF
and [DKIM](/glossary/dkim/) → move DMARC to enforcement → prepare an SVG Tiny PS
logo (and a VMC if you want Gmail) → publish the BIMI record. Getting to
enforcement is the real work — see [from monitoring to
enforcement](/guides/from-monitoring-to-enforcement/).
