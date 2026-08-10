---
title: Authentik
seoTitle: "Single sign-on with Authentik"
description: Set up SSO with Authentik — two objects rather than one, a confidential client by default, and grant types worth trimming before you finish.
section: Configuration
order: 9
publishDate: 2026-08-06
updatedDate: 2026-08-07
parent: single-sign-on
---

Authentik is open source and self-hostable. Read [how SSO fits
together](/docs/single-sign-on/) first if you have not — this page is only the
Authentik-specific half.

It splits the client into **two objects** — a provider and an application —
and the provider defaults to **confidential**, so you will have a client
secret to store by default. Its grant-type defaults are also worth trimming,
covered at the end.

## Create the provider

**Applications → Providers → Create**, then choose **OAuth2/OpenID Provider**
from the type list:

<img src="/docs/single-sign-on/authentik/01-provider-type.webp" alt="Authentik's Create New Provider dialog listing provider types, with OAuth2/OpenID Provider among them" width="855" height="515" loading="lazy" />

For **Authorization flow**, either default works:
`default-provider-authorization-implicit-consent` signs users straight in,
while the `-explicit-consent` variant adds a one-time "Authorize Application"
prompt.

Under **Protocol settings**, leave **Client Type** at **Confidential** and copy
both the generated Client ID and Client Secret:

<img src="/docs/single-sign-on/authentik/02-client-type.webp" alt="Protocol settings showing Client Type set to Confidential rather than Public, with the generated Client ID and a masked Client Secret below" width="655" height="305" loading="lazy" />

**Confidential is the default here.** The app uses PKCE either way, so
switching **Client Type** to **Public** works too and leaves you nothing to
rotate — but if you accept the default, `Auth__Oidc__ClientSecret` is
required and the token exchange fails without it.

Then add one **Redirect URI** entry — mode **Strict**, type **Authorization**:

```
https://dmarc-analyzer.agency.tld/api/v1/auth/oidc/callback
```

The list starts **empty**, and the mode and type dropdowns only appear once you
click **Add entry**:

<img src="/docs/single-sign-on/authentik/06-redirect-uri-warning.webp" alt="The Redirect URIs/Origins row with mode Strict and type Authorization selected, above Authentik's help text warning that with no explicit authorization redirect URIs the first successfully used one will be saved" width="655" height="240" loading="lazy" />

**Do add one explicitly.** Read Authentik's own help text in that screenshot:
"If no explicit authorization redirect URIs are specified, the first
successfully used authorization redirect URI will be saved." An empty list does
not fail closed — it trusts whatever redirect URI turns up first and remembers
it. Leave **Strict** alone as well; the alternative, **Regex**, is what you
would need to allow patterns, and Authentik flags the security implications of
the `.*` case itself.

## Create the application and link it

A provider on its own is not reachable. **Applications → Applications →
Create**, give it a Name and a **Slug**, and select the provider you just made.

**The slug becomes part of the issuer URL**, because Authentik's issuer is
per-provider by default:

```
https://auth.agency.tld/application/o/<slug>/
```

That is the *application's* slug, not the provider's name. Get it wrong and
discovery fails before a login is ever attempted.

If you skip or mistime the linking step, the provider list says so — and this
is the easiest mistake to make, since creating the provider first feels like
the whole job:

<img src="/docs/single-sign-on/authentik/03-provider-not-assigned.webp" alt="Authentik's provider list with two rows: one marked Assigned to application DMARC Analyzer with a green check, and one warning Provider not assigned to any application" width="770" height="145" loading="lazy" />

An unassigned provider still has a client ID and secret and still looks
configured from the app's side. It has no issuer, so nothing can sign in
against it.

## Copy the issuer and client ID

The provider's **Overview** tab is where to read both. **OpenID Configuration
Issuer** is exactly what `Auth__Oidc__Authority` wants, trailing slash
included:

<img src="/docs/single-sign-on/authentik/04-provider-overview.webp" alt="Provider overview panel showing Assigned to application, Client Type Confidential, the Client ID, and the registered strict redirect URI" width="494" height="598" loading="lazy" />

Keep the trailing slash. Authentik reports its issuer with one and the app
compares the two strings exactly.

## Configure DMARC Analyzer

```yaml
environment:
  Auth__Oidc__Enabled: "true"
  Auth__Oidc__Authority: "https://auth.agency.tld/application/o/dmarc-analyzer/"
  Auth__Oidc__ClientId: "…"
  Auth__Oidc__ClientSecret: "…"      # omit only if you switched to a Public client
  Auth__Oidc__DisplayName: "Authentik"
  Auth__Oidc__AutoProvision: "false"
```

Restart and the login page gains the button. What happens on the [first
sign-in](/docs/single-sign-on/#the-first-sign-in) is the same for every
provider.

> **Behind a reverse proxy, set `Network__UseForwardedHeaders`.** Without a
> trust list the app does not believe `X-Forwarded-Proto`, so it builds an
> `http://` redirect URI that no longer matches what you registered. See
> [running behind a reverse proxy](/docs/reverse-proxy/).

## Trim the grant types

A new provider comes out with **every** grant type enabled — authorization
code, implicit, hybrid, refresh token, client credentials, password, and device
code — whichever way you create it:

<img src="/docs/single-sign-on/authentik/05-grant-types-default.webp" alt="The Grant Types list on a newly created provider, with all seven boxes checked: Authorization Code, Implicit, Hybrid, Refresh token, Client credentials, Password and Device-code" width="680" height="335" loading="lazy" />

The app only ever uses the authorization code flow, plus refresh tokens. The
rest is provider surface that nothing here asks for, and two are worth naming:
the **password** grant turns your identity provider into a password-checking
API, and **implicit** is deprecated for the same reasons the code flow exists.
Untick everything except **Authorization Code** and **Refresh token**.

## Troubleshooting

**Discovery fails, or the app logs an issuer mismatch** — the `Authority` does
not match the provider's OpenID Configuration Issuer exactly. Check the slug,
and check the trailing slash.

**`redirect_uri` mismatch** — the registered URI and the one the app builds
differ, exactly and including scheme. If the app is sending `http://` for an
HTTPS site, that is the forwarded-headers setting above, not Authentik.

**The token exchange fails on a confidential client** — `Auth__Oidc__ClientSecret`
is missing or stale. Either set it, or switch the provider's **Client Type** to
**Public**.

**`no_account`** — authentication worked but no local user matched, with
`AutoProvision=false`. Create the account first, at the same address Authentik
holds for that user.

**The button never appears** — `Auth__Oidc__Enabled` is not `true`, or the app
did not restart. Check `GET /api/v1/auth/providers`.

## Trying it locally

The repository's development stack can start an Authentik instance for exactly
this, behind a compose profile since it is three containers rather than one,
with a walkthrough in
[`docs/ops/oidc-authentik.md`](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/docs/ops/oidc-authentik.md).
Against a plain-HTTP local instance you will also need
`Auth__Oidc__RequireHttpsMetadata: "false"` — never in production.
