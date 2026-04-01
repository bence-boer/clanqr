type Row = Record<string, unknown>;

export interface MockStore {
    [table: string]: Row[]
}

interface QueryResult {
    data: unknown
    error: null | { message: string, code: string }
    count?: number
}

export class MockQueryBuilder {
    private table_name: string;
    private store: MockStore;
    private filters: Array<(row: Row) => boolean> = [];
    private select_columns: string | null = null;
    private count_mode: 'exact' | null = null;
    private head_mode = false;
    private limit_val: number | null = null;
    private single_mode = false;
    private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private payload: unknown = null;

    constructor(table_name: string, store: MockStore) {
        this.table_name = table_name;
        this.store = store;
        if (!this.store[table_name]) {
            this.store[table_name] = [];
        }
    }

    select(columns?: string, opts?: { count?: 'exact', head?: boolean }) {
        if (this.operation !== 'insert' && this.operation !== 'update') {
            this.operation = 'select';
        }
        this.select_columns = columns ?? '*';
        if (opts?.count === 'exact') this.count_mode = 'exact';
        if (opts?.head) this.head_mode = true;
        return this;
    }

    insert(data: Row | Row[]) {
        this.operation = 'insert';
        this.payload = Array.isArray(data) ? data : [data];
        return this;
    }

    update(data: Row) {
        this.operation = 'update';
        this.payload = data;
        return this;
    }

    delete() {
        this.operation = 'delete';
        return this;
    }

    eq(column: string, value: unknown) {
        this.filters.push((row) => row[column] === value);
        return this;
    }

    neq(column: string, value: unknown) {
        this.filters.push((row) => row[column] !== value);
        return this;
    }

    gt(column: string, value: unknown) {
        this.filters.push((row) => (row[column] as number | string) > (value as number | string));
        return this;
    }

    gte(column: string, value: unknown) {
        this.filters.push((row) => (row[column] as number | string) >= (value as number | string));
        return this;
    }

    lt(column: string, value: unknown) {
        this.filters.push((row) => (row[column] as number | string) < (value as number | string));
        return this;
    }

    is(column: string, value: unknown) {
        this.filters.push((row) => row[column] === value);
        return this;
    }

    in(column: string, values: unknown[]) {
        this.filters.push((row) => values.includes(row[column]));
        return this;
    }

    not(column: string, op: string, value: unknown) {
        if (op === 'in') {
            const values = String(value)
                .replace(/^\(|\)$/g, '')
                .split(',')
                .map((v) => v.replace(/^"|"$/g, '').trim());
            this.filters.push((row) => !values.includes(row[column] as string));
        }
        else if (op === 'eq') {
            this.filters.push((row) => row[column] !== value);
        }
        return this;
    }

    order() {
        return this;
    }

    range(from: number, to: number) {
        this.limit_val = to - from + 1;
        return this;
    }

    limit(count: number) {
        this.limit_val = count;
        return this;
    }

    returns() {
        // Runtime no-op — Supabase uses this for TypeScript type narrowing only
        return this;
    }

    single(): Promise<QueryResult> {
        this.single_mode = true;
        return this.execute();
    }

    async then(resolve: (value: QueryResult) => void, reject?: (err: unknown) => void) {
        try {
            resolve(await this.execute());
        }
        catch (e) {
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
            case 'select': {
                let rows = this.apply_filters(table);
                const count = rows.length;
                if (this.limit_val !== null) rows = rows.slice(0, this.limit_val);
                if (this.head_mode) return { data: null, error: null, count };
                if (this.single_mode) {
                    return {
                        data: rows.length > 0 ? rows[0] : null,
                        error: rows.length === 0 ? { message: 'Not found', code: 'PGRST116' } : null,
                        count
                    };
                }
                return { data: rows, error: null, count };
            }

            case 'insert': {
                const rows = this.payload as Row[];
                const inserted: Row[] = [];
                for (const row of rows) {
                    if (!row.id) row.id = crypto.randomUUID();
                    if (!row.created_at) row.created_at = new Date().toISOString();
                    const new_row = { ...row };
                    table.push(new_row);
                    inserted.push(new_row);
                }
                if (this.select_columns) {
                    if (this.single_mode) return { data: inserted[0] ?? null, error: null };
                    return { data: inserted, error: null };
                }
                return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
            }

            case 'update': {
                const matching = this.apply_filters(table);
                for (const row of matching) Object.assign(row, this.payload);
                if (this.select_columns) {
                    return { data: this.single_mode ? (matching[0] ?? null) : matching, error: null };
                }
                return { data: matching, error: null };
            }

            case 'delete': {
                const before_count = table.length;
                const remaining = table.filter((row) => !this.filters.every((f) => f(row)));
                this.store[this.table_name] = remaining;
                return { data: null, error: null, count: before_count - remaining.length };
            }
        }
    }
}
