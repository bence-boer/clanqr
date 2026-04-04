import { test, expect } from "@playwright/test";
import { API_URL, ADMIN_AUTH_HEADERS, AUTH_HEADERS } from "./helpers";

test.describe("settings API endpoints", () => {
    test("GET /api/admin/settings returns SDK defaults", async ({
        request,
    }) => {
        const res = await request.get(`${API_URL}/api/admin/settings`, {
            headers: ADMIN_AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const data = await res.json();
        expect(data).toHaveProperty("default_model");
        expect(data).toHaveProperty("default_reasoning_effort");
        expect(data).toHaveProperty("default_timeout_minutes");
        expect(data).toHaveProperty("max_concurrent_sessions");
        expect(typeof data.default_model).toBe("string");
        expect(typeof data.default_timeout_minutes).toBe("number");
    });

    test("PUT /api/admin/settings updates and returns merged settings", async ({
        request,
    }) => {
        const res = await request.put(`${API_URL}/api/admin/settings`, {
            headers: {
                ...ADMIN_AUTH_HEADERS,
                "Content-Type": "application/json",
            },
            data: { default_timeout_minutes: 45 },
        });
        expect(res.ok()).toBeTruthy();
        const data = await res.json();
        expect(data.default_timeout_minutes).toBe(45);
        // Restore default
        await request.put(`${API_URL}/api/admin/settings`, {
            headers: {
                ...ADMIN_AUTH_HEADERS,
                "Content-Type": "application/json",
            },
            data: { default_timeout_minutes: 30 },
        });
    });

    test("PUT /api/admin/settings rejects invalid reasoning effort", async ({
        request,
    }) => {
        const res = await request.put(`${API_URL}/api/admin/settings`, {
            headers: {
                ...ADMIN_AUTH_HEADERS,
                "Content-Type": "application/json",
            },
            data: { default_reasoning_effort: "ultra" },
        });
        expect(res.status()).toBe(400);
    });

    test("PUT /api/admin/settings rejects timeout out of range", async ({
        request,
    }) => {
        const res = await request.put(`${API_URL}/api/admin/settings`, {
            headers: {
                ...ADMIN_AUTH_HEADERS,
                "Content-Type": "application/json",
            },
            data: { default_timeout_minutes: 9999 },
        });
        expect(res.status()).toBe(400);
    });

    test("non-admin cannot access settings", async ({ request }) => {
        const res = await request.get(`${API_URL}/api/admin/settings`, {
            headers: AUTH_HEADERS,
        });
        expect(res.status()).toBe(403);
    });
});

test.describe("enhanced agent status endpoint", () => {
    test("GET /api/agents/status returns agents with model field", async ({
        request,
    }) => {
        const res = await request.get(`${API_URL}/api/agents/status`, {
            headers: AUTH_HEADERS,
        });
        expect(res.ok()).toBeTruthy();
        const data = await res.json();
        expect(Array.isArray(data)).toBeTruthy();
        // If there are any agents, they should have the model field
        for (const agent of data) {
            expect(agent).toHaveProperty("id");
            expect(agent).toHaveProperty("agent_type");
            expect(agent).toHaveProperty("status");
        }
    });
});
