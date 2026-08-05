---
title: Single sign-on (OIDC)
description: Let operators sign in with your existing identity provider over OIDC, alongside or instead of local passwords, with roles still enforced in-app.
section: Single sign-on
order: 1
---

DMARC Analyzer can authenticate operators against any OpenID Connect provider —
Entra ID, Okta, Keycloak, Zitadel, Authentik, Google — while still deciding
permissions itself.

## How it fits together

The important design point: **authentication is pluggable, authorisation never is.**

1. The user is redirected to your identity provider.
2. On success the app mints its own `dmarc_session` cookie — the same session a
   local password login produces.
3. Roles and client access come from DMARC Analyzer's own records, not from the
   token.

So local passwords and SSO are interchangeable front doors by default, and you can
enable SSO without migrating existing accounts. Your provider never controls who
is an admin. Local login can be turned off entirely once SSO is working — see
[Requiring SSO for everyone](#requiring-sso-for-everyone) below.

## Per-provider guides

The steps below are generic and enough for any OpenID Connect provider. For one
walked through screen by screen:

- [Microsoft Entra ID](/docs/entra-id/)

More to follow.

## Register the application

In your identity provider, create a web client — confidential with a secret, or a
public client using PKCE. The app always uses PKCE and only sends a client secret
if you configure one, so either usually works.

**Some providers insist on a secret** and refuse the token exchange without one,
however PKCE is configured. Microsoft Entra ID is one: a redirect URI registered
under its *Web* platform is a confidential client by definition. A callback
failing with `AADSTS7000218`, or any "client_secret required" error, is the
provider telling you so.

- **Redirect URI**: `https://dmarc.example.com/api/v1/auth/oidc/callback`
- **Scopes**: `openid`, `profile`, `email`
- Note the issuer URL and client ID, plus the client secret if you created a
  confidential client.

The redirect URI ends in `/callback` — that is the path the app registers with the
handler. You may also see `/api/v1/auth/oidc/complete` in logs or a browser's
address bar; that is an internal hop the app redirects itself to *after* the
provider has returned, and registering it as the redirect URI will fail with a
`redirect_uri` mismatch.

## Configure the app

```yaml
environment:
  Auth__Oidc__Enabled: "true"
  Auth__Oidc__Authority: "https://login.example.com"
  Auth__Oidc__ClientId: "dmarc-analyzer"
  Auth__Oidc__ClientSecret: "…"        # omit entirely for a public PKCE client
  Auth__Oidc__DisplayName: "Company SSO"
  Auth__Oidc__AutoProvision: "true"
  Auth__Oidc__DefaultRole: "client_viewer"
```

Restart the API and the login page gains a button labelled with your
`DisplayName`. Full option list: [configuration
reference](/docs/configuration/#single-sign-on-oidc).

> **Behind a reverse proxy, SSO needs `Network__UseForwardedHeaders` set.** The app
> builds its redirect URI from the scheme and host of the incoming request. Without
> a configured trust list it does not believe `X-Forwarded-Proto`, so it sends
> `http://…` to a provider expecting `https://…` and the login is rejected. This is
> the one place where that setting is required rather than merely advisable — see
> [running behind a reverse proxy](/docs/reverse-proxy/).

## Linking and provisioning

- An SSO identity is linked to a local user by **verified email**. If someone
  already has a local account with that address, their first SSO login attaches to
  it rather than creating a duplicate.
- With `AutoProvision=false` (the default), someone with no matching account is
  refused — you invite operators explicitly. This is the safer setting for an
  agency install. Create their account ahead of time in
  [Users](/docs/clients-users-and-audit/#users-and-roles) with no password set,
  picking their role yourself rather than leaving everyone on `DefaultRole` —
  their first SSO login links to it by verified email, same as any other
  pre-existing account.
- With `AutoProvision=true`, a new user is created with `DefaultRole`, which
  defaults to `client_viewer` — the least privileged role, with no client access
  until an admin grants it. Promote deliberately.

## Roles

| Role | Can do |
|---|---|
| `agency_admin` | Everything, including users, clients, domains, mailboxes. |
| `agency_analyst` | Read and operate; not admin settings. |
| `client_viewer` | Read-only, limited to explicitly granted clients. |

Enforcement is deny-by-default, and a request for another tenant's data returns
**404** rather than 403 — deliberately, so the API never reveals that a resource
exists.

## Requiring SSO for everyone

```yaml
environment:
  Auth__Oidc__DisableLocalLogin: "true"
```

Turns off password sign-in (`/api/v1/auth/login` refuses with 403) and has the
login page skip straight to your provider instead of showing a form with nothing
usable on it.

Registration is unaffected — it already refuses itself once the first account
exists, so bootstrapping a fresh instance still works locally. The intended order
is: bootstrap the first admin locally (or via `AutoProvision`), confirm SSO works,
*then* turn this on. Setting it without `Auth__Oidc__Enabled` is refused at
startup, since that combination would leave no way to sign in at all.

## Keep a local admin

Leave at least one local password account with `agency_admin`, unless you've
deliberately turned on `DisableLocalLogin` above. If your provider or its
configuration breaks, that local account is how you get back in.

## Testing locally

The repository's development compose file includes a Zitadel instance for
exercising the OIDC path end to end, with a walkthrough in
[`docs/ops/oidc-zitadel.md`](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/docs/ops/oidc-zitadel.md).
Against a local HTTP-only test provider you'll also need
`Auth__Oidc__RequireHttpsMetadata: "false"` — never in production.
