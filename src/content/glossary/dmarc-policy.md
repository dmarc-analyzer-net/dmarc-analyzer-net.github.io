---
term: DMARC policy
seoTitle: "DMARC policy: p=none, quarantine, reject"
description: "A DMARC policy requests how receivers handle mail that fails DMARC: p=none, quarantine, or reject. Learn subdomain policies and testing limits."
aliases: ["p=none", "p=quarantine", "p=reject"]
related: ["dmarc", "dmarc-aggregate-report", "dmarc-alignment", "dmarc-quarantine-vs-reject"]
---

A **DMARC policy** expresses how you want receiving servers to handle mail that
fails [DMARC](/glossary/dmarc/) ([RFC 9989](/rfc/9989/)). The `p=` tag sets the
policy for your domain; `sp=` and `np=` can set different policies for its
subdomains. Receivers make the final handling decision.

## The three policy values

- **`p=none`** — express no handling preference. Use it to monitor before
  enforcement, with `rua=` to request [aggregate reports](/glossary/dmarc-aggregate-report/).
  The policy alone does not request reports, and receivers may choose not to send
  them. Their own spam and security filters still apply.
- **`p=quarantine`** — mark failing mail as suspicious and request cautious
  handling, such as delivery to spam/junk.
- **`p=reject`** — indicate that failing mail uses your domain without valid
  authentication and request rejection, preferably during the SMTP transaction.

DMARC passes when at least one SPF or DKIM result both passes authentication
and [aligns](/glossary/dmarc-alignment/) with the visible `From:` domain. A raw
SPF or DKIM pass for an unrelated domain is not enough.

Publish a monitoring record as a TXT record at `_dmarc.yourdomain.com`:

```text
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

Use a mailbox you control to receive the reports. Aggregate reporting is available
with any policy value; changing to enforcement does not require removing `rua=`.

## Subdomain policies: sp and np

At your organizational domain:

- **`sp=`** sets the policy for existing subdomains that inherit this record.
  If it is absent, they inherit `p=`. A subdomain with its own applicable DMARC
  record uses that record instead.
- **`np=`** sets the policy for non-existent subdomains. Without it, the fallback
  is `sp=`, then `p=`. Non-existent means DNS returns NXDOMAIN for the name; a domain that
  exists but has no mail records does not qualify.

For example, at `_dmarc.yourdomain.com`:

```text
v=DMARC1; p=reject; sp=quarantine; np=reject; rua=mailto:dmarc@yourdomain.com
```

This requests rejection for failing mail using `yourdomain.com`, quarantine for
existing subdomains inheriting the record, and rejection for non-existent
subdomains. Verify legitimate sending names before using `np=reject`: a
misconfigured sender can use a non-existent name too.

## Testing and the legacy pct tag

**`t=y`** requests one level less enforcement for failing mail: `reject` becomes
`quarantine`, and `quarantine` becomes `none`. It leaves `none` and reporting
unchanged. The default, `t=n`, requests the stated policy. Receivers using the
older specification may ignore `t=` and apply the full stated policy, so it is
not a universal safety switch.

**`pct=`** is historic and removed from the current specification. Older receivers
may still use it, but intermediate percentages were inconsistently implemented.
Do not rely on `pct=25` to enforce exactly a quarter of failing mail. See the
[DMARC record tags](/guides/dmarc-record-tags/) for the complete reference.

## Choosing enforcement safely

Review all known sending services and important forwarding and mailing-list
routes before tightening policy. `p=reject` can disrupt legitimate indirect mail;
it is not a universal destination for every sending domain. Domains using it must
sign their mail with valid DKIM signatures rather than rely only on SPF.

When you manage several domains, [DMARC Analyzer](/) groups their aggregate
reports in one self-hosted dashboard so you can investigate failing sources
before changing policy. Follow the
[monitoring-to-enforcement process](/guides/from-monitoring-to-enforcement/)
for rollout steps.

A DMARC pass does not guarantee inbox placement, and a requested rejection does
not guarantee the receiver will reject. Local filtering and policy overrides
can change the final outcome.
