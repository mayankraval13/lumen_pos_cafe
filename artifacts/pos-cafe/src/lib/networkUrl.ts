/**
 * Returns the origin that a phone on the same LAN can reach.
 *
 * If the admin opens the site via a network IP (e.g. 192.168.x.x) or a real
 * domain, `window.location.origin` already works. When the admin opens it via
 * `localhost` or `127.0.0.1`, we swap that for the first detected LAN IP so
 * the QR code is scannable from a phone on the same Wi-Fi.
 */
export function getNetworkOrigin(): string {
  const { protocol, hostname, port } = window.location;

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  if (!isLocal) {
    return window.location.origin;
  }

  // Vite prints Network URLs in the console but we can't read those at
  // runtime. Instead we fall back to a well-known env variable injected by
  // Vite (set in vite.config.ts).  When that's unavailable we keep origin
  // and show a hint to the user.
  const envIp =
    (import.meta as any).env?.VITE_LAN_IP ??
    (import.meta as any).env?.VITE_NETWORK_IP;

  if (envIp) {
    return `${protocol}//${envIp}${port ? `:${port}` : ""}`;
  }

  return window.location.origin;
}

/**
 * Build a table-booking QR URL reachable from a mobile device on the LAN.
 */
export function getTableQrUrl(token: string): string {
  return `${getNetworkOrigin()}/table/${token}`;
}
