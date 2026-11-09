---
title: How to read a DMARC aggregate report
description: A field guide to the XML in RUA reports — what each tag means, which rows need action, and how to turn a daily flood into a short to-do list.
publishDate: 2026-07-15
---

[Aggregate reports](/glossary/dmarc-aggregate-report/) are XML, verbose, and
arrive daily from every mailbox provider. The format is specified by
[RFC 9990](/rfc/9990/) — split out of the main DMARC document in 2026, so that
is what to cite in a bug report rather than the [obsolete
original](/rfc/7489/). Once you know the shape, though, each one answers a
single question: *who sent mail as my domain, and did it authenticate?*

> Want to see it in action? Paste a report into the free [DMARC report
> analyzer](/tools/dmarc-report-analyzer/) — it parses in your browser, nothing
> uploaded.

## The envelope

The top of the report says who generated it and which policy they saw
published:

```xml
<report_metadata>
  <org_name>google.com</org_name>
  <email>noreply-dmarc-support@google.com</email>
  <report_id>...</report_id>
  <date_range><begin>...</begin><end>...</end></date_range>
</report_metadata>
<policy_published>
  <domain>yourdomain.com</domain>
  <p>none</p>
</policy_published>
```

## The rows are where the signal is

Each `<record>` groups messages by sending source and `From:` domain:

```xml
<record>
  <row>
    <source_ip>203.0.113.10</source_ip>
    <count>128</count>
    <policy_evaluated>
      <disposition>none</disposition>
      <dkim>pass</dkim>
      <spf>fail</spf>
    </policy_evaluated>
  </row>
  <identifiers>
    <header_from>yourdomain.com</header_from>
  </identifiers>
  <auth_results>
    <dkim>
      <domain>yourdomain.com</domain>
      <selector>s1</selector>
      <result>pass</result>
    </dkim>
    <spf>
      <domain>bounces.esp.example</domain>
      <result>pass</result>
    </spf>
  </auth_results>
</record>
```

Read it as: *128 messages from 203.0.113.10; DKIM passed and aligned, SPF did
not.* Because [DMARC](/glossary/dmarc/) passes when **either** mechanism passes
and [aligns](/glossary/dmarc-alignment/), this row is a **DMARC pass** — the
mail is delivering on DKIM alone, which is worth repairing before you tighten
policy, but it is not losing mail today.

All three children of `<record>` are required, and the two outside `<row>` are
the ones that answer *why*. `<identifiers>` carries the `From:` domain the
policy was looked up on. `<auth_results>` carries what SPF and DKIM actually
returned, before DMARC asked whether either one aligned — and the gap between
the two blocks is this row's whole story. SPF **passed**, for
`bounces.esp.example`, and `<policy_evaluated>` still says `fail`, because that
domain is not the one in `<header_from>`. Judge a row on `<policy_evaluated>`
alone and a perfectly healthy SPF record looks broken; that mismatch is the
[alignment trap](/guides/fix-dmarc-failure/), and `<auth_results>` is the only
place in the report that shows it.

## Which rows actually need action

- **Both `pass`** — legitimate, aligned mail. Ignore.
- **One `pass`, one `fail`** — usually fine (DMARC still passes), but worth
  fixing the failing mechanism before you tighten policy.
- **Both `fail`, but you recognise the source** — a legitimate sender you
  forgot to authenticate. Add it to [SPF](/glossary/spf/) or set up
  [DKIM](/glossary/dkim/) for it.
- **Both `fail`, unfamiliar source** — either shadow IT or someone spoofing your
  domain. This is exactly what DMARC exists to surface.
- **Both `fail`, and the source is a forwarder or a mailing list** — legitimate
  mail taking a route that breaks authentication. These rows never go away, so
  they must not gate enforcement; [ARC](/glossary/arc/) explains why, and why it
  is not the fix people hope it is.

## Doing this at scale

One domain is readable by hand. A portfolio of client domains, each with dozens
of sources and a report from every provider every day, is not — that is what a
self-hosted analyzer like [DMARC Analyzer](/) aggregates for you, every domain in
one dashboard. The DNS and process side of running that portfolio is its own job:
see [DMARC for many client domains](/guides/dmarc-multiple-client-domains/). When the "both fail, legitimate" rows are
gone, you are ready to
[move toward enforcement](/guides/from-monitoring-to-enforcement/).
