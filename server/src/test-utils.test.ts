import { describe, expect, it } from "bun:test";
import { create_mock_supabase, TEST_SEED } from "./test-utils";

describe("mock supabase client", () => {
    it("creates a client with seeded data", () => {
        const { store } = create_mock_supabase(TEST_SEED);
        expect(store.projects.length).toBe(1);
        expect(store.passkeys.length).toBe(2);
        expect(store.sessions.length).toBe(2);
    });

    it("select returns all rows from a table", async () => {
        const { client } = create_mock_supabase(TEST_SEED);
        const { data, error } = await client.from("projects").select("*");
        expect(error).toBeNull();
        expect(data).toHaveLength(1);
        expect(data![0].name).toBe("Test Project");
    });

    it("select with eq filter works", async () => {
        const { client } = create_mock_supabase(TEST_SEED);
        const { data } = await client
            .from("passkeys")
            .select("*")
            .eq("role", "admin");
        expect(data).toHaveLength(1);
        expect(data![0].id).toBe("test-admin");
    });

    it("select with count returns count", async () => {
        const { client } = create_mock_supabase(TEST_SEED);
        const { count } = await client
            .from("passkeys")
            .select("*", { count: "exact", head: true });
        expect(count).toBe(2);
    });

    it("select single returns first matching row", async () => {
        const { client } = create_mock_supabase(TEST_SEED);
        const { data, error } = await client
            .from("sessions")
            .select("*")
            .eq("token", "test-session-token")
            .single();
        expect(error).toBeNull();
        expect(data!.passkey_id).toBe("test-passkey");
    });

    it("select single returns error when not found", async () => {
        const { client } = create_mock_supabase(TEST_SEED);
        const { data, error } = await client
            .from("sessions")
            .select("*")
            .eq("token", "nonexistent")
            .single();
        expect(data).toBeNull();
        expect(error).not.toBeNull();
    });

    it("insert adds rows", async () => {
        const { client, store } = create_mock_supabase(TEST_SEED);
        const { data, error } = await client.from("projects").insert({
            name: "New Project",
            description: "A new one",
        });
        expect(error).toBeNull();
        expect(store.projects).toHaveLength(2);
        expect(store.projects[1].name).toBe("New Project");
    });

    it("update modifies matching rows", async () => {
        const { client, store } = create_mock_supabase(TEST_SEED);
        await client
            .from("projects")
            .update({ name: "Updated" })
            .eq("id", "00000000-0000-0000-0000-000000000001");
        expect(store.projects[0].name).toBe("Updated");
    });

    it("delete removes matching rows", async () => {
        const { client, store } = create_mock_supabase(TEST_SEED);
        await client
            .from("projects")
            .delete()
            .eq("id", "00000000-0000-0000-0000-000000000001");
        expect(store.projects).toHaveLength(0);
    });

    it("gt filter works for date comparisons", async () => {
        const { client } = create_mock_supabase(TEST_SEED);
        const { data } = await client
            .from("sessions")
            .select("*")
            .gt("expires_at", new Date().toISOString());
        expect(data).toHaveLength(2);
    });

    it("works with empty tables", async () => {
        const { client } = create_mock_supabase({ empty_table: [] });
        const { data } = await client.from("empty_table").select("*");
        expect(data).toHaveLength(0);
    });

    it("creates table on first access", async () => {
        const { client, store } = create_mock_supabase({});
        await client.from("new_table").insert({ key: "value" });
        expect(store.new_table).toHaveLength(1);
    });
});
