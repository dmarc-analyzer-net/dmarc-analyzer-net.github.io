---
title: Single sign-on (OIDC)
description: Let operators sign in with your existing identity provider over OIDC, alongside or instead of local passwords, with roles still enforced in-app.
section: Configuration
order: 3
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

So local passwords and SSO are interchangeable front doors, and you can enable SSO
without migrating existing accounts. Your provider never controls who is an admin.

## Register the application

In your identity provider, create a **web / confidential** client:

- **Redirect URI**: `https://dmarc.example.com/api/v1/auth/oidc/complete`
- **Scopes**: `openid`, `profile`, `email`
- Note the issuer URL, client ID, and client secret.

## Configure the app

```yaml
environment:
  Auth__Oidc__Enabled: "true"
  Auth__Oidc__Authority: "https://login.example.com"
  Auth__Oidc__ClientId: "dmarc-analyzer"
  Auth__Oidc__ClientSecret: "…"
  Auth__Oidc__DisplayName: "Company SSO"
  Auth__Oidc__AutoProvision: "true"
  Auth__Oidc__DefaultRole: "client_viewer"
```

Restart the API and the login page gains a button labelled with your
`DisplayName`. Full option list: [configuration
reference](/docs/configuration/#single-sign-on-oidc).

## Linking and provisioning

- An SSO identity is linked to a local user by **verified email**. If someone
  already has a local account with that address, their first SSO login attaches to
  it rather than creating a duplicate.
- With `AutoProvision=false` (the default), someone with no matching account is
  refused — you invite operators explicitly. This is the safer setting for an
  agency install.
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

## Keep a local admin

Leave at least one local password account with `agency_admin`. If your provider or
its configuration breaks, that's how you get back in.

## Testing locally

The repository's development compose file includes a Zitadel instance for
exercising the OIDC path end to end, with a walkthrough in
[`docs/ops/oidc-zitadel.md`](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/docs/ops/oidc-zitadel.md).
Against a local HTTP-only test provider you'll also need
`Auth__Oidc__RequireHttpsMetadata: "false"` — never in production.
