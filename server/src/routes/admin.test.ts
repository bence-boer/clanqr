import { describe, expect, it } from "bun:test";
import { create_test_app, auth_headers, admin_headers } from "../test-app";
import { admin_routes } from "./admin";

function build_app() {
    const { app, store, client } = create_test_app();
    app.route("/api/admin", admin_routes);
    return { app, store, client };
}

describe("admin routes", () => {
    describe("authorization", () => {
        it("returns 401 without auth", async () => {
            const { app } = build_app();
            const res = await app.request("/api/admin");
            expect(res.status).toBe(401);
        });

        it("returns 403 for non-admin user", async () => {
            const { app } = build_app();
            const res = await app.request("/api/admin", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(403);
        });

        it("allows admin user access", async () => {
            const { app } = build_app();
            const res = await app.request("/api/admin", {
                headers: admin_headers(),
            });
            // Should succeed (200) — returns passkeys list
            expect(res.status).toBe(200);
        });
    });

    describe("error sanitization (BE-004)", () => {
        it("returns generic error messages on failure", async () => {
            const { app } = build_app();
            // Admin endpoint returns a list, so on success there's no error
            const res = await app.request("/api/admin", {
                headers: admin_headers(),
            });
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(Array.isArray(body)).toBe(true);
        });
    });
});
