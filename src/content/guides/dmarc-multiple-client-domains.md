---
title: 'DMARC for many client domains: reporting that scales'
seoTitle: DMARC for multiple client domains
description: Managing DMARC for multiple client domains — one reporting mailbox, the authorization record that makes it work, per-client retention, and client access.
publishDate: 2026-07-28
---

**Running DMARC for many client domains** is not the single-domain job repeated N
times. Three things change: where the reports are delivered, whether they arrive at
all, and who is allowed to look at them. The DNS part is the half that bites first,
because when it is wrong nothing tells you.

## One mailbox, every client

Use one dedicated mailbox — `dmarc@agency.com` — not one per client. Every
aggregate report names the domain it is about in its own metadata, so a single inbox
demultiplexes cleanly, and adding a client becomes a DNS change rather than a
mailbox provisioning task. A dedicated address rather than a shared human inbox
matters for a duller reason: report volume is steady and boring, and mixing it into
somewhere people read mail means somebody eventually files it away. See
[choosing a mailbox](/docs/mailbox-setup/#choosing-a-mailbox) for the requirements.

## The record that makes third-party reporting work

Here is the part that catches every agency once. When a *client's* record says

```
v=DMARC1; p=none; rua=mailto:dmarc@agency.com
```

you are asking receivers to send reports about `clientdomain.com` to a mailbox on a
domain you control and they don't. Receivers will not do that on the strength of the
client's record alone — otherwise anyone could point reports at a victim and use the
world's mail servers to flood them. So the receiving domain has to say yes, by
publishing a record of its own in **your** zone:

```
clientdomain.com._report._dmarc.agency.com.   TXT   "v=DMARC1"
```

Miss it and the failure is completely silent. The client's record is valid, every
checker gives it a tick, no message bounces — and no reports ever arrive. If you
have ever onboarded a domain and waited a week wondering why the dashboard was
empty, this is usually why. The [record checker](/tools/dmarc-checker/) performs
that second lookup for every external `rua=` it finds, which is the fastest way to
confirm a client is really reporting to you.

### One record per client, or one wildcard — pick one

You can authorise every domain at once with a wildcard:

```
*._report._dmarc.agency.com.   TXT   "v=DMARC1"
```

That covers any client, including ones you haven't onboarded yet, and it is the
form the specification explicitly blesses for a report consumer willing to receive
reports for any domain.

> **Do not mix the two schemes.** Publishing one explicit
> `client1.com._report._dmarc.agency.com` alongside the wildcard breaks the wildcard
> for every *other* `.com` client. Adding that name creates an intermediate node at
> `com._report._dmarc.agency.com` in your zone, and DNS wildcard synthesis stops at
> the closest existing node — so a lookup for
> `client2.com._report._dmarc.agency.com` now finds that node, doesn't reach the
> wildcard, and returns nothing. The client's reports stop arriving, and nothing you
> changed was theirs. Pick per-client records or the wildcard, and if you need both,
> publish the explicit ones under a separate label.

Per-client records are the tidier choice when you want authorisation to be
revocable per client and visible in your zone; the wildcard is the pragmatic one
when you onboard often. Either way it is one decision, made once.

## Add the domain before you point the record at us

Order matters, and getting it backwards costs an afternoon of tidying. A report for
a domain nobody has added gets its domain created automatically, filed under the
mailbox's default client — so if reports land before you have created the client,
you will be reassigning domains by hand later. Create the client, add the domain,
*then* publish the client's `rua=`. Details in
[auto-created domains and the "default client"](/docs/mailbox-setup/#auto-created-domains-and-the-default-client)
and [adding domains](/docs/dashboard-and-domains/#adding-domains--and-why-some-appear-on-their-own).

## Every domain is at a different stage

A portfolio does not move to enforcement together. One client is at `p=none` with
three unauthenticated senders, another has been at `p=reject` for a year, and a
third has a marketing platform nobody told you about. Each domain needs its own
reports read before its own next step is safe, which is why "roll out DMARC for all
clients" is not a project with one finish line but a per-domain state you track. The
[path to enforcement](/docs/domain-detail/#path-to-enforcement) view is per domain
for that reason, and [monitoring to
enforcement](/guides/from-monitoring-to-enforcement/) is the process each one
follows.

## SPF drifts, and you are not the one drifting it

Your client's marketing team signs up for a new email platform, pastes another
`include:` into SPF, and now the record makes eleven DNS lookups instead of nine.
Past ten the result is `permerror`, which is an SPF failure — and again nothing
bounces. On a single domain you would have made the change yourself and known to
check. Across a portfolio, the change happens without you.

Worth a scheduled pass over client SPF records for that reason:
[SPF record syntax](/guides/spf-record-syntax/) for what counts toward the limit,
and the [SPF checker](/tools/spf-checker/) to get the real number.

## Who sees what, and for how long

Client reporting data is your clients' data, and the questions that follow are
contractual as much as technical. That is the moment [DMARC
Analyzer](/) earns its place in an agency: many client domains in one instance you
run, with per-client separation, and no per-domain fee to make you ration who gets
monitored.

The three things worth setting up deliberately, all covered in the docs rather than
restated here:

- **Access.** Give clients the read-only `client_viewer` role with grants for their
  own clients only; cross-tenant requests fail by design, so a viewer cannot
  enumerate anyone else. See [users and roles](/docs/clients-users-and-audit/#users-and-roles).
- **Retention.** Set it per client, at creation, alongside legal hold — see
  [clients](/docs/clients-users-and-audit/#clients).
- **Your position in the chain.** Self-hosting means no third party is added to your
  clients' data flow, which is a materially easier conversation than explaining a
  vendor's sub-processors. [If you run this for
  clients](/docs/data-protection/#if-you-run-this-for-clients) sets out what that
  means in practice.

## Onboarding a client

The end-to-end sequence — create, add domains, publish, verify, grant access — is
written out as a numbered list in [onboarding a client](/docs/clients-users-and-audit/#onboarding-a-client-end-to-end).
Follow that rather than a version of it here.

## What next

- [How to read a DMARC aggregate report](/guides/how-to-read-a-dmarc-aggregate-report/)
  — the daily work, once reports are flowing.
- [DMARC record tags](/guides/dmarc-record-tags/) — every tag and its default, for
  the records you will be writing on clients' behalf.
