---
title: How to read a DMARC aggregate report
description: 'Read a DMARC aggregate report: decode the XML, separate authentication from alignment, and identify the sending sources that need action before enforcement.'
publishDate: 2026-07-15
updatedDate: 2026-11-14
---

A **DMARC aggregate report** ([RFC 9990](/rfc/9990/)) summarizes the mail a
receiving organization saw using your domain in the visible `From:` address.
Read the source IP, message count and aligned authentication results together
to find which senders need attention. Participating receivers typically send
reports daily when you request them with `rua=`; not every receiver reports,
so the data is not a complete census of your mail.

> Want to see it in action? Paste a report into the free [DMARC report
> analyzer](/tools/dmarc-report-analyzer/) — it parses in your browser, nothing
> uploaded.

## Start with the reporter, period and published policy

Inside the report's `<feedback>` root, `<report_metadata>` identifies the
reporter and reporting period. `<policy_published>` records the DMARC policy
they observed:

```xml
<report_metadata>
  <org_name>Example Receiver</org_name>
  <email>dmarc-support@receiver.example</email>
  <report_id>example-report-001</report_id>
  <date_range>
    <begin>1794528000</begin>
    <end>1794614399</end>
  </date_range>
</report_metadata>
<policy_published>
  <domain>yourdomain.com</domain>
  <p>none</p>
</policy_published>
```

`begin` and `end` are Unix timestamps in seconds, in UTC: this example covers
November 13, 2026. They describe the reporting window, not the first and last
message. `<count>` values later in the report belong to that window. Use the
reporter and report ID to spot duplicate submissions before adding volumes.

`<policy_published><domain>` is the domain where the policy was found. It can
differ from a row's `header_from` when a subdomain inherits policy. Here,
`<p>none</p>` requests monitoring rather than DMARC enforcement; it does not
mean the messages passed authentication.

## The rows are where the signal is

Each `<record>` groups messages by sending source, `From:` domain and result,
so one IP can appear in several records if its mail did not all authenticate
the same way:

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
not align.* Because [DMARC](/glossary/dmarc/) passes when **either** mechanism
passes and [aligns](/glossary/dmarc-alignment/), this row is a **DMARC pass**.
It relies on DKIM alone for that pass; the SPF record itself need not be broken.

All three children of `<record>` are required, and the two outside `<row>` are
the ones that answer *why*. `<identifiers>` carries the `From:` domain the
policy was looked up on. `<auth_results>` carries what SPF and DKIM actually
returned, before DMARC asked whether either one aligned — and the gap between
the two blocks is this row's whole story. SPF **passed**, for
`bounces.esp.example`, and `<policy_evaluated>` still says `fail`, because that
domain and the `<header_from>` share no organizational domain. It is not that
the two strings differ: relaxed alignment, the default, would have accepted
`mail.yourdomain.com` here. It will never accept another organization's domain,
however well its own SPF is set up. Compare the raw results with the aligned
results before changing DNS. For a sender you operate, a custom Return-Path
under your domain can align SPF; otherwise, keep its aligned DKIM working.
The [failure diagnosis guide](/guides/fix-dmarc-failure/) covers both routes.

`<auth_results>` can contain multiple DKIM results. One signature that both
verifies and aligns is enough for DMARC, even if another signature fails or
uses a different domain.

## Disposition is separate from authentication

`<policy_evaluated><disposition>` describes the DMARC handling applied. Values
include `none`, `quarantine` and `reject`; the current format also permits
`pass`. The example's `none` means no DMARC quarantine or rejection was applied.
It is not an authentication result: a failing row under `p=none` can also have
`disposition=none`.

When a receiver overrides the published policy for failing mail, `<reason>`
explains the exception, for example `local_policy`. Read it alongside the
SPF/DKIM results rather than treating the override as a pass. A DMARC pass or
`disposition=none` does not prove inbox delivery; other filtering can still
block mail, and the report does not show its final inbox or spam placement.

## Which rows actually need action

Use the `dkim` and `spf` values inside `<policy_evaluated>` for this triage,
then expand `<auth_results>` to diagnose failures. Start with high-volume
failures and business-critical senders; count messages, not XML rows.

- **Both `pass`** — DMARC passes. Confirm that the source belongs to a service
  you authorize; authentication alone does not establish that the content is
  wanted or the sending account is uncompromised.
- **One `pass`, one `fail`** — DMARC passes. For a known sender, investigate
  whether the other mechanism failed authentication or only alignment. An
  unaligned platform bounce domain does not require changing your apex SPF.
- **Both `fail`, source you operate** — check raw errors and identifiers.
  Authenticate and align the service with DKIM or an appropriate SPF setup;
  adding an SPF include alone will not fix an unaligned envelope domain.
- **Both `fail`, unfamiliar source** — investigate before authorizing it. It
  could be an overlooked service, a forwarder, or spoofing. Do not add an IP to
  SPF merely because it appears in a report.
- **Both `fail`, confirmed forwarder or mailing list** — assess the effect of
  enforcement on that route. Forwarding often breaks SPF; DKIM can survive
  unless signed content changes. [ARC](/glossary/arc/) can inform a receiver's
  local override, but it neither changes the DMARC result nor guarantees
  acceptance. Test important routes before tightening policy.

## Doing this at scale

One report is readable by hand. A portfolio of client domains brings reports
from many receivers, each with its own sources and reporting window.
[DMARC Analyzer](/) groups that data by domain in one dashboard; its
[source details](/docs/domain-detail/#sending-sources) show raw SPF/DKIM
results and the domains they authenticated alongside DMARC compliance.

For the DNS and process side, see
[DMARC for many client domains](/guides/dmarc-multiple-client-domains/).
Once you have checked known senders, covered infrequent sending cycles and
assessed forwarding and mailing-list risks, use the
[enforcement guide](/guides/from-monitoring-to-enforcement/) to plan the next
policy change. A clean reporting window is evidence, not proof that every
legitimate route is covered.
