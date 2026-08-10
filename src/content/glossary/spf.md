---
term: SPF
seoTitle: "SPF (Sender Policy Framework)"
description: SPF is a DNS record listing which servers are allowed to send mail for your domain, so receivers can reject forgeries from everywhere else.
aliases: ["Sender Policy Framework"]
related: ["dkim", "dmarc", "dmarc-alignment"]
---

**SPF** (Sender Policy Framework, [RFC 7208](/rfc/7208/)) is a `TXT` record that lists the servers
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
SPF with [DKIM](/glossary/dkim/). It also breaks on plain forwarding, where the
forwarder relays your mail from an address that was never in your record.

## The 10-lookup limit

A record may cause at most **10** DNS lookups while it is being evaluated. Exceed
it and the result is `permerror`, which counts as an SPF failure — and it happens
silently, because nothing bounces and the record still looks perfectly valid.

Six terms count toward the limit, not just `include:`:

| Counts | Doesn't count |
|---|---|
| `include:`, `a`, `mx`, `ptr`, `exists:`, `redirect=` | `ip4:`, `ip6:`, `all`, `exp=` |

Two sub-limits sit underneath it and catch people out, because a term count of 1
looks safe: evaluating `mx` must not require more than 10 address lookups, and the
same applies to `ptr`. A domain with a dozen MX hosts therefore `permerror`s on a
single `mx` term.

The practical consequence is that `ip4:`/`ip6:` ranges are free while every
`include:` you add is not, so the fix for a record at the limit is to replace
includes with the address ranges behind them, or to drop senders you no longer
use. The [SPF record checker](/tools/spf-checker/) expands every include
recursively and gives you the real count.

## One record per domain, not one per sender

A domain may publish only **one** `v=spf1` TXT record. Adding a second one for
a new sender — a common result of onboarding a new mail platform without
touching the existing record — leaves two SPF records at the same name, and
receivers `permerror` that exactly as they would a record over the lookup
limit. The fix is a single record combining every sender with `include:`, not
a second one alongside the first.
