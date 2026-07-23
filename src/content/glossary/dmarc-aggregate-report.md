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

You request them with the `rua=` tag in your [DMARC](/glossary/dmarc) record:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Each `<record>` in the XML groups messages by source and reports the
[alignment](/glossary/dmarc-alignment) outcome:

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
DMARC analyzer is for. See
[how to read a DMARC aggregate report](/guides/how-to-read-a-dmarc-aggregate-report).
