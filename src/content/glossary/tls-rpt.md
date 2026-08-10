---
term: TLS-RPT
seoTitle: "TLS-RPT: reports on TLS delivery failures"
description: TLS-RPT asks sending servers to report when encrypted delivery to your domain fails. It is the reporting half of MTA-STS, published at _smtp._tls.
aliases: ["TLS-RPT record", "SMTP TLS Reporting", "TLSRPTv1"]
related: ["mta-sts", "dmarc-aggregate-report", "dmarc"]
---

**TLS-RPT** (SMTP TLS Reporting, [RFC 8460](/rfc/8460/)) is a `TXT` record asking the servers that send
you mail to report whether their connections to your mail servers were encrypted
and verified. Like [MTA-STS](/glossary/mta-sts/), and unlike
[DMARC](/glossary/dmarc/), it is about mail *arriving at* your domain — the
reports come from other people's outbound servers, describing how delivery to you
went.

The record lives at `_smtp._tls` under your domain:

```
_smtp._tls.yourdomain.com.  IN  TXT  "v=TLSRPTv1; rua=mailto:tls-reports@yourdomain.com"
```

`rua=` is **required** here, which is the one syntax difference worth
remembering: a DMARC record without `rua=` is still a valid policy, but a TLS-RPT
record without a destination does nothing at all. Both `mailto:` and `https:`
destinations are allowed, and you can give a comma-separated list.

## What the reports contain

Gzipped JSON, one report per sender per UTC day, with success and failure counts
per MX host — and, when something failed, a named reason. That list is the reason
to publish it:

| Result type | What went wrong |
|---|---|
| `starttls-not-supported` | Your MX offered no STARTTLS, so the session stayed in the clear |
| `certificate-host-mismatch` | The certificate doesn't cover the MX hostname |
| `certificate-expired` | Expired certificate |
| `certificate-not-trusted` | Chain the sender couldn't validate |
| `sts-policy-fetch-error` | Your MTA-STS policy couldn't be retrieved |
| `sts-webpki-invalid` | Your MTA-STS policy failed certificate validation |
| `dane-required`, `tlsa-invalid`, `dnssec-invalid` | DANE and DNSSEC problems |

Note what that buys you: not "TLS is broken" but *which of your MX hosts* is
broken, and how — the diagnosis, not just the symptom.

## It reports; it does not enforce

TLS-RPT changes nothing about how mail is delivered. MTA-STS is the half that
makes a sending server refuse to fall back to an unencrypted connection; TLS-RPT
is how you find out it is doing so. Publish TLS-RPT **before** moving MTA-STS from
`testing` to `enforce`, because after that switch a certificate problem stops mail
rather than degrading it, and the reports are your only warning.

## No authorization record needed

Pointing a DMARC `rua=` at a mailbox on another domain requires that domain to
publish a `_report._dmarc` record authorising it — see
[reports won't arrive if `rua=` is wrong](/guides/no-dmarc-record-found/). TLS-RPT
has no equivalent: you can send TLS reports to any destination without a second
record. Convenient, and worth knowing, because the two look so similar that
people assume the DMARC rule applies here too and go hunting for a record that
was never required.

## Use a different mailbox from your DMARC reports

TLS reports arrive as mail with an attachment, exactly like aggregate reports, so
the obvious move is to point both at one inbox. Whether that works depends on your
tooling: a reader that only understands DMARC counts every TLS report as a
[parse failure](/docs/troubleshooting/), and the count stops meaning "something is
wrong". [DMARC Analyzer](/) recognises both types in one mailbox and counts them
separately, so a shared inbox stays readable.

TLS-RPT and MTA-STS are the transport-security story you start *after* DMARC
reaches enforcement — the two solve different problems, and DMARC is the one that
stops people sending as you. If you are not there yet, start with
[monitoring to enforcement](/guides/from-monitoring-to-enforcement/). If you are,
the next step is [MTA-STS: from testing to
enforce](/guides/mta-sts-testing-to-enforce/).
