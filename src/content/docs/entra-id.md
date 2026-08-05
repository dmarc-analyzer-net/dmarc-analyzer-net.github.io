---
title: Microsoft Entra ID
description: Set up SSO with Microsoft Entra ID — register the app, add the client secret Entra requires, and get the redirect URI right first time.
section: Single sign-on
order: 2
---

Sign operators in with their Microsoft work accounts, while DMARC Analyzer keeps
deciding what each of them may see. Read [how SSO fits
together](/docs/single-sign-on/) first if you have not — this page is only the
Entra-specific half.

> **Requires 0.7.1 or newer.** Entra returns its authorization response in a way
> that older versions could not accept, and every login failed with
> `Correlation failed`. See [troubleshooting](#troubleshooting) if you are
> pinned to an older release.

Throughout, `dmarc-analyzer.agency.tld` stands in for your own hostname.

## Before you start

- DMARC Analyzer reachable over **HTTPS** at a hostname Entra can redirect a
  browser back to. Plain HTTP works only for `localhost`.
- Permission to register an application in your tenant — *Application
  Developer* is enough; you do not need Global Administrator.

## Register the application

In the [Entra admin center](https://entra.microsoft.com), go to **Entra ID → App
registrations → New registration**.

<img src="/docs/entra-id/01-register-an-application.webp" alt="Entra's Register an application form, with the name dmarc-analyzer, single-tenant selected, and a Web platform redirect URI ending in /api/v1/auth/oidc/callback" width="760" height="364" loading="lazy" />

- **Name** — `dmarc-analyzer`, or whatever your operators should see on the
  consent screen.
- **Supported account types** — *Accounts in this organizational directory
  only*, unless you deliberately want guests from other tenants.
- **Redirect URI** — platform **Web**, value:

  ```
  https://dmarc-analyzer.agency.tld/api/v1/auth/oidc/callback
  ```

The platform matters as much as the URL. **Web** is what makes this a
confidential client, which is the shape the app expects; registering the same
URL as a single-page application instead will fail at the token exchange.

The path ends in `/callback`. You may also see `/api/v1/auth/oidc/complete` in
logs or the address bar — that is an internal hop *after* Entra has returned, and
registering it here produces a `redirect_uri` mismatch.

## Copy the client and tenant IDs

The **Overview** blade has both values the app needs.

<img src="/docs/entra-id/02-overview-ids.webp" alt="The Overview Essentials panel showing Application (client) ID and Directory (tenant) ID, with placeholder GUIDs" width="650" height="220" loading="lazy" />

- **Application (client) ID** → `Auth__Oidc__ClientId`
- **Directory (tenant) ID** → goes into the authority URL:

  ```
  https://login.microsoftonline.com/<tenant-id>/v2.0
  ```

Use the `/v2.0` endpoint. The v1.0 issuer advertises different claims and will
not give you the verified email the app links accounts by.

Neither ID is a secret — both travel in every sign-in redirect.

## Add a client secret

**Entra requires one.** Because the redirect URI is registered under the Web
platform, Entra treats the app as a confidential client and demands a secret at
the token exchange no matter what else is configured — PKCE, which the app
always uses, does not remove the requirement. Without a secret the login fails
with `AADSTS7000218`.

Go to **Certificates & secrets → Client secrets → New client secret**.

<img src="/docs/entra-id/04-add-client-secret.webp" alt="The Add a client secret panel, with a description and an expiry dropdown set to the recommended 180 days" width="490" height="120" loading="lazy" />

<img src="/docs/entra-id/05-client-secret-created.webp" alt="The client secrets list showing one secret with its value and secret ID, both redacted" width="655" height="175" loading="lazy" />

**Copy the value immediately.** Entra shows it once; navigate away and it is
gone and you must create another. Put it straight into wherever your deployment
keeps secrets — a Kubernetes Secret, or a file that is not your values file.

Note the expiry date. A secret has a maximum life of two years and the default
is six months; when it lapses, every SSO login stops at once. Set a reminder,
and prefer a certificate over a secret if you have the tooling for it.

## Leave public client flows off

Under **Authentication → Settings**, leave **Allow public client flows**
disabled.

<img src="/docs/entra-id/03-authentication-settings.webp" alt="Authentication Settings tab with implicit grant checkboxes cleared and Allow public client flows disabled" width="660" height="290" loading="lazy" />

It is tempting when you would rather not manage a secret, but it enables
device-code and other native-app flows; it does not make a Web-platform
registration secretless. Leave the implicit grant checkboxes clear too — the app
uses the authorization code flow.

## Configure DMARC Analyzer

```yaml
environment:
  Auth__Oidc__Enabled: "true"
  Auth__Oidc__Authority: "https://login.microsoftonline.com/<tenant-id>/v2.0"
  Auth__Oidc__ClientId: "<application-client-id>"
  Auth__Oidc__ClientSecret: "<the secret you just copied>"
  Auth__Oidc__DisplayName: "Microsoft"
  Auth__Oidc__AutoProvision: "false"
```

`DisplayName` is the label on the login button, so write it for whoever reads
it. Full option list in the [configuration
reference](/docs/configuration/#single-sign-on-oidc).

Restart, and the login page gains the button.

> **Behind a reverse proxy, set `Network__UseForwardedHeaders`.** The app builds
> its redirect URI from the incoming request, and without a trust list it does
> not believe `X-Forwarded-Proto` — so it sends `http://` to Entra, which
> refuses it. See [running behind a reverse proxy](/docs/reverse-proxy/).

## The first sign-in

With `AutoProvision=false` above, someone with no existing account is refused
rather than let in at a default role. So create the accounts first, in
[Users](/docs/clients-users-and-audit/#users-and-roles), leaving the password
empty — that stores no password at all, so the account opens only by SSO. Their
first Entra login attaches to it by verified email.

Turn `AutoProvision` on instead and the first person through the door gets an
account at `Auth__Oidc__DefaultRole`, which defaults to the least-privileged
`client_viewer`. Convenient for a first test, worth turning off afterwards.

Either way, keep one local `agency_admin` password as the way back in if the
provider or its secret ever breaks.

## Troubleshooting

**`Correlation failed`, and the log names a missing `.AspNetCore.Correlation.*`
cookie.** You are on 0.7.0 or earlier. Those versions let the OIDC handler ask
Entra for a form-post response, which arrives as a cross-site POST that carries
no `SameSite=Lax` cookie, so the correlation cookie the app set moments earlier
was never sent back. It reads like a cookie or proxy problem and is neither.
Upgrade to 0.7.1.

**`AADSTS7000218`** — no client secret. See [above](#add-a-client-secret).

**`redirect_uri` mismatch** — the registered URI and the one the app builds
differ. They must match exactly, including scheme and any trailing path. If the
app is sending `http://` for an HTTPS site, that is the forwarded-headers
setting, not Entra.

**`no_account`** — authentication succeeded but no local user matched, with
`AutoProvision=false`. Create the account first, using the same address Entra
holds.

**The button never appears** — `Auth__Oidc__Enabled` is not `true`, or the app
did not restart. Check `GET /api/v1/auth/providers`.
