---
term: Transactional email
seoTitle: "Transactional email vs marketing email"
description: Transactional email is the automated message a user's own action triggers, like a password reset or receipt. How it differs from marketing mail, and why.
aliases: ["transactional emails", "transactional vs marketing email", "triggered email"]
related: ["dmarc-alignment", "dkim", "spf", "dmarc-aggregate-report"]
---

A **transactional email** is a message your system sends to one person because
of something that person just did: they signed up, asked for a password reset,
placed an order, or tried to sign in from a new device. Nobody schedules it and
nobody chooses who gets it. The action triggers it, and the recipient is
usually waiting for it.

Typical examples:

- account confirmations and email-address verification
- password resets and one-time sign-in codes
- receipts, invoices and order confirmations
- shipping and booking notifications
- security alerts: a new sign-in, a changed password, a new API key

The waiting is what sets it apart. A newsletter that arrives an hour late is
fine. A sign-in code that arrives an hour late has already expired, and the
user has decided your product is broken.

## Transactional vs marketing email

| | Transactional | Marketing |
|---|---|---|
| **Triggered by** | something the recipient did | a campaign or a schedule |
| **Recipients** | one person | a list |
| **Timing** | immediately | whenever suits the sender |
| **Permission to send** | comes with the service the user asked for | consent, or at least an opt-out, depending on the country |
| **Unsubscribe link** | not expected | required |

The line is drawn by the message's main purpose, not by what system sent it.
A receipt with a discreet "you might also like" block is usually still a
receipt. A "receipt" that is mostly a promotion is marketing in disguise, and
anti-spam law such as the US CAN-SPAM Act and mailbox providers both judge it
that way. Google's sender
guidelines are blunt about it: don't mix different types of content in the
same message.

## Why the two should not share a sending identity

Mailbox providers decide what lands in the inbox partly by **reputation**:
the history of mail sent from a domain and its IP addresses. Marketing mail
draws spam complaints, and every recipient who forgot they signed up and
clicks "report spam" counts against you. Transactional mail almost never
does. Put both on the same identity, and a bad campaign lowers the
reputation your password resets depend on.

Some common ways to keep them apart:

- **Different From addresses per stream**, such as `receipts@yourdomain.com`
  and `news@yourdomain.com`. This is the minimum, and Google asks for it.
- **A subdomain for marketing**, such as `news.yourdomain.com`. Receivers can
  then tell the streams apart, and you can move each one to enforcement under
  its own DMARC record when it's ready.
- **Separate sending services or IP pools.** This is worth doing at volume. A
  dedicated IP only helps once you send enough steady mail to build a
  reputation of its own. Below that, a provider's well-run shared pool usually
  does better.

## The authentication trap with sending services

Most applications don't send mail themselves. They hand it to an email API or
SMTP relay, which sends it on their behalf. That's where transactional mail
usually fails [DMARC](/glossary/dmarc/), and the cause is
[alignment](/glossary/dmarc-alignment/), not delivery.

Out of the box, many services sign with **their own** domain and use **their
own** bounce address. [SPF](/glossary/spf/) passes and [DKIM](/glossary/dkim/)
passes, but both pass for the provider's domain rather than yours. Neither
aligns with your `From:` address, so DMARC fails even though every individual
check looks green. The fix is the custom-domain or domain-authentication step
in the provider's setup: publish the DKIM records they give you (often
CNAMEs) under your domain, so their signature carries `d=yourdomain.com`.

Since 2024, Gmail has required DMARC and alignment from anyone sending more
than 5,000 messages a day to Gmail accounts, and Yahoo has matching rules for
bulk senders. [What the requirements
say](/guides/spf-dkim-dmarc/#the-reason-this-stopped-being-optional) covers
the detail. If your password resets go through a sending service, that
service has to pass on your behalf.

## Watching it

Transactional mail fails quietly. Nobody complains about a reset email they
never received; they just stop trying. Three signals catch it early:

- **Bounce rate.** Suppress addresses that hard-bounce instead of retrying
  them. Repeated sends to dead addresses read to receivers like a sender that
  doesn't maintain its list.
- **Complaint rate.** Google requires it to stay below 0.3% and recommends
  under 0.1%. A rising rate on transactional mail usually means promotional
  content has crept into it.
- **DMARC results per sending source.** Your
  [aggregate reports](/glossary/dmarc-aggregate-report/) show each service
  sending as your domain, and whether it aligns. A new app or a provider
  migration shows up there before users notice anything missing. Reading
  those reports across every service, or across every client domain if you
  run them for others, is what an analyzer like [DMARC Analyzer](/) is for.
