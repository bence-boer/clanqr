/** Validate that a resource URL is safe (no SSRF) */
export function validate_resource_url(url_string: string): boolean {
    let url: URL;
    try {
        url = new URL(url_string);
    }
    catch {
        return false;
    }

    if (!['http:', 'https:'].includes(url.protocol)) return false;

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Block loopback names
    if (hostname === 'localhost' || hostname === '::1'
      || hostname === '0:0:0:0:0:0:0:1' || hostname === '::') {
        return false;
    }

    // Block 0.0.0.0 and shorthand '0'
    if (hostname === '0.0.0.0' || hostname === '0') return false;

    // Block hex IPs (0x7f000001)
    if (/^0x[0-9a-f]+$/i.test(hostname)) return false;

    // Block pure decimal IPs (2130706433)
    if (/^\d+$/.test(hostname)) return false;

    // Block internal/local domains
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;

    // Block IPv6 private/link-local ranges
    if (hostname.startsWith('fe80:') || hostname.startsWith('fc') || hostname.startsWith('fd')) return false;

    // Block IPv6-mapped IPv4 (::ffff:x.x.x.x dotted form)
    const ipv6_mapped_dotted = hostname.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv6_mapped_dotted) {
        const octets = ipv6_mapped_dotted.slice(1).map(Number);
        if (is_private_ipv4(octets[0], octets[1])) return false;
    }

    // Handle normalized form ::ffff:HHHH:HHHH (Bun/browser URL parser output)
    const ipv6_mapped_hex = hostname.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (ipv6_mapped_hex) {
        const high = parseInt(ipv6_mapped_hex[1], 16);
        const a = (high >> 8) & 0xff;
        const b = high & 0xff;
        if (is_private_ipv4(a, b)) return false;
    }

    // Parse dotted notation (IPv4 or octal/hex components)
    const dotted_match = hostname.match(/^([0-9a-fx]+)\.([0-9a-fx]+)\.([0-9a-fx]+)\.([0-9a-fx]+)$/i);
    if (dotted_match) {
        const parts = dotted_match.slice(1);

        // Detect and block octal components (leading zero followed by digits, e.g., 0177)
        for (const part of parts) {
            if (/^0[0-9]+$/.test(part)) return false; // Octal notation
            if (/^0x[0-9a-f]+$/i.test(part)) return false; // Hex component notation
        }

        // Standard decimal IPv4 — validate and check private ranges
        const octets = parts.map(Number);
        if (octets.some((o) => isNaN(o) || o < 0 || o > 255)) return false;
        if (is_private_ipv4(octets[0], octets[1])) return false;
    }

    return true;
}

/** Check if an IPv4 address (first two octets) is private/reserved */
function is_private_ipv4(a: number, b: number): boolean {
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 0) return true; // 0.0.0.0/8 current network
    return false;
}
