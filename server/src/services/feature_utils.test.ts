import { describe, it, expect } from "bun:test";
import { create_mock_supabase } from "../test-utils";
import { check_and_complete_feature } from "./feature_utils";

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
