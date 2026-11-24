---
term: DMARC aggregate report
description: A DMARC aggregate report (RUA) summarizes authentication results by sending IP. Learn what the XML contains, how to request it, and where coverage stops.
aliases: ["RUA", "aggregate report"]
related: ["dmarc", "dmarc-policy", "dmarc-alignment"]
---

A **DMARC aggregate report** (RUA) is an XML summary from a receiving mail
provider of messages claiming to be from your domain, grouped by sending IP
and authentication results. Reports typically cover one day. The format is
specified by [RFC 9990](/rfc/9990/). It does **not** contain message content; it is a statistical roll-up: sending IP, message count,
SPF/DKIM results, and the DMARC disposition. It is not an inbox-placement
report or a complete inventory of your outbound mail: reporting is optional,
and you only see what participating receivers report.

## Requesting reports

You request them with the `rua=` tag in your [DMARC](/glossary/dmarc/) record.
First check whether your domain already has a record or inherits a policy from
an ancestor domain. If either applies, add or update `rua` in that existing
record at the policy domain without replacing its policy or other tags.
Publishing a new `p=none` record at a subdomain overrides its inherited policy.

If no existing or inherited policy applies, start monitoring with a mailbox
you control:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Make sure the mailbox can receive the attachments. Three details matter:

- **Compression is recommended.** The XML should be GZIP-compressed and attached as
  `application/gzip`; a receiver that sends it uncompressed uses `text/xml`,
  which is allowed but discouraged, because a large report can exceed the
  receiving server's size limit and simply never be delivered. The filename
  carries the reporting receiver, your domain, the start and end timestamps, and
  sometimes a unique id —
  `mail.receiver.example!yourdomain.com!1013662812!1013749130.xml.gz`.
- **A reporting day is normally UTC.** The period typically covers a single
  UTC day starting at 00:00 UTC; that is the period described by the XML, not a
  delivery deadline. The former interval-request tag, `ri=`, is no longer part
  of the specification. Reports can arrive late or fail to arrive.
- **An external destination has to authorize reports.** When its organizational
  domain differs from the organizational domain of the policy domain, the
  destination must publish a matching `_report._dmarc` TXT authorization. Without
  confirmation, receivers must ignore that destination. A mailbox within the
  same organizational domain needs no external authorization, but still has to
  accept mail. See the [agency setup](/guides/dmarc-multiple-client-domains/)
  for the DNS record.

## What's inside a record

Each `<record>` groups messages by sending source and `From:` domain, and
reports the DMARC disposition and alignment outcome:

```xml
<record>
  <row>
    <source_ip>203.0.113.10</source_ip>
    <count>42</count>
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
      <domain>yourdomain.com</domain>
      <result>fail</result>
    </spf>
  </auth_results>
</record>
```

All three children are required. `<identifiers>` carries the message's
`From:` domain, which can be a subdomain inheriting a parent domain's policy.
`<auth_results>` carries the raw SPF and DKIM results; a `pass`
inside `<policy_evaluated>` means authentication **and**
[alignment](/glossary/dmarc-alignment/) succeeded for that mechanism. Here, DKIM passes and aligns, so DMARC
passes even though SPF fails. The `none` disposition does not prove inbox
delivery.

Reading these by hand across many domains does not scale. The self-hosted
[DMARC Analyzer](/) groups reports by domain and sending source,
with raw authentication results alongside DMARC compliance. See
[how to read a DMARC aggregate report](/guides/how-to-read-a-dmarc-aggregate-report/).

## Providers don't all implement the schema identically

The current schema leaves some fields optional. `<policy_published>` requires
only the domain and `p`; `sp`, `np`, `adkim` and `aspf` turn up only when the receiver
echoes them. A `<record>` can arrive with no `<envelope_from>`, and with
`<auth_results>` carrying no `<dkim>` child when no signature was checked.
The container is required; individual authentication results can be absent.
The superseded schema made the DKIM `<selector>` optional, so an older reporter can tell you a signature failed without telling
you which key — the current one requires it.

Missing optional fields do not invalidate a report; missing required fields
are a format error, even if a parser can salvage some data. File names are
another source of variation: the unique id is optional and not every receiver
builds the name exactly as specified, so tooling that reads the filename instead
of the XML inside it breaks on the next provider. Parse the document, and treat
every optional element as absent until the report proves otherwise — a parser
written for one provider's exact output quietly drops rows from another's.
