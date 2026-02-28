/** Validate that a resource URL is safe (no SSRF) */
export function validate_resource_url(url_string: string): boolean {
    let url: URL;
    try {
        url = new URL(url_string);
    } catch {
        return false;
    }

    if (!["http:", "https:"].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

    // Block loopback addresses
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" ||
        hostname === "::1" || hostname === "0:0:0:0:0:0:0:1" || hostname === "::") {
        return false;
    }

    // Block private IPv4 ranges
    const private_patterns = ["10.", "172.16.", "172.17.", "172.18.", "172.19.",
        "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
        "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
        "192.168.", "169.254."];
    if (private_patterns.some(p => hostname.startsWith(p))) return false;

    // Block decimal IP notation (e.g., 2130706433 = 127.0.0.1)
    if (/^\d+$/.test(hostname)) return false;

    // Block IPv6 private/link-local ranges
    if (hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd")) return false;

    // Block internal/local domains
    if (hostname.endsWith(".internal") || hostname.endsWith(".local")) return false;

    return true;
}
