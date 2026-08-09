---
title: Hosting MTA-STS policies
description: Serve every domain's MTA-STS policy file from your own instance — one CNAME and one TXT record per domain, with certificates issued automatically.
section: Configuration
order: 5
---

[MTA-STS](/glossary/mta-sts/) (RFC 8461) lets a domain tell sending mail servers
to require verified TLS when delivering to it. Publishing a policy needs two DNS
records **and** an HTTPS endpoint serving a small text file at
`https://mta-sts.yourdomain.com/.well-known/mta-sts.txt`.

That endpoint is the reason most fleets skip MTA-STS. It is a whole web host,
with a valid certificate, per domain — to serve four lines of text.

This app serves those policy files itself. Onboarding a domain becomes one CNAME
plus one TXT record: no per-domain web hosting, no per-domain certificate
management. TLS termination stays with your reverse proxy, where Caddy's
on-demand TLS makes the certificates automatic.

## Enable it

**1. Point a hostname at your proxy** and set it as `MtaSts__PolicyHost` —
for example `sts.example`. This is the name every domain's CNAME will target,
and the console needs it to show complete publish instructions. Leave it empty
and the console shows a configure-me hint instead.

**2. Create the policy.** On the domain's detail page, under **Transport
security → Hosted policy**, choose the mode, the max age, and the `mx` patterns
covering that domain's mail exchangers. The editor lists the domain's live MX
records beside the field, so the patterns you write can be checked against what
is actually there.

Start in `testing`. See [MTA-STS: from testing to
enforce](/guides/mta-sts-testing-to-enforce/) for why, and for how to know when
you're ready to move.

**3. Publish the two records** the console shows:

```
CNAME   mta-sts.yourdomain.com    →  sts.example
TXT     _mta-sts.yourdomain.com   →  v=STSv1; id=20260807120000
```

**4. Press Recheck now.** The monitoring pass validates a hosted policy exactly
like an externally hosted one, so the card flips from setup guidance to green
once DNS and the proxy are wired up. Recheck queries the domain's authoritative
nameserver directly, so a record you published seconds ago shows up immediately
rather than after a cache expires.

### Editing a policy later

The policy id changes whenever the *content* changes, and the console calls out
the new TXT value to publish. This matters: senders only refetch a policy when
the id moves. Skip the TXT update and they stay on the old policy until
`max_age` expires.

To apply one shape across many domains at once, use **Also apply to other
domains in this client** in the editor. The result lists exactly which TXT
records now need updating.

## TLS termination with Caddy

Caddy's on-demand TLS issues a certificate the first time a hostname is
requested — but only after asking the app whether that name is one it actually
serves. Strangers pointing DNS at your instance therefore cannot mint
certificates against it:

```caddyfile
{
	on_demand_tls {
		ask http://127.0.0.1:8080/mta-sts/ask
	}
}

# The console — explicit host, ordinary certificate.
dmarc.example {
	reverse_proxy 127.0.0.1:8080
}

# Any mta-sts.<domain> a client CNAMEs at this instance.
https:// {
	tls {
		on_demand
	}
	reverse_proxy 127.0.0.1:8080
}
```

Two requirements: `reverse_proxy` must preserve the original Host header (it
does by default — the policy route keys on it), and `AllowedHosts` must stay `*`,
since the app has to accept arbitrary `mta-sts.<domain>` hosts.

### Nginx, Traefik, Kubernetes

Neither nginx nor Traefik has an equivalent of on-demand TLS across unrelated
registrable domains. Either automate a certificate per domain — cert-manager on
Kubernetes, one Ingress host per domain, all routing to the same Service, which
the chart's `ingress.hosts` list already supports — or put a small Caddy in
front of the `mta-sts` hosts only.

## A dedicated policy-host container

Serving from the main app is the default and works fine. If you would rather not
point internet traffic at the container that also serves your console, run a
second container from the same image with `APP_MODE=mta-sts`. It serves only the
policy file, the `ask` endpoint, and health probes — no console, no API, no auth
stack, no worker:

```yaml
services:
  mta-sts:
    image: ghcr.io/dmarc-analyzer-net/dmarc-analyzer:latest
    restart: unless-stopped
    environment:
      APP_MODE: mta-sts
      ConnectionStrings__Default: "Host=postgres;Port=5432;Database=dmarc_analyzer;Username=postgres;Password=${POSTGRES_PASSWORD:-postgres}"
    ports:
      - "8090:8080"
    depends_on:
      app:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:8080/health/ready"]
      interval: 30s
      timeout: 5s
      retries: 5
```

Point the Caddy blocks above at this container instead. Three things worth
knowing about this shape:

- **It never migrates.** The main app owns the schema; the `depends_on` gate
  keeps a fresh stack ordered. Its readiness probe checks that the policy table
  exists, so it reports unready rather than healthy-but-failing until the schema
  is in place.
- **It needs no credential encryption key** — which is the point of the
  isolation. The internet-facing container holds nothing that could decrypt
  mailbox credentials.
- **Console edits propagate within `MtaSts__ServeCacheSeconds`** (default 60).
  Each process caches rendered policies briefly, which is negligible against
  `max_age` values measured in days.

## Turning a policy off, or retiring it

| Action | Effect |
|---|---|
| **Hosting off** (editor toggle) | Settings are kept, the policy URL answers 404. Useful mid-setup. The id does not change |
| **Delete** | Removes the policy entirely — also remove the domain's `mta-sts` CNAME and `_mta-sts` TXT, or senders will find a broken policy host |
| **Mode `none`** | The graceful exit. Senders may still have your policy cached, so switch to `none` and let `max_age` pass *before* removing records |

## Troubleshooting

- **The policy URL returns the console UI.** The image predates this feature —
  upgrade. The route answers 404 in plain text for unknown hosts, never HTML.
- **404 for a domain you host.** The domain must be active, the policy enabled,
  and the request's Host header exactly `mta-sts.<domain>`. Behind a proxy,
  confirm it forwards the original Host.
- **Certificate errors on `mta-sts.<domain>`.** The `ask` endpoint answers 200
  only for enabled policies on active domains. A 403 in Caddy's log means the app
  does not (yet) serve that name.
- **The card says "Waiting for DNS".** The monitoring pass has never managed to
  fetch the policy from the public side. Check the CNAME, then the proxy route,
  then press Recheck now.

## Related settings

| Key | Default | What it does |
|---|---|---|
| `MtaSts__PolicyHost` | *(empty)* | The CNAME target shown in publish instructions |
| `MtaSts__ServeCacheSeconds` | `60` | How long a rendered policy body is cached and `Cache-Control`d |
| `MtaSts__Enabled` | `true` | Runs the monitoring pass |
| `MtaSts__CheckIntervalHours` | `6` | Gap between monitoring passes |

The full list is in the [configuration reference](/docs/configuration/).
