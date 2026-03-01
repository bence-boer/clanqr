import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { MockQueryBuilder, type MockStore } from './mock_query_builder';

// Re-export for backward compatibility
export type { MockStore } from './mock_query_builder';
export { TEST_SEED } from './test-seed';

/**
 * Create a mock Supabase client with an in-memory data store.
 * Optionally seed initial data.
 */
export function create_mock_supabase(seed?: MockStore): {
    client: SupabaseClient
    store: MockStore
} {
    const store: MockStore = seed ? JSON.parse(JSON.stringify(seed)) : {};

    const client = createClient('http://localhost', 'anon');
    Object.assign(client, {
        from: (table: string) => new MockQueryBuilder(table, store)
    });

    return { client, store };
}
