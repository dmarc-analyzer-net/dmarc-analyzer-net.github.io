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

- **`l=`** — an HTTPS URL to your logo, in a specific **SVG Tiny PS** format
  (square, solid background).
- **`a=`** — optional link to a **Verified Mark Certificate (VMC)**, which many
  providers (notably Gmail) require before showing the logo.

## The catch: BIMI needs DMARC enforcement

BIMI only works if your domain is already at **enforcement** — a
[DMARC](/glossary/dmarc) [policy](/glossary/dmarc-policy) of `p=quarantine` or
`p=reject`, not `p=none`. In other words, BIMI is a reason to *finish* your DMARC
rollout, not a shortcut around it.

The typical order is: authenticate with SPF and [DKIM](/glossary/dkim) → move
DMARC to enforcement → prepare an SVG logo (and a VMC if you want Gmail) →
publish the BIMI record. If your logo isn't appearing, the usual cause is a
policy still at `p=none` — see [from monitoring to
enforcement](/guides/from-monitoring-to-enforcement).
