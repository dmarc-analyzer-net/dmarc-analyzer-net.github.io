---
term: DMARC aggregate report
description: A DMARC aggregate report (RUA) is a daily XML summary of the mail one provider saw claiming to be from your domain, and how each sending source authenticated.
aliases: ["RUA", "aggregate report"]
related: ["dmarc", "dmarc-policy", "dmarc-alignment"]
---

A **DMARC aggregate report** (RUA) is an XML file a mailbox provider sends —
typically once a day — summarising all the mail it saw claiming to be from your
domain. The format is specified by [RFC 9990](/rfc/9990/). It does **not**
contain message content; it is a statistical roll-up: sending IP, message count,
SPF/DKIM results, and the disposition applied.

## Requesting reports

You request them with the `rua=` tag in your [DMARC](/glossary/dmarc/) record:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Three practical details that the tag alone doesn't tell you:

- **They arrive gzipped.** The XML should be GZIP-compressed and attached as
  `application/gzip`; a receiver that sends it uncompressed uses `text/xml`,
  which is allowed but discouraged, because a large report can exceed the
  receiving server's size limit and simply never be delivered. The filename
  carries the reporting receiver, your domain, the start and end timestamps, and
  sometimes a unique id —
  `mail.receiver.example!yourdomain.com!1013662812!1013749130.xml.gz`.
- **Daily is what you get**, not what you asked for. A reporting period normally
  covers a single UTC day starting at 0000 UTC, which is why the timestamps
  rarely line up with your own midnight. There used to be a tag for requesting an
  interval, `ri=`; providers sent daily reports regardless, and the current
  specification has [removed it](/guides/dmarc-rfc-9989/).
- **A mailbox outside your organizational domain has to opt in.** An agency or
  vendor address only works if that domain publishes a `_report._dmarc` record
  authorising it; without one, conforming receivers discard the request silently —
  no bounce, no error, no reports. An address under your own domain needs
  nothing. This is the single most common reason a perfect-looking record
  produces nothing; see
  [reports won't arrive if `rua=` is wrong](/guides/no-dmarc-record-found/), or
  the [agency treatment](/guides/dmarc-multiple-client-domains/) if you collect
  for domains you don't own.

## What's inside a record

Each `<record>` groups messages by sending source and `From:` domain, and
reports what the receiver did with them alongside the
[alignment](/glossary/dmarc-alignment/) outcome:

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

All three children are required, and the two outside `<row>` are the ones
tooling most often forgets: `<identifiers>` carries the `From:` domain the
policy was looked up on, and `<auth_results>` carries what SPF and DKIM actually
returned, before DMARC asked whether either one aligned.

Reading these by hand across many domains does not scale — which is what a
self-hosted analyzer like [DMARC Analyzer](/) is for. See
[how to read a DMARC aggregate report](/guides/how-to-read-a-dmarc-aggregate-report/).

## Providers don't all implement the schema identically

The schema leaves a lot optional. `<policy_published>` has to carry only the
domain and `p`; `sp`, `np`, `adkim` and `aspf` turn up only when the receiver
echoes them. A `<record>` can arrive with no `<envelope_from>`, and with
`<auth_results>` carrying no `<dkim>` child at all — the element is required but
its DKIM results are not. And the superseded schema made the DKIM `<selector>`
optional, so an older reporter can tell you a signature failed without telling
you which key — the current one requires it.

File names are the other trap: the unique id is optional and not every receiver
builds the name exactly as specified, so tooling that reads the filename instead
of the XML inside it breaks on the next provider. Parse the document, and treat
every optional element as absent until the report proves otherwise — a parser
written for one provider's exact output quietly drops rows from another's.
