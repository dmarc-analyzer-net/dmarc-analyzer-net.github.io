---
term: DMARC quarantine vs reject
description: DMARC quarantine sends failing mail to spam; reject blocks it outright. Here's the difference, when to use each, and how to move between them safely.
aliases: ["quarantine vs reject", "p=quarantine vs p=reject"]
related: ["dmarc-policy", "dmarc", "dmarc-alignment"]
---

`quarantine` and `reject` are the two **enforcing** [DMARC
policies](/glossary/dmarc-policy/) — the difference is what a receiver does with
mail that fails authentication.

- **`p=quarantine`** — deliver failing mail, but to the **spam/junk** folder. The
  recipient can still find it.
- **`p=reject`** — refuse failing mail outright. It's **never delivered**; the
  sending server gets a bounce.

(The third policy, `p=none`, enforces nothing — it only monitors.)

Both apply only to mail that **fails** DMARC, meaning it failed
[alignment](/glossary/dmarc-alignment/) on both SPF and DKIM. Mail that passes is
untouched either way, which is why a correct setup is safe to enforce.

## When to use each

- Use **`quarantine`** as the cautious middle step after monitoring: spoofed mail
  is hidden from the inbox, but a misconfigured legitimate sender lands in spam
  rather than vanishing — so you notice before it does real damage.
- Use **`reject`** as the destination once quarantine is clean. It's the only
  policy that actually stops spoofed mail from reaching people, and the goal for
  every domain that sends real mail.

The practical difference is **who discovers your mistakes**. Under `quarantine`,
a broken sender produces confused recipients digging through spam. Under
`reject`, it produces a bounce at the sending end — louder, faster, and easier
to trace, but unforgiving if you enforced too early.

## A policy is a request, not a guarantee

Receivers are not obliged to honour your policy, and large providers apply their
own judgement — some deliver `p=reject` failures to spam anyway, particularly
for mail their users have interacted with before. Treat enforcement as strongly
respected rather than absolute.

## What `pct=` actually does

`pct=` applies the policy to a percentage of failing mail so you can ramp:

```
v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc@yourdomain.com
```

The detail people miss: mail *not* selected by `pct=` isn't exempted — it drops
to the next weaker policy. With `p=reject; pct=25`, roughly a quarter of failing
mail is rejected and the rest is **quarantined**, not delivered normally. So
`pct` on `reject` is a quarantine-with-a-bit-of-reject setting, and `pct` on
`quarantine` is the one that actually leaves most failures alone.

## Don't forget subdomains

`p=` covers the domain and, by default, its subdomains. `sp=` overrides that for
subdomains only:

```
v=DMARC1; p=reject; sp=quarantine; rua=mailto:dmarc@yourdomain.com
```

This is useful when the parent domain is clean but a subdomain still has an
unmapped sender. A subdomain with no DMARC record of its own inherits the
parent's `sp=`, or the parent's `p=` if `sp=` is absent — so enforcing the root
silently enforces everywhere unless you say otherwise.

## What breaks at enforcement

Two legitimate patterns fail DMARC through no fault of your DNS:

- **Forwarding** breaks SPF, because the mail arrives from the forwarder's IP. A
  valid DKIM signature usually survives, which is why you want both.
- **Mailing lists** often rewrite the subject or body and break DKIM too. Many
  handle this by rewriting the `From:` to their own domain.

Neither is a reason to stay at `p=none` — but both are reasons to read your
[aggregate reports](/glossary/dmarc-aggregate-report/) before tightening, so you
know which failures are attacks and which are your own mail taking an odd route.

## Moving between them safely

Don't jump straight to `reject`. Confirm reports are clean, then ramp
`quarantine` upward, then switch. The full progression is in [from monitoring to
enforcement](/guides/from-monitoring-to-enforcement/).
