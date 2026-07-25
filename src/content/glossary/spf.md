---
term: SPF
description: SPF is a DNS record listing which servers are allowed to send mail for your domain, so receivers can reject forgeries from everywhere else.
aliases: ["Sender Policy Framework"]
related: ["dkim", "dmarc", "dmarc-alignment"]
---

**SPF** (Sender Policy Framework) is a `TXT` record that lists the servers
authorised to send mail for your domain. A receiving server checks the
connecting server's IP against that list and marks the message as an SPF pass or
fail.

```
v=spf1 include:_spf.google.com include:sendgrid.net -all
```

- `include:` pulls in another sender's authorised ranges (your ESP, for example).
- `-all` means "reject everything not listed"; `~all` is a softer "mark as suspicious".

SPF alone is easy to bypass, because it checks the hidden envelope sender, not
the `From:` address a person sees. That gap is why
[DMARC](/glossary/dmarc/) adds [alignment](/glossary/dmarc-alignment/) and pairs
SPF with [DKIM](/glossary/dkim/).

> **Watch the 10-lookup limit.** SPF permits at most 10 DNS lookups; too many
> `include:`s cause a `permerror` and an SPF failure. Flatten or consolidate
> includes if you hit it.
