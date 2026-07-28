---
term: DMARC aggregate report
description: An aggregate (RUA) report is a daily XML summary from a mailbox provider showing every source that sent mail as your domain and how it authenticated.
aliases: ["RUA", "aggregate report"]
related: ["dmarc", "dmarc-policy", "dmarc-alignment"]
---

A **DMARC aggregate report** (RUA) is an XML file a mailbox provider sends —
typically once a day — summarising all the mail it saw claiming to be from your
domain. It does **not** contain message content; it is a statistical roll-up:
sending IP, message count, SPF/DKIM results, and the disposition applied.

You request them with the `rua=` tag in your [DMARC](/glossary/dmarc/) record:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Three practical details that the tag alone doesn't tell you:

- **They arrive gzipped.** The XML should be GZIP-compressed and attached as
  `application/gzip`, with a filename built from the reporting receiver, your
  domain, and the start and end timestamps — `receiver!yourdomain.com!1013662812!1013749130.xml.gz`.
  Uncompressed reports are allowed but discouraged, because a large one can exceed
  the receiving server's size limit and simply never be delivered.
- **Daily is what you get**, not what you asked for. There used to be a tag for
  requesting an interval, `ri=`; providers sent daily reports regardless, and the
  current specification has [removed it](/guides/dmarc-rfc-9989/).
- **If the mailbox is on another domain**, that domain has to authorise it with a
  `_report._dmarc` record, or conforming receivers discard the request silently —
  no bounce, no error, no reports. This is the single most common reason a
  perfect-looking record produces nothing; see
  [reports won't arrive if `rua=` is wrong](/guides/no-dmarc-record-found/), or
  the [agency treatment](/guides/dmarc-multiple-client-domains/) if you collect
  for domains you don't own.

Each `<record>` in the XML groups messages by source and reports the
[alignment](/glossary/dmarc-alignment/) outcome:

```xml
<record>
  <row>
    <source_ip>203.0.113.10</source_ip>
    <count>42</count>
    <policy_evaluated><dkim>pass</dkim><spf>fail</spf></policy_evaluated>
  </row>
</record>
```

Reading these by hand across many domains does not scale — which is what a
self-hosted analyzer like [DMARC Analyzer](/) is for. See
[how to read a DMARC aggregate report](/guides/how-to-read-a-dmarc-aggregate-report/).
