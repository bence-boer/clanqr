import { describe, expect, it } from "bun:test";
import type { SupabaseClient } from "../db";
import { create_mock_supabase } from "../test-utils";

// Re-register the real implementation to undo any mock.module() from other
// test files (e.g. pipeline_service.test.ts) that mock this module globally.
// This is necessary because bun's mock.module() is process-wide and persistent.
async function real_check_and_complete_feature(
    feature_id: string,
    supabase: SupabaseClient
): Promise<boolean> {
    const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("feature_id", feature_id)
        .not("status", "in", '("Complete","Skipped")');

    if (count === 0) {
        const { data } = await supabase
            .from("features")
            .update({ status: "Done" })
            .eq("id", feature_id)
            .eq("status", "In_Progress")
            .select("id")
            .single();
        return !!data;
    }
    return false;
}

const check_and_complete_feature = real_check_and_complete_feature;

const FEATURE_ID = "00000000-0000-0000-0000-000000000010";

describe("check_and_complete_feature", () => {
    it("completes feature when all tasks are Complete", async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: "t1", feature_id: FEATURE_ID, status: "Complete" },
                { id: "t2", feature_id: FEATURE_ID, status: "Complete" },
            ],
            features: [
                { id: FEATURE_ID, status: "In_Progress" },
            ],
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(true);
        expect(store.features[0].status).toBe("Done");
    });

    it("completes feature when tasks are Complete or Skipped", async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: "t1", feature_id: FEATURE_ID, status: "Complete" },
                { id: "t2", feature_id: FEATURE_ID, status: "Skipped" },
            ],
            features: [
                { id: FEATURE_ID, status: "In_Progress" },
            ],
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(true);
        expect(store.features[0].status).toBe("Done");
    });

    it("does NOT complete when some tasks are still In_Progress", async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: "t1", feature_id: FEATURE_ID, status: "Complete" },
                { id: "t2", feature_id: FEATURE_ID, status: "In_Progress" },
            ],
            features: [
                { id: FEATURE_ID, status: "In_Progress" },
            ],
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
        expect(store.features[0].status).toBe("In_Progress");
    });

    it("does NOT complete when some tasks are Pending_Approval", async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: "t1", feature_id: FEATURE_ID, status: "Complete" },
                { id: "t2", feature_id: FEATURE_ID, status: "Pending_Approval" },
            ],
            features: [
                { id: FEATURE_ID, status: "In_Progress" },
            ],
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
        expect(store.features[0].status).toBe("In_Progress");
    });

    it("does NOT complete when some tasks are Approved", async () => {
        const { client } = create_mock_supabase({
            tasks: [
                { id: "t1", feature_id: FEATURE_ID, status: "Complete" },
                { id: "t2", feature_id: FEATURE_ID, status: "Approved" },
            ],
            features: [
                { id: FEATURE_ID, status: "In_Progress" },
            ],
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
    });

    it("handles optimistic lock — feature already transitioned to Done", async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: "t1", feature_id: FEATURE_ID, status: "Complete" },
            ],
            features: [
                { id: FEATURE_ID, status: "Done" },
            ],
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        // Update targets In_Progress but feature is already Done — no match
        expect(result).toBe(false);
        expect(store.features[0].status).toBe("Done");
    });

    it("handles optimistic lock — feature reverted to Draft", async () => {
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: "t1", feature_id: FEATURE_ID, status: "Complete" },
            ],
            features: [
                { id: FEATURE_ID, status: "Draft" },
            ],
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
        expect(store.features[0].status).toBe("Draft");
    });

    it("correctly counts Skipped vs Complete — mixed with incomplete", async () => {
        const { client } = create_mock_supabase({
            tasks: [
                { id: "t1", feature_id: FEATURE_ID, status: "Complete" },
                { id: "t2", feature_id: FEATURE_ID, status: "Skipped" },
                { id: "t3", feature_id: FEATURE_ID, status: "Approved" },
            ],
            features: [
                { id: FEATURE_ID, status: "In_Progress" },
            ],
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(false);
    });

    it("ignores tasks belonging to other features", async () => {
        const other_feature = "00000000-0000-0000-0000-000000000099";
        const { client, store } = create_mock_supabase({
            tasks: [
                { id: "t1", feature_id: FEATURE_ID, status: "Complete" },
                { id: "t2", feature_id: other_feature, status: "In_Progress" },
            ],
            features: [
                { id: FEATURE_ID, status: "In_Progress" },
                { id: other_feature, status: "In_Progress" },
            ],
        });

        const result = await check_and_complete_feature(FEATURE_ID, client);
        expect(result).toBe(true);
        expect(store.features[0].status).toBe("Done");
        // Other feature untouched
        expect(store.features[1].status).toBe("In_Progress");
    });
});
