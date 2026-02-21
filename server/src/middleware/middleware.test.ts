import { describe, expect, it } from "bun:test";
import { createMiddleware } from "hono/factory";
import { create_test_app, auth_headers, admin_headers } from "../test-app";
import type { AppBindings } from "../middleware/supabase";

describe("auth middleware", () => {
    describe("auth_middleware", () => {
        it("returns 401 when no session cookie is present", async () => {
            const { app } = create_test_app();
            app.get("/api/test", (c) => c.json({ ok: true }));

            const res = await app.request("/api/test");
            expect(res.status).toBe(401);
            const body = (await res.json()) as { error: string };
            expect(body.error).toBe("Authentication required");
        });

        it("returns 401 for invalid/expired session token", async () => {
            const { app } = create_test_app();
            app.get("/api/test", (c) => c.json({ ok: true }));

            const res = await app.request("/api/test", {
                headers: { Cookie: "session=invalid-token" },
            });
            expect(res.status).toBe(401);
        });

        it("passes through with valid session cookie", async () => {
            const { app } = create_test_app();
            app.get("/api/test", (c) =>
                c.json({ passkey_id: c.get("passkey_id"), role: c.get("role") })
            );

            const res = await app.request("/api/test", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as { passkey_id: string; role: string };
            expect(body.passkey_id).toBe("test-passkey");
            expect(body.role).toBe("user");
        });

        it("correctly identifies admin role", async () => {
            const { app } = create_test_app();
            app.get("/api/test", (c) =>
                c.json({ role: c.get("role") })
            );

            const res = await app.request("/api/test", {
                headers: admin_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as { role: string };
            expect(body.role).toBe("admin");
        });
    });

    describe("admin_middleware (standalone)", () => {
        it("returns 403 for non-admin users", async () => {
            const { app } = create_test_app();
            app.use(
                "/api/admin/*",
                createMiddleware<AppBindings>(async (c, next) => {
                    if (c.get("role") !== "admin") {
                        return c.json({ error: "Forbidden" }, 403);
                    }
                    await next();
                })
            );
            app.get("/api/admin/test", (c) => c.json({ ok: true }));

            const res = await app.request("/api/admin/test", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(403);
        });

        it("passes through for admin users", async () => {
            const { app } = create_test_app();
            app.use(
                "/api/admin/*",
                createMiddleware<AppBindings>(async (c, next) => {
                    if (c.get("role") !== "admin") {
                        return c.json({ error: "Forbidden" }, 403);
                    }
                    await next();
                })
            );
            app.get("/api/admin/test", (c) => c.json({ ok: true }));

            const res = await app.request("/api/admin/test", {
                headers: admin_headers(),
            });
            expect(res.status).toBe(200);
        });
    });

    describe("public routes", () => {
        it("does not require auth for non /api/* paths", async () => {
            const { app } = create_test_app();
            app.get("/health", (c) => c.json({ status: "ok" }));

            const res = await app.request("/health");
            expect(res.status).toBe(200);
        });
    });
});
