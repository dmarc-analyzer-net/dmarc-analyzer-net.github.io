---
term: DKIM selector
description: A DKIM selector is the label that points to a specific DKIM public key in DNS, letting a domain publish and rotate multiple signing keys at once.
aliases: ["DKIM selectors", "selector"]
related: ["dkim", "dmarc", "spf"]
---

A **DKIM selector** is the label that identifies *which* [DKIM](/glossary/dkim)
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

- **Google Workspace** uses the `TXT` selector **`google`**.
- **Microsoft 365** uses two **CNAME** selectors, `selector1` and `selector2`,
  that rotate automatically.
- Others vary — read the `s=` value in the `DKIM-Signature` header of a message
  you sent, or check the provider's setup docs.

## Why CNAME sometimes, TXT other times

Some providers (Microsoft) publish the key as a **CNAME** pointing back to a
record they control, so they can rotate keys without you touching DNS. Others
(Google) give you a **TXT** record containing the key directly. Both are valid;
publish exactly what your provider specifies.

If DKIM isn't verifying, a wrong or missing selector is a common cause — see
[why your email is failing DMARC](/guides/fix-dmarc-failure).
