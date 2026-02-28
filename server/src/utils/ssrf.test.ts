import { describe, it, expect } from "bun:test";
import { validate_resource_url } from "./ssrf";

describe("validate_resource_url", () => {
    describe("allows valid external URLs", () => {
        it("allows HTTPS URLs", () => {
            expect(validate_resource_url("https://example.com")).toBe(true);
            expect(validate_resource_url("https://github.com/repo")).toBe(true);
        });

        it("allows HTTP URLs", () => {
            expect(validate_resource_url("http://example.com")).toBe(true);
        });

        it("allows URLs with paths and query params", () => {
            expect(validate_resource_url("https://example.com/path?q=1")).toBe(true);
        });

        it("allows URLs with ports", () => {
            expect(validate_resource_url("https://example.com:8443/api")).toBe(true);
        });
    });

    describe("blocks non-HTTP schemes", () => {
        it("blocks file:// scheme", () => {
            expect(validate_resource_url("file:///etc/passwd")).toBe(false);
        });

        it("blocks ftp:// scheme", () => {
            expect(validate_resource_url("ftp://example.com/file")).toBe(false);
        });

        it("blocks javascript: scheme", () => {
            expect(validate_resource_url("javascript:alert(1)")).toBe(false);
        });

        it("blocks data: scheme", () => {
            expect(validate_resource_url("data:text/html,<h1>hi</h1>")).toBe(false);
        });
    });

    describe("blocks loopback addresses", () => {
        it("blocks localhost", () => {
            expect(validate_resource_url("http://localhost")).toBe(false);
            expect(validate_resource_url("http://localhost:3000")).toBe(false);
        });

        it("blocks 127.0.0.1", () => {
            expect(validate_resource_url("http://127.0.0.1")).toBe(false);
            expect(validate_resource_url("http://127.0.0.1:8080")).toBe(false);
        });

        it("blocks 0.0.0.0", () => {
            expect(validate_resource_url("http://0.0.0.0")).toBe(false);
        });

        it("blocks IPv6 loopback ::1", () => {
            expect(validate_resource_url("http://[::1]")).toBe(false);
        });

        it("blocks expanded IPv6 loopback", () => {
            expect(validate_resource_url("http://[0:0:0:0:0:0:0:1]")).toBe(false);
        });

        it("blocks :: (all zeros)", () => {
            expect(validate_resource_url("http://[::]")).toBe(false);
        });
    });

    describe("blocks private IPv4 ranges", () => {
        it("blocks 10.x.x.x", () => {
            expect(validate_resource_url("http://10.0.0.1")).toBe(false);
            expect(validate_resource_url("http://10.255.255.255")).toBe(false);
        });

        it("blocks 172.16-31.x.x", () => {
            expect(validate_resource_url("http://172.16.0.1")).toBe(false);
            expect(validate_resource_url("http://172.31.255.255")).toBe(false);
        });

        it("blocks 192.168.x.x", () => {
            expect(validate_resource_url("http://192.168.0.1")).toBe(false);
            expect(validate_resource_url("http://192.168.1.100")).toBe(false);
        });

        it("blocks 169.254.x.x (link-local)", () => {
            expect(validate_resource_url("http://169.254.169.254")).toBe(false);
        });
    });

    describe("blocks IPv6 private/link-local", () => {
        it("blocks fe80: link-local", () => {
            expect(validate_resource_url("http://[fe80::1]")).toBe(false);
        });

        it("blocks fc (unique local)", () => {
            expect(validate_resource_url("http://[fc00::1]")).toBe(false);
        });

        it("blocks fd (unique local)", () => {
            expect(validate_resource_url("http://[fd00::1]")).toBe(false);
        });
    });

    describe("blocks other dangerous inputs", () => {
        it("blocks decimal IP notation", () => {
            expect(validate_resource_url("http://2130706433")).toBe(false);
        });

        it("blocks .internal domains", () => {
            expect(validate_resource_url("http://api.internal")).toBe(false);
        });

        it("blocks .local domains", () => {
            expect(validate_resource_url("http://printer.local")).toBe(false);
        });

        it("rejects malformed URLs", () => {
            expect(validate_resource_url("not-a-url")).toBe(false);
            expect(validate_resource_url("")).toBe(false);
        });
    });
});
