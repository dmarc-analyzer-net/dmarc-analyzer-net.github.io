---
term: BIMI
seoTitle: "BIMI: your logo in authenticated email"
description: BIMI lets supporting inboxes show your brand logo beside authenticated email. Learn the DMARC enforcement, SVG logo and certificate requirements.
aliases: ["BIMI record", "Brand Indicators for Message Identification"]
related: ["dmarc", "dmarc-policy", "dkim"]
---

**BIMI** (Brand Indicators for Message Identification) lets supporting inboxes
display your **brand logo** beside authenticated messages. You publish a DNS
record pointing to the logo, but DMARC enforcement and the inbox provider's
requirements determine whether it can appear. Publishing the record does not
guarantee display.

BIMI is specified in a [working Internet-Draft](https://datatracker.ietf.org/doc/html/draft-brand-indicators-for-message-identification),
rather than a published RFC.

## The BIMI record

Publish a `TXT` record at `default._bimi.yourdomain.com`:

```text
v=BIMI1; l=https://yourdomain.com/logo.svg; a=https://yourdomain.com/vmc.pem
```

- **`l=`** — an HTTPS URL to your logo, in **SVG Tiny PS** format.
- **`a=`** — an HTTPS URL to a certificate PEM file. Gmail accepts a
  **Verified Mark Certificate (VMC)** or a **Common Mark Certificate (CMC)**;
  providers that accept self-asserted logos may not require this tag.

`default` is the selector. A different selector lets a brand use distinct logos
for [transactional](/glossary/transactional-email/) and marketing streams.
For example, publish `marketing._bimi.yourdomain.com` and add
`BIMI-Selector: v=BIMI1; s=marketing` to those messages. Include that header in
the message's DMARC-aligned [DKIM](/glossary/dkim/) signature so receivers can
trust the selection.

## BIMI needs DMARC enforcement

Your [DMARC policy](/glossary/dmarc-policy/) must be `p=quarantine` or
`p=reject`, with enforcement on both the organizational domain and the
domain in the message's `From:` address. A subdomain's own enforcement record
does not compensate for an organizational domain still at `p=none`.

Check more than `p=`:

- **`sp=none`** leaves subdomains unenforced. BIMI's authentication rules also
  reject this setting on the organizational domain, even for mail from the
  organizational domain itself. Omit `sp=` to inherit `p=`, or set it to
  `quarantine` or `reject`.
- **Legacy `pct=` below 100** does not meet the
  [BIMI Group's deployment requirements](https://bimigroup.org/implementation-guide/).
  The current DMARC specification removed `pct`, though deployed receivers
  still use it; do not leave a partial rollout configured.
- **`t=y` is test mode**, defined in [RFC 9989](/rfc/9989/).
  It downgrades `quarantine` to `none` and `reject` to `quarantine`;
  it does not turn every policy into `none`. Finish testing and remove
  `t=y` (or use `t=n`) before deploying BIMI. Provider guidance still
  describes legacy `pct` checks, so do not assume uniform handling of the
  newer tag.

Before enforcing across many client domains, use **[DMARC Analyzer](/)** to
identify legitimate sending sources that still fail DMARC in aggregate reports.
Follow [from monitoring to enforcement](/guides/from-monitoring-to-enforcement/)
to fix those sources before changing policy.

## The logo has strict requirements

Use **SVG Tiny Portable/Secure (SVG Tiny PS)**, a restricted SVG profile
without scripts, external references or animation. Serve the file over HTTPS
without authentication or access restrictions.

Use square artwork, keep the logo centered and legible at small sizes, and
prefer a solid background. These are practical display recommendations;
a transparent background alone does not make an SVG invalid. Gmail adds
its own requirements, including a minimum width and height of 96 pixels
specified in absolute pixels.

## VMC or CMC: check the recipient requirements

A **VMC** verifies your organization's rights to the logo and generally
requires a registered trademark. A **CMC** provides a route for logos without
trademark registration, subject to the issuer's validation requirements.

[Gmail accepts either certificate](https://knowledge.workspace.google.com/admin/security/set-up-bimi?hl=en).
A VMC also enables Gmail's verified checkmark; a CMC does not provide that
checkmark. Check eligibility and renewal costs with the issuer before buying.

[Apple Mail requires both the sender and the mailbox provider to meet its
BIMI requirements](https://support.apple.com/en-us/108340). Its documentation
describes VMCs and other BIMI evidence documents; support in the Mail app
does not mean every account viewed in that app will show a logo.
Yahoo can display self-asserted logos without a certificate, subject to its
own display criteria.

## Check which inboxes support BIMI

The [BIMI Group's provider list](https://bimigroup.org/bimi-infographic/)
lists Microsoft as not supporting BIMI (the list is dated May 2025).
Do not budget for a certificate expecting BIMI logos in Outlook or
Microsoft 365. Other branding features are separate from BIMI.

Supporting providers can still withhold a logo based on reputation or their
display rules. Match the provider requirements to your actual recipients
before investing in a certificate.

## Why the logo isn't showing

| Cause | Check |
|---|---|
| DMARC enforcement incomplete | Check the organizational domain, the `From:` domain, `sp=`, legacy `pct=` and test mode |
| Certificate missing or invalid | Gmail requires a VMC or CMC; check the target provider's accepted evidence |
| Unsupported mailbox or client | Confirm BIMI support for the account and app being used |
| Logo or certificate cannot be fetched | Check HTTPS, public access and the SVG profile |
| Message failed authentication | Check its DMARC result; receivers may apply trusted-forwarder exceptions |
| Everything validates but no logo appears | Provider reputation thresholds, display rules or caching may still prevent it |

Authenticate your sending sources, finish DMARC enforcement, prepare the logo
and any required certificate, then publish the BIMI record. BIMI adds a display
signal to authenticated mail; it does not guarantee inbox placement.
