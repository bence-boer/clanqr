import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * In-memory mock for @supabase/supabase-js client.
 * Supports .from(table).select/insert/update/delete chains.
 * Data is stored in a plain object keyed by table name.
 */

type Row = Record<string, any>;

interface MockStore {
    [table: string]: Row[];
}

interface QueryResult {
    data: any;
    error: null | { message: string; code: string };
    count?: number;
}

class MockQueryBuilder {
    private table_name: string;
    private store: MockStore;
    private filters: Array<(row: Row) => boolean> = [];
    private select_columns: string | null = null;
    private count_mode: "exact" | null = null;
    private head_mode = false;
    private limit_val: number | null = null;
    private single_mode = false;
    private operation: "select" | "insert" | "update" | "delete" = "select";
    private payload: any = null;

    constructor(table_name: string, store: MockStore) {
        this.table_name = table_name;
        this.store = store;
        if (!this.store[table_name]) {
            this.store[table_name] = [];
        }
    }

    select(columns?: string, opts?: { count?: "exact"; head?: boolean }) {
        // Only set operation to "select" if not chaining after insert/update
        if (this.operation !== "insert" && this.operation !== "update") {
            this.operation = "select";
        }
        this.select_columns = columns ?? "*";
        if (opts?.count === "exact") this.count_mode = "exact";
        if (opts?.head) this.head_mode = true;
        return this;
    }

    insert(data: Row | Row[]) {
        this.operation = "insert";
        this.payload = Array.isArray(data) ? data : [data];
        return this;
    }

    update(data: Row) {
        this.operation = "update";
        this.payload = data;
        return this;
    }

    delete() {
        this.operation = "delete";
        return this;
    }

    eq(column: string, value: any) {
        this.filters.push((row) => row[column] === value);
        return this;
    }

    neq(column: string, value: any) {
        this.filters.push((row) => row[column] !== value);
        return this;
    }

    gt(column: string, value: any) {
        this.filters.push((row) => row[column] > value);
        return this;
    }

    gte(column: string, value: any) {
        this.filters.push((row) => row[column] >= value);
        return this;
    }

    lt(column: string, value: any) {
        this.filters.push((row) => row[column] < value);
        return this;
    }

    is(column: string, value: any) {
        this.filters.push((row) => row[column] === value);
        return this;
    }

    in(column: string, values: any[]) {
        this.filters.push((row) => values.includes(row[column]));
        return this;
    }

    not(column: string, op: string, value: any) {
        if (op === "in") {
            const values = String(value)
                .replace(/^\(|\)$/g, "")
                .split(",")
                .map(v => v.replace(/^"|"$/g, "").trim());
            this.filters.push((row) => !values.includes(row[column]));
        } else if (op === "eq") {
            this.filters.push((row) => row[column] !== value);
        }
        return this;
    }

    order(_column: string, _opts?: { ascending?: boolean; referencedTable?: string }) {
        // Simplified: no-op for mock
        return this;
    }

    range(from: number, to: number) {
        // Approximation: set limit based on range
        this.limit_val = to - from + 1;
        return this;
    }

    limit(count: number) {
        this.limit_val = count;
        return this;
    }

    single(): Promise<QueryResult> {
        this.single_mode = true;
        return this.execute();
    }

    async then(resolve: (value: QueryResult) => void, reject?: (err: any) => void) {
        try {
            resolve(await this.execute());
        } catch (e) {
            reject?.(e);
        }
    }

    private apply_filters(rows: Row[]): Row[] {
        let result = rows;
        for (const filter of this.filters) {
            result = result.filter(filter);
        }
        return result;
    }

    private async execute(): Promise<QueryResult> {
        const table = this.store[this.table_name];

        switch (this.operation) {
            case "select": {
                let rows = this.apply_filters(table);
                const count = rows.length;
                if (this.limit_val !== null) {
                    rows = rows.slice(0, this.limit_val);
                }
                if (this.head_mode) {
                    return { data: null, error: null, count };
                }
                if (this.single_mode) {
                    return {
                        data: rows.length > 0 ? rows[0] : null,
                        error: rows.length === 0 ? { message: "Not found", code: "PGRST116" } : null,
                        count,
                    };
                }
                return { data: rows, error: null, count };
            }

            case "insert": {
                const rows = this.payload as Row[];
                const inserted: Row[] = [];
                for (const row of rows) {
                    // Auto-generate id if missing
                    if (!row.id) row.id = crypto.randomUUID();
                    if (!row.created_at) row.created_at = new Date().toISOString();
                    const new_row = { ...row };
                    table.push(new_row);
                    inserted.push(new_row);
                }
                // Support chained .select().single() after .insert()
                if (this.select_columns) {
                    if (this.single_mode) {
                        return { data: inserted[0] ?? null, error: null };
                    }
                    return { data: inserted, error: null };
                }
                return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
            }

            case "update": {
                const matching = this.apply_filters(table);
                for (const row of matching) {
                    Object.assign(row, this.payload);
                }
                // Support chained .select() after .update()
                if (this.select_columns) {
                    return {
                        data: this.single_mode ? (matching[0] ?? null) : matching,
                        error: null,
                    };
                }
                return { data: matching, error: null };
            }

            case "delete": {
                const before_count = table.length;
                const remaining = table.filter((row) => !this.filters.every((f) => f(row)));
                this.store[this.table_name] = remaining;
                return { data: null, error: null, count: before_count - remaining.length };
            }
        }
    }
}

/**
 * Create a mock Supabase client with an in-memory data store.
 * Optionally seed initial data.
 */
export function create_mock_supabase(seed?: MockStore): {
    client: SupabaseClient;
    store: MockStore;
} {
    const store: MockStore = seed ? JSON.parse(JSON.stringify(seed)) : {};

    const client = {
        from: (table: string) => new MockQueryBuilder(table, store),
    } as unknown as SupabaseClient;

    return { client, store };
}

/**
 * Default seed data for tests — mirrors dev-db-reset.sh
 */
export const TEST_SEED: MockStore = {
    projects: [
        {
            id: "00000000-0000-0000-0000-000000000001",
            name: "Test Project",
            description: "A test project",
            status: "Active",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        },
    ],
    passkeys: [
        {
            id: "test-passkey",
            credential_id: "test-credential",
            public_key: "test-key",
            counter: 0,
            device_type: "singleDevice",
            display_name: "Test User",
            role: "user",
        },
        {
            id: "test-admin",
            credential_id: "test-admin-credential",
            public_key: "test-admin-key",
            counter: 0,
            device_type: "singleDevice",
            display_name: "Admin User",
            role: "admin",
        },
    ],
    sessions: [
        {
            id: "00000000-0000-0000-0000-000000000002",
            passkey_id: "test-passkey",
            token: "test-session-token",
            expires_at: "2099-12-31T23:59:59Z",
        },
        {
            id: "00000000-0000-0000-0000-000000000003",
            passkey_id: "test-admin",
            token: "test-admin-session-token",
            expires_at: "2099-12-31T23:59:59Z",
        },
    ],
    features: [
        {
            id: "00000000-0000-0000-0000-000000000010",
            project_id: "00000000-0000-0000-0000-000000000001",
            title: "Test Feature",
            description: "A test feature",
            status: "Draft",
            model: null,
            on_task_failure: "stop",
            auto_approve: false,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        },
    ],
    tasks: [
        {
            id: "00000000-0000-0000-0000-000000000020",
            feature_id: "00000000-0000-0000-0000-000000000010",
            description: "Test task",
            status: "Pending_Approval",
            sort_order: 0,
            retry_count: 0,
            max_retries: 1,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
        },
    ],
    prompts: [],
    traits: [],
    trait_assignments: [],
    skill_links: [],
    agent_runs: [],
    chat_sessions: [],
    chat_messages: [],
    invite_tokens: [],
    resources: [],
};
