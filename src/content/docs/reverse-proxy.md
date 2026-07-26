---
title: Running behind a reverse proxy
description: Terminate TLS in front of DMARC Analyzer with Caddy, nginx or Traefik — and set the one thing that keeps your audit trail recording real callers.
section: Configuration
order: 4
---

The container speaks plain HTTP on port 8080 and does not terminate TLS. For
anything internet-facing, put a proxy in front of it. Sessions use a `Secure`
cookie, so the browser has to reach the app over HTTPS or sign-in will not stick.

There is one setting that is easy to miss and quietly costs you something.

## The audit trail problem

Behind a proxy, the address the application sees is the **proxy's**, not the
caller's. Nothing breaks — but every entry in the audit trail records that address.
On the default Compose stack it is Docker's bridge gateway, so every sign-in, every
client change and every mailbox edit is attributed to the same meaningless IP.

The fix is to believe the `X-Forwarded-For` header, and the reason it is off by
default is that believing it blindly is worse than the problem. If any caller can
set the header, any caller can write whatever address it likes into its own audit
entry. So the app only believes it **from proxies you name**:

```bash
Network__UseForwardedHeaders=true
Network__TrustedNetworks__0=172.16.0.0/12
```

`172.16.0.0/12` covers Docker's default bridge networks. For a fixed proxy address,
name it directly instead:

```bash
Network__UseForwardedHeaders=true
Network__TrustedProxies__0=10.0.1.5
```

Both lists are indexed — add `__1`, `__2` for more. Loopback is always trusted.

> **Turning it on with neither list set is refused.** The app logs an error and
> carries on ignoring forwarded headers, because an empty trust list would let any
> caller forge its own address. That is worse than recording the gateway honestly.

`Network__ForwardLimit` defaults to `1` — how many proxy hops to walk back. Raise
it only if you genuinely run chained proxies; each extra hop is another address you
are choosing to believe.

When it is working, `X-Forwarded-Proto` is honoured too, so the app knows the
original request was HTTPS.

## Caddy

Caddy terminates TLS automatically, which makes it the shortest working example.

```caddy
dmarc.example.com {
    reverse_proxy app:8080
}
```

```yaml
# compose override
services:
  app:
    environment:
      Network__UseForwardedHeaders: "true"
      Network__TrustedNetworks__0: "172.16.0.0/12"
```

Caddy sets `X-Forwarded-For` and `X-Forwarded-Proto` by default; nothing else to
configure.

## nginx

```nginx
server {
    listen 443 ssl;
    server_name dmarc.example.com;

    ssl_certificate     /etc/ssl/certs/dmarc.crt;
    ssl_certificate_key /etc/ssl/private/dmarc.key;

    location / {
        proxy_pass http://app:8080;

        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Report attachments can be large; the default 1m rejects some uploads.
        client_max_body_size 32m;
    }
}
```

nginx does **not** send these headers unless you ask, which is the usual reason
forwarded headers appear not to work.

## Traefik

```yaml
services:
  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dmarc.rule=Host(`dmarc.example.com`)"
      - "traefik.http.routers.dmarc.entrypoints=websecure"
      - "traefik.http.routers.dmarc.tls.certresolver=le"
      - "traefik.http.services.dmarc.loadbalancer.server.port=8080"
    environment:
      Network__UseForwardedHeaders: "true"
      Network__TrustedNetworks__0: "172.16.0.0/12"
```

Traefik sets the forwarded headers itself.

## Kubernetes

An Ingress controller is a proxy like any other, and pod traffic arrives from the
cluster network:

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: dmarc.example.com
      paths: [{ path: /, pathType: Prefix }]
  tls:
    - secretName: dmarc-tls
      hosts: [dmarc.example.com]

extraEnv:
  Network__UseForwardedHeaders: "true"
  Network__TrustedNetworks__0: "10.0.0.0/8"
```

Use whichever CIDR your cluster actually allocates pods from — `10.0.0.0/8` is
common but not universal.

## Checking it worked

Sign in through the proxy, then look at the newest audit entry. The console shows
this under **Audit**, or over the API with an `agency_admin` session:

```bash
curl -s -b cookies.txt \
  'https://dmarc.example.com/api/v1/admin/audit-events?limit=1'
```

The `ipAddress` on that entry should be your own address, not the proxy's. If it is
still the proxy, work through these in order:

1. **Is the app logging an error at startup?** Turning the feature on with no trust
   list is refused, and it says so.
2. **Is your proxy in the trust list?** Not the client — the *proxy*. Get its
   address from the app's side: `docker compose exec app getent hosts proxy`, or
   check what network the proxy container is on.
3. **Is the proxy actually sending the header?** nginx needs
   `proxy_set_header X-Forwarded-For` explicitly.
4. **More than one proxy?** A CDN in front of your own proxy is two hops, and
   `ForwardLimit` defaults to 1.
