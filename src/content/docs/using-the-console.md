---
title: Using the console
description: A tour of the DMARC Analyzer console — every screen, who can see it, how the analytics windows pick their dates, and what the status labels actually mean.
section: Using the console
order: 1
---

The console is what you get after [installing](/docs/install/) and signing in.
This section documents each screen against what actually ships; this page covers
the things every screen shares — the navigation, the time windows, and the
status vocabulary.

## The screens

| Screen | Who sees it | What it's for |
|---|---|---|
| **Dashboard** | everyone | Portfolio-wide compliance, volume and what needs attention |
| **Domains** | everyone | Every monitored domain with policy, compliance and status |
| **Threats** | everyone | Sources whose mail failed both DKIM and SPF |
| **Alerts** | everyone | Compliance drops and policy regressions, with triage |
| **Clients** | admin + analyst | Tenants: retention, legal hold, alert thresholds |
| **Users** | admin | Accounts, roles, and per-client grants |
| **Mailbox sources** | admin + analyst | The inboxes reports arrive in — see [mailbox setup](/docs/mailbox-setup/) |
| **Notifications** | admin + analyst | Who receives alert emails and the monthly digest |
| **Audit trail** | admin | Who did what, when, from where |

A `client_viewer` sees only the first four screens, scoped to the clients an
admin has granted them; everything else redirects to the dashboard, and the
server enforces the same rule regardless. Requesting another tenant's data
returns **404**, never 403 — the API doesn't reveal that a resource exists.

## How the time windows work

Every analytics view defaults to the **last 30 days** and can extend to 365.
The window anchors to the **newest report in your data, not to today**. That is
deliberate: a freshly connected mailbox backfills months of history oldest-first,
so during backfill "the last 30 days from today" would be empty while the
database fills with older reports. Anchoring to the data means the dashboard is
useful from the first sync — but it also means a stalled mailbox shows a window
that quietly stops moving. The [mailbox health
view](/docs/mailbox-setup/#checking-it-worked) is where that shows up.

## The status vocabulary

**Compliance** is the share of analyzed messages that passed DMARC — an aligned
SPF *or* DKIM pass, per [alignment](/glossary/dmarc-alignment/). A message can
pass raw SPF and still count as failing here; the [domain
drill-down](/docs/domain-detail/) shows both layers side by side.

**Enforcement status** appears next to every domain and is *derived*, from the
published policy and the window's compliance:

| Label | Derivation |
|---|---|
| **Enforced** | published policy is `p=reject` |
| **Ramping** | published policy is `p=quarantine` |
| **Monitoring** | `p=none` (or no policy found), compliance ≥ 98% |
| **Spoofing** | `p=none` (or no policy found), compliance below 98% |
| **No data** | no messages in the window |

> **"Spoofing" is a derived label, not a detected attack.** It means: this
> domain's failing mail is not being blocked, and there is enough of it to
> matter. The failing source may be an attacker — or a forwarder, a mailing
> list, or a legitimate sender nobody finished setting up. The
> [Threats](/docs/threats/) page and the domain drill-down are where you find
> out which. Explain this to clients before they see the word.

**Published vs observed.** The console knows a domain's DMARC record two ways:
what a live DNS lookup returns (refreshed roughly every six hours in the
background), and what the reporting receivers echoed back inside each aggregate
report. The [record inspection panel](/docs/domain-detail/) compares the two
per tag and flags only genuine disagreements — a tag you didn't publish that the
[specification gives a default for](/guides/dmarc-record-tags/) is labelled
*inherited*, not a problem.

## Where the data comes from

Everything on these screens is parsed from [aggregate
reports](/glossary/dmarc-aggregate-report/) pulled from your configured
mailboxes — by default once an hour. There is no external service involved:
if a number looks stale, start with [mailbox setup](/docs/mailbox-setup/) and
[troubleshooting](/docs/troubleshooting/).
