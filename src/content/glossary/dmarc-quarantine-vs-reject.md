---
term: DMARC quarantine vs reject
description: Compare DMARC quarantine vs reject, receiver discretion, subdomain policies and test mode. Check legitimate mail routes before tightening enforcement.
aliases: ["quarantine vs reject", "p=quarantine vs p=reject"]
related: ["dmarc-policy", "dmarc", "dmarc-alignment", "arc"]
---

The difference in **DMARC quarantine vs reject** is the treatment you request
for mail that fails DMARC: mark it as suspicious, or refuse it. These are the
two enforcing [DMARC policies](/glossary/dmarc-policy/), defined in
[RFC 9989](/rfc/9989/).

- **`p=quarantine`** — request suspicious-mail handling, commonly delivery to
  the **spam/junk** folder. A receiver may use other handling, such as extra
  scrutiny or a warning.
- **`p=reject`** — request refusal, normally during the SMTP transaction. When
  the receiver rejects the message, it is not delivered there; the sending
  server receives the refusal and handles any notification to the sender.

The third policy, `p=none`, requests no DMARC-based enforcement. Add `rua=`
to request aggregate reports; reporting is separate from the policy choice.

DMARC fails when completed checks produce no SPF or DKIM pass that
[aligns](/glossary/dmarc-alignment/) with the visible `From:` domain. One
aligned pass is enough. If a required DNS query errors and neither mechanism
produces an aligned pass, the result is indeterminate: neither pass nor fail,
so the failure policy cannot apply. A DMARC pass avoids the failure policy,
but **does not guarantee delivery**: receivers still apply spam and other local
checks.

## When to use each

- Use **`quarantine`** as a cautious step after monitoring and fixing known
  legitimate senders. It can make a missed sender easier to recover from than
  rejection, but mail in spam can still go unnoticed.
- Consider **`reject`** when legitimate sending sources and important forwarding
  routes have been checked and the remaining delivery risk is acceptable.
  Your messages must carry valid, aligned DKIM signatures; do not rely solely
  on SPF. It gives receivers a stronger signal against unauthorized use of your
  `From:` domain. It does not stop lookalike-domain or display-name spoofing.

**Reject is not a universal destination.** Domains whose users post to Internet
mailing lists need particular care: the current standard advises against
`p=reject` for those domains because indirect delivery can fail DMARC. If you
choose it anyway, assess the impact and warn users about affected routes.

## A policy is a request, not a guarantee

Final handling belongs to the receiver. It may accept a DMARC failure despite
`p=reject`, or filter a message that passes. The current standard requires
receivers to combine a reject policy with other knowledge and analysis rather
than reject solely on that policy. Neither setting guarantees a particular
folder or delivery outcome.

## Legacy `pct=` and current test mode

`pct=` is a **legacy sampling tag**, removed from the current specification.
Under the older behavior, `p=reject; pct=25` requested rejection for roughly a
quarter of failing messages and quarantine for the rest. With
`p=quarantine; pct=25`, messages outside the sample received normal local
classification, which could still put them in spam.

Values between 0 and 100 were applied inconsistently. **Do not rely on a
percentage ramp to limit delivery risk across receivers.** The current
replacement, `t=`, has two values:

- **`t=y`** requests test handling one level below the stated policy:
  `reject` becomes `quarantine`, and `quarantine` becomes `none`.
- **`t=n`**, the default, requests the stated policy. These values correspond
  to the old `pct=0` and `pct=100` behavior, not intermediate percentages.

For a receiver implementing the current specification, this requests quarantine
handling while testing a reject policy:

```
v=DMARC1; p=reject; t=y; rua=mailto:dmarc@yourdomain.com
```

A receiver that does not recognize `t=` ignores it and can apply `p=reject`.
Test mode is therefore **not a safe substitute for monitoring first**. See
[what changed in the new standard](/guides/dmarc-rfc-9989/).

## Don't forget subdomains

At your organizational domain, `p=` also supplies the default subdomain policy.
Use `sp=` to request different treatment for existing subdomains:

```
v=DMARC1; p=reject; sp=quarantine; rua=mailto:dmarc@yourdomain.com
```

A valid DMARC record directly on a subdomain supplies its own policy. Otherwise,
policy discovery determines the applicable organizational-domain record;
`sp=` there governs existing subdomains, falling back to `p=` when absent.
Publishing `sp=` on an ordinary subdomain does not control its descendants.

For nonexistent subdomains, `np=` takes precedence, falling back to `sp=` and
then `p=`. Nonexistent means **NXDOMAIN**: a name with a record at or beneath
it, including a DKIM key, counts as existing. A missing MX record alone does
not make a name nonexistent.

`np=reject` can tighten treatment for nonexistent names while existing names
remain at quarantine. Check for misconfigured legitimate senders using such
names before changing it. The [tag reference](/guides/dmarc-record-tags/)
covers these settings.

## What breaks at enforcement

Two legitimate routes need testing even when your own DNS is correct:

- **Forwarding** can break SPF when the original envelope domain is retained,
  because mail arrives from the forwarder's IP. Rewriting the envelope domain
  may restore SPF for the forwarder without aligning it with your `From:`.
  A surviving passing, aligned DKIM signature can still satisfy DMARC.
- **Mailing lists** can change signed content and break DKIM too. Some rewrite
  `From:` and authenticate as the list's domain.
  [ARC](/glossary/arc/) can preserve earlier authentication assessments, but
  whether a receiver trusts them is its choice; ARC does not create a DMARC
  pass or guarantee delivery.

Read your [aggregate reports](/glossary/dmarc-aggregate-report/), investigate
failing sources and test important routes before tightening. Reports cover
participating receivers and arrive after delivery decisions; a clean window
does not prove every legitimate route works. A failure alone does not prove
spoofing. [DMARC Analyzer](/) groups received reports by sending source and
shows the reported authentication results and domains in the
[domain detail view](/docs/domain-detail/) to support that investigation.

## Moving between them safely

Start with monitoring, fix legitimate failures, then assess quarantine before
reject. Include infrequent senders and important forwarding and mailing-list
routes in that assessment. For domains with users who may post to mailing
lists, the standard recommends at least a month at `none` and an equally long
period at `quarantine` before considering reject.

Before changing anything, use the [DMARC record checker](/tools/dmarc-checker/)
to read the published record, including `pct=`, `t=`, `sp=` and `np=`. A DNS
lookup shows what is published now; received reports show what reporting
receivers observed. Keep monitoring after each change and investigate delivery
complaints as well as report data.
