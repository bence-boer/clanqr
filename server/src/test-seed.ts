import type { MockStore } from './mock_query_builder';

/**
 * Default seed data for tests — mirrors dev-db-reset.sh
 */
export const TEST_SEED: MockStore = {
    projects: [
        {
            id: '00000000-0000-0000-0000-000000000001',
            name: 'Test Project',
            description: 'A test project',
            status: 'Active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z'
        }
    ],
    passkeys: [
        {
            id: 'test-passkey',
            credential_id: 'test-credential',
            public_key: 'test-key',
            counter: 0,
            device_type: 'singleDevice',
            display_name: 'Test User',
            role: 'user'
        },
        {
            id: 'test-admin',
            credential_id: 'test-admin-credential',
            public_key: 'test-admin-key',
            counter: 0,
            device_type: 'singleDevice',
            display_name: 'Admin User',
            role: 'admin'
        }
    ],
    sessions: [
        {
            id: '00000000-0000-0000-0000-000000000002',
            passkey_id: 'test-passkey',
            token: 'test-session-token',
            expires_at: '2099-12-31T23:59:59Z'
        },
        {
            id: '00000000-0000-0000-0000-000000000003',
            passkey_id: 'test-admin',
            token: 'test-admin-session-token',
            expires_at: '2099-12-31T23:59:59Z'
        }
    ],
    features: [
        {
            id: '00000000-0000-0000-0000-000000000010',
            project_id: '00000000-0000-0000-0000-000000000001',
            title: 'Test Feature',
            description: 'A test feature',
            status: 'Draft',
            model: null,
            on_task_failure: 'stop',
            auto_approve: false,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z'
        }
    ],
    tasks: [
        {
            id: '00000000-0000-0000-0000-000000000020',
            feature_id: '00000000-0000-0000-0000-000000000010',
            description: 'Test task',
            status: 'Pending_Approval',
            sort_order: 0,
            retry_count: 0,
            max_retries: 1,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z'
        }
    ],
    prompts: [],
    traits: [],
    trait_assignments: [],
    skill_links: [],
    agent_runs: [],
    chat_sessions: [],
    chat_messages: [],
    invite_tokens: [],
    resources: []
};
