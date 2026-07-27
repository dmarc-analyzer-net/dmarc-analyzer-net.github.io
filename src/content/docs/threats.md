---
title: Investigating threats
description: What the Threats page counts as a failing source, why not every entry is an attacker, and how to work through the list without breaking legitimate mail.
section: Using the console
order: 4
---

The Threats page lists **every sending source whose mail failed both DKIM and
SPF** in the window, across all the domains you can see — worst first. Both
mechanisms failing means DMARC failed outright: nothing about the message could
be tied to the domain in its `From:` header.

## Not every entry is an attack

That definition catches spoofers — and it equally catches:

- **Forwarders and mailing lists.** Forwarding breaks SPF by design, and a list
  that rewrites the subject or body breaks DKIM too. A university relay
  forwarding a newsletter looks identical to an attacker here.
- **Forgotten senders.** The invoicing tool nobody set DKIM up for, the
  building's scan-to-email printer, the CRM someone connected in 2023.
- **Genuinely malicious sources** trying the domain on for size.

The page cannot tell these apart for you — that's the investigation. What it can
do is rank them by failing volume and take you straight to the evidence: each
source links into the [domain drill-down](/docs/domain-detail/) with that source
already expanded, where the raw DKIM and SPF results usually settle it in
seconds. [Why your email is failing DMARC](/guides/fix-dmarc-failure/) walks the
common causes in the same order you'll meet them.

## How this relates to the other numbers

- The **Spoofing blocked** dashboard card counts failing messages that receivers
  actually quarantined or rejected. On a `p=none` domain that's zero, however
  long this list is — visibility without enforcement.
- The **Spoofing** status label on a domain means the same failing volume this
  page shows, on a domain whose policy doesn't block it. The fix is the [path to
  enforcement](/docs/domain-detail/#path-to-enforcement), not deleting entries
  from this list.

A long threat list on a newly connected domain is normal. Work through it,
classify each source as fix / accept / hostile, and it becomes the argument for
moving the policy forward.
