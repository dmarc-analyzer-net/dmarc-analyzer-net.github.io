---
term: DKIM selector
description: A DKIM selector is the label that points to a specific DKIM public key in DNS, letting a domain publish and rotate multiple signing keys at once.
aliases: ["DKIM selectors", "selector"]
related: ["dkim", "dmarc", "spf"]
---

A **DKIM selector** is the label that identifies *which* [DKIM](/glossary/dkim/)
public key a receiver should use to verify a message. It lets one domain publish
several keys — for different providers or for rotation — without them colliding.

The selector appears in two places. In DNS, the key lives at:

```
<selector>._domainkey.yourdomain.com
```

and in every signed message's `DKIM-Signature` header as the `s=` tag:

```
DKIM-Signature: v=1; a=rsa-sha256; d=yourdomain.com; s=google; ...
```

Here the selector is `google`, so the receiver fetches the key from
`google._domainkey.yourdomain.com`.

## Finding your selector

You don't invent it — your email provider assigns it:

| Provider | Selector | Record type |
|---|---|---|
| Google Workspace | `google` | `TXT` |
| Microsoft 365 | `selector1`, `selector2` | `CNAME` |
| Others | varies | varies |

For anything not listed, read the `s=` value from the `DKIM-Signature` header of
a message you've already sent. That's authoritative in a way documentation isn't
— it's what you actually signed with.

There is no way to enumerate a domain's selectors from DNS. `_domainkey` isn't a
listable zone, so you can only look up a selector you already know. This is why
"check if DKIM is set up" tools ask you to guess common selector names.

## Reading a selector's key

Look it up like any other record:

```
dig +short TXT google._domainkey.yourdomain.com
```

A published key looks like this:

```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
```

- **`v=`** — always `DKIM1`.
- **`k=`** — key type, almost always `rsa`.
- **`p=`** — the public key itself. An **empty `p=`** is meaningful: it's the
  documented way to revoke a key, not a broken record.

## Why CNAME sometimes, TXT other times

Some providers (Microsoft) publish the key as a **CNAME** pointing back to a
record they control, so they can rotate keys without you touching DNS. Others
(Google) give you a **TXT** record containing the key directly. Both are valid;
publish exactly what your provider specifies.

The CNAME approach is why Microsoft asks for two selectors: one is live, the
other is staged for the next rotation. Both must stay published permanently.

## Multiple senders, multiple selectors

A domain can have as many selectors as it has signers — your mailbox provider,
your marketing platform, and your helpdesk each publish their own. They don't
conflict, because each signs with its own name in `s=`. Only one signature needs
to verify *and* [align](/glossary/dmarc-alignment/) for DMARC to pass.

## Common problems

| Symptom | Cause |
|---|---|
| `dkim=none` | No signature at all — signing isn't enabled |
| `dkim=permerror` | Selector in `s=` has no matching DNS record |
| `dkim=fail` | Key found, signature didn't verify — often a rewritten message |
| `dkim=pass`, DMARC still fails | Signature is valid but `d=` doesn't align with `From:` |

A wrong or missing selector is one of the most common causes of DKIM not
verifying — see [why your email is failing DMARC](/guides/fix-dmarc-failure/).
