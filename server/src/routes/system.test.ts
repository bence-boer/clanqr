import { describe, expect, it } from "bun:test";
import { create_test_app, auth_headers } from "../test-app";
import { system_routes } from "./system";

function setup() {
    const { app, store, client } = create_test_app();
    app.route("/api/system", system_routes);
    return { app, store };
}

describe("system routes", () => {
    describe("GET /api/system/stats", () => {
        it("returns 401 without auth", async () => {
            const { app } = setup();
            const res = await app.request("/api/system/stats");
            expect(res.status).toBe(401);
        });

        it("returns system stats", async () => {
            const { app } = setup();
            const res = await app.request("/api/system/stats", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(200);
            const body = (await res.json()) as any;
            expect(body).toHaveProperty("cpu_percent");
            expect(body).toHaveProperty("uptime_seconds");
        });
    });

    describe("GET /api/system/models", () => {
        it("rejects invalid cli parameter", async () => {
            const { app } = setup();
            const res = await app.request("/api/system/models?cli=invalid", {
                headers: auth_headers(),
            });
            expect(res.status).toBe(400);
            const body = (await res.json()) as any;
            expect(body.error).toContain("Invalid cli parameter");
        });

        it("accepts copilot as cli parameter", async () => {
            const { app } = setup();
            const res = await app.request("/api/system/models?cli=copilot", {
                headers: auth_headers(),
            });
            // May succeed or fail depending on whether copilot is installed
            // but should not return 400
            expect(res.status).not.toBe(400);
        });

        it("accepts gemini as cli parameter", async () => {
            const { app } = setup();
            const res = await app.request("/api/system/models?cli=gemini", {
                headers: auth_headers(),
            });
            expect(res.status).not.toBe(400);
        });

        it("defaults to copilot when no cli param", async () => {
            const { app } = setup();
            const res = await app.request("/api/system/models", {
                headers: auth_headers(),
            });
            // Should not return 400 (validation error)
            expect(res.status).not.toBe(400);
        });
    });
});
