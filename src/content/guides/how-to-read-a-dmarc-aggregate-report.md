---
title: How to read a DMARC aggregate report
description: A field guide to the XML in RUA reports — what each tag means, which rows need action, and how to turn a daily flood into a short to-do list.
publishDate: 2026-07-15
---

[Aggregate reports](/glossary/dmarc-aggregate-report) are XML, verbose, and
arrive daily from every mailbox provider. Once you know the shape, though, each
one answers a single question: *who sent mail as my domain, and did it
authenticate?*

> Want to see it in action? Paste a report into the free [DMARC report
> analyzer](/tools/dmarc-report-analyzer) — it parses in your browser, nothing
> uploaded.

## The envelope

The top of the report says who generated it and which policy they saw
published:

```xml
<report_metadata>
  <org_name>google.com</org_name>
  <date_range><begin>...</begin><end>...</end></date_range>
</report_metadata>
<policy_published>
  <domain>yourdomain.com</domain>
  <p>none</p>
</policy_published>
```

## The rows are where the signal is

Each `<record>` groups messages by sending source:

```xml
<record>
  <row>
    <source_ip>203.0.113.10</source_ip>
    <count>128</count>
    <policy_evaluated>
      <dkim>pass</dkim>
      <spf>fail</spf>
    </policy_evaluated>
  </row>
</record>
```

Read it as: *128 messages from 203.0.113.10; DKIM passed and aligned, SPF did
not.* Because [DMARC](/glossary/dmarc) passes when **either** mechanism passes
and [aligns](/glossary/dmarc-alignment), this row is a **DMARC pass** — no
action needed.

## Which rows actually need action

- **Both `pass`** — legitimate, aligned mail. Ignore.
- **One `pass`, one `fail`** — usually fine (DMARC still passes), but worth
  fixing the failing mechanism before you tighten policy.
- **Both `fail`, but you recognise the source** — a legitimate sender you
  forgot to authenticate. Add it to [SPF](/glossary/spf) or set up
  [DKIM](/glossary/dkim) for it.
- **Both `fail`, unfamiliar source** — either shadow IT or someone spoofing your
  domain. This is exactly what DMARC exists to surface.

## Doing this at scale

One domain is readable by hand. A portfolio of client domains, each with dozens
of sources and a report from every provider every day, is not — that is what a
self-hosted analyzer like [DMARC Analyzer](/) aggregates for you, every domain in
one dashboard. When the "both fail, legitimate" rows are
gone, you are ready to
[move toward enforcement](/guides/from-monitoring-to-enforcement).
