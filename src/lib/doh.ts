/**
 * DNS-over-HTTPS lookups for the browser tools under `/tools`.
 *
 * Everything here runs client-side. There is no server in this project's
 * marketing site, and adding one just to resolve TXT records would be the wrong
 * trade — public DoH resolvers answer CORS-enabled JSON, so the page can do it
 * directly. The only thing that leaves the browser is a domain name, sent to the
 * resolver.
 *
 * Extracted from `tools/dmarc-checker.astro`, which had all of this inline,
 * once a second and third tool needed the same lookups. The chunk-joining rule
 * in `txtValue` in particular is the kind of thing that must exist exactly once.
 */

/** The subset of the DoH JSON response these tools read. */
type DohResponse = {
  Status?: number;
  Answer?: { name: string; type: number; data: string }[];
};

/**
 * Cloudflare first, Google as a fallback. Two independent operators rather than
 * two endpoints of one, so a single outage does not take the tools down.
 */
const RESOLVERS = [
  'https://cloudflare-dns.com/dns-query?type=TXT&name=',
  'https://dns.google/resolve?type=TXT&name=',
];

/** DNS record type for TXT. Answers of any other type are filtered out — a
 *  resolver following a CNAME returns the CNAME alongside the TXT. */
const TYPE_TXT = 16;

/** NXDOMAIN. A definitive "no such name", so not worth retrying elsewhere. */
const RCODE_NXDOMAIN = 3;

/**
 * A thrown DOMException carries a message without being an Error subclass, so
 * narrowing with `instanceof Error` would lose those messages.
 */
export const errorText = (e: unknown, fallback: string) =>
  (e as { message?: string } | null | undefined)?.message || fallback;

/**
 * A TXT record arrives as one or more quoted strings. Anything over 255 bytes is
 * chunked by the protocol and the pieces must be concatenated with **no**
 * separator — joining with a space silently corrupts long SPF and DMARC records,
 * and the corruption looks like a typo in the record rather than a bug here.
 */
export function txtValue(data: string): string {
  const parts = data.match(/"(?:\\.|[^"\\])*"/g);
  if (!parts) return data.trim();
  return parts.map((p) => p.slice(1, -1).replace(/\\(.)/g, '$1')).join('');
}

/**
 * TXT records at `name`, or `[]` when the name does not exist or holds no TXT.
 * Throws only when no resolver could be reached at all.
 */
export async function lookupTxt(name: string): Promise<string[]> {
  let lastError: unknown;
  for (const base of RESOLVERS) {
    try {
      const res = await fetch(base + encodeURIComponent(name), {
        headers: { accept: 'application/dns-json' },
      });
      if (!res.ok) throw new Error(`Resolver responded ${res.status}.`);
      const json = (await res.json()) as DohResponse;
      if (json.Status === RCODE_NXDOMAIN) return [];
      if (json.Status !== 0) throw new Error(`DNS lookup failed (rcode ${json.Status}).`);
      return (json.Answer ?? [])
        .filter((a) => a.type === TYPE_TXT)
        .map((a) => txtValue(a.data));
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(
    errorText(lastError, 'Could not reach a DNS resolver. Check your connection and try again.'),
  );
}

/**
 * Accept whatever someone pastes: a URL, an email address, a trailing dot, or
 * the lookup name itself. `stripPrefix` removes a known DNS prefix so pasting
 * `_dmarc.example.com` into a DMARC tool resolves to `example.com`.
 */
export function normalizeDomain(input: string, stripPrefix?: RegExp): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme
  d = d.replace(/^[^/@]*@/, ''); // an email address
  d = d.split(/[/?#]/)[0]; // path, query, fragment
  d = d.replace(/:\d+$/, ''); // port
  d = d.replace(/\.$/, ''); // root label
  if (stripPrefix) d = d.replace(stripPrefix, '');
  return d;
}

/**
 * Deliberately permissive: rejecting anything non-ASCII would turn away
 * internationalized domains the resolver handles perfectly well. Structure is
 * all this insists on; the resolver is the real authority.
 */
export const LOOKS_LIKE_DOMAIN = /^(?=.{1,253}$)[^\s.@/:]+(\.[^\s.@/:]+)+$/;
