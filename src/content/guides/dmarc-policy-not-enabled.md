---
title: What "DMARC policy not enabled" means (and how to fix it)
seoTitle: '"DMARC policy not enabled": how to fix'
description: Seeing "DMARC quarantine/reject policy not enabled"? Here's what that warning means, why checkers flag it, and how to enable an enforcing policy safely.
publishDate: 2026-07-23
updatedDate: 2026-11-26
---

**"DMARC policy not enabled"** usually means a checker found `p=none`
rather than an enforcing policy. DMARC can still validate your mail; you have
not asked receivers to quarantine or reject failures. Inspect the record the
checker found before changing it: testing settings, subdomain policies and DNS
problems can produce similar warnings.

## What the warning actually means

A **DMARC policy** ([RFC 9989](/rfc/9989/)) expresses how you want receivers
to treat mail that fails DMARC. A monitoring record might look like this:

```
v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

`p=none` expresses **no handling preference** for failures. It does not
guarantee delivery: receivers still apply their spam filters and local rules.
The `rua=` address requests aggregate reports, but reporting is optional and
received reports do not cover every destination or every message.

The warning is a checker's assessment, not a standardized DMARC error.
`p=quarantine` and `p=reject` express enforcing policies; receivers retain
discretion over final handling under either one. For a new deployment,
monitoring lets you investigate authentication before requesting stricter
handling. If enforcement already applies, preserve it while diagnosing the
warning.

## How to fix it (safely)

Don't switch to reject solely to clear a warning. First confirm which policy
applies to the domain in your visible `From:` address, then move in stages:

1. **Use monitoring to identify legitimate sending systems.** Review
   [aggregate reports](/guides/how-to-read-a-dmarc-aggregate-report/) alongside
   your sender inventory and delivery tests. Fix each direct sender so its
   mail passes SPF or DKIM with [alignment](/glossary/dmarc-alignment/).
   Either aligned pass is sufficient for DMARC; an unaligned pass is not.
2. **Move to `p=quarantine`** once you have addressed legitimate failures and
   assessed forwarding and mailing-list risks:
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```
   This asks receivers to treat failing mail as suspicious. Monitor reports,
   delivery tests and support feedback after the change. A valid quarantine
   policy can satisfy a check for quarantine **or** reject, but each checker
   has its own criteria.
3. **Consider `p=reject`** after assessing quarantine results and the impact on
   legitimate indirect mail:
   ```
   v=DMARC1; p=reject; rua=mailto:dmarc@yourdomain.com
   ```
   This expresses the strongest failure policy. It does not guarantee that
   receivers reject every failure. For domains whose users post to Internet
   mailing lists, reject can disrupt legitimate mail even when direct sending
   is configured correctly. Retaining quarantine may be the appropriate choice.

These examples show policy changes, not replacements for all your settings.
Edit your existing single record, retaining other tags unless you intend to
change them. Use a reporting mailbox you control.

Changing `p` can also change the policy inherited by subdomains when no
applicable `sp` or `np` overrides it. If only subdomain handling needs changing,
leave the parent `p` unchanged: update `sp` on the organizational-domain record
or publish a record for the specific subdomain. Check [subdomain
inheritance](#not-enabled-but-you-meant-to-enable-it) before editing.

**Don't rely on `pct=` as a precise rollout control.** The current standard
removed it after inconsistent receiver behavior. Older implementations may
still interpret it; others ignore it and evaluate the published policy without
sampling. Under the older rules, failures outside a reject sample were to be
treated as quarantine; outside a quarantine sample, normal local filtering
applied. Neither case promised inbox delivery.

**`t=y` is a test signal, not percentage sampling.** Receivers that support it
apply one level weaker: quarantine becomes none, reject becomes quarantine.
Receivers that do not recognize it ignore the tag, so do not depend on it to
protect legitimate mail from the stronger policy. Remove it, or use `t=n`,
when testing is finished and you intend the published policy to apply.

See [from monitoring to enforcement](/guides/from-monitoring-to-enforcement/)
for the full progression.

## How to know you're ready

Before tightening policy, check all of the following:

- **Your legitimate sending systems are accounted for.** Compare reports with
  your inventory: business mail, marketing, invoicing, support and application
  mail. Unfamiliar IPs may be spoofers or forwarders; you do not need to identify
  every abusive source before enforcing.
- **Direct senders pass aligned authentication.** Use aligned DKIM as well as
  SPF: forwarding can break SPF, while a valid aligned DKIM signature can survive.
- **You have tested indirect mail.** Forwarding and mailing lists can still
  produce legitimate failures. Decide which risks you can accept rather than
  waiting for every reported message to pass.
- **Your observation window includes recurring sends.** A month can cover monthly
  billing, but not quarterly campaigns or annual renewals. Inventory and test
  infrequent senders separately; a quiet month is not proof of readiness.
- **Someone owns the change.** Keep the previous record and a rollback plan, and
  know who can fix each sending system if delivery breaks.

For domains whose users may post to Internet mailing lists, the standard advises
against reject without assessing the impact. It recommends at least a month
each at none and quarantine for those considering that change. Time alone does
not establish safety.

## "Not enabled" but you meant to enable it

Use the [DMARC record checker](/tools/dmarc-checker/) to inspect the TXT record
returned for your domain and flag syntax or policy settings. It prompts you to
check a parent when no record is found; it does not automatically establish the
inherited policy.

- **Wrong DNS name.** For `From: user@yourdomain.com`, the first lookup is
  `_dmarc.yourdomain.com`. For `user@mail.yourdomain.com`, it is
  `_dmarc.mail.yourdomain.com`. Some DNS panels append the zone name
  automatically, so entering a full name can duplicate the suffix.
  See [no DMARC record found](/guides/no-dmarc-record-found/) for diagnosis.
- **Duplicate or unusable records.** Multiple DMARC TXT records at one name are
  discarded, not ranked by policy strength. Multiple quoted strings within one
  TXT record are not multiple records. Merge the intended settings into a single
  valid record. Missing or invalid policy tags can also prevent enforcement;
  a reporting-only fallback may be treated as none under the current rules.
- **A weaker subdomain policy.** A valid record at the exact From domain takes
  precedence. Otherwise, policy discovery can select an organizational-domain
  or public-suffix policy; it is not simply the nearest ancestor's record.
  When inheriting, an existing subdomain uses `sp` then `p`; a non-existent
  subdomain uses `np` then `sp` then `p`. Non-existence means NXDOMAIN,
  not merely a missing TXT or MX answer. Thus `p=reject; sp=none` leaves
  existing subdomains at none, while an explicit `np=reject` can still cover
  non-existent ones. An `sp` tag does not govern the domain publishing it,
  and is ignored on records below an organizational domain.
- **Testing or legacy sampling.** Check for `t=y` and a sub-100 `pct`.
  Their effects depend on receiver support, and checkers may flag them separately
  from the `p` value.
- **Cached or failed DNS lookups.** Verify the record at your authoritative
  nameservers, then compare the resolver your checker uses. An old cached answer
  may persist for its remaining TTL; a previously missing answer can be negatively
  cached too. A timeout or SERVFAIL is a lookup failure, not proof of monitoring
  or absent policy. A public resolver's answer describes that resolver's cache,
  not a universal propagation countdown.

## What next

Confirm the intended record is served, rerun the checker, and keep watching
legitimate delivery as you tighten policy. Across many client domains, that
means tracking different policies alongside the reports each domain receives.

[DMARC Analyzer](/) brings those reports into a self-hosted console with no
per-domain fee. Its [domain list](/docs/dashboard-and-domains/#the-domain-list)
shows published policy and reported compliance together; you still decide when
each domain is ready for enforcement.
