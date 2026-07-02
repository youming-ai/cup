// ppv.to was seized by law enforcement (July 2026) — do not re-add it.
// vileembeds.pages.dev hosts the alt source's (timstreams.st) embeds; the full
// project subdomain is pinned on purpose — never allowlist bare pages.dev.
const TRUSTED_STREAM_HOSTS = ['embedindia.st', 'ppv.st', 'vileembeds.pages.dev'];

export function isTrustedStreamUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    return TRUSTED_STREAM_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}
