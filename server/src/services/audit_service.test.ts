import { describe, it, expect, mock, beforeEach, spyOn } from 'bun:test';

// Minimal stubs — only needed so the module loads without crashing.
// Test behavior is driven by directly injected mocks below.
mock.module('../db', () => ({
    create_supabase_client: () => ({ from: () => ({ insert: () => Promise.resolve({ error: null }) }) }),
    TypedSupabaseClient: undefined
}));

mock.module('../utils/logger', () => ({
    logger: {
        debug: () => {
        },
        info: () => {
        },
        warn: () => {
        },
        error: () => {
        }
    }
}));

import { AuditService } from './audit_service';
import { logger } from '../utils/logger';

/** Create a fresh AuditService with a directly injected mock db */
function create_test_audit() {
    const insert_calls: Record<string, unknown>[] = [];
    let insert_error: { message: string } | null = null;

    const mock_db = {
        from: (table: string) => ({
            insert: (row: Record<string, unknown>) => {
                insert_calls.push({ table, ...row });
                return Promise.resolve({ error: insert_error });
            }
        })
    };

    const service = new AuditService();
    Object.assign(service, { db: mock_db });

    return {
        service,
        insert_calls,
        set_error: (err: { message: string } | null) => {
            insert_error = err;
        }
    };
}

describe('AuditService', () => {
    let warn_spy: ReturnType<typeof spyOn>;

    beforeEach(() => {
        warn_spy = spyOn(logger, 'warn');
    });

    describe('log_event', () => {
        it('inserts audit event with correct params', async () => {
            const { service, insert_calls } = create_test_audit();
            service.log_event('sess-1', 'implementer', 'tool_call', { tool_name: 'edit' });
            await Bun.sleep(10);
            expect(insert_calls).toHaveLength(1);
            expect(insert_calls[0]).toEqual({
                table: 'audit_events',
                session_id: 'sess-1',
                event_type: 'tool_call',
                agent_type: 'implementer',
                payload: { tool_name: 'edit' }
            });
        });

        it('handles null agent_type', async () => {
            const { service, insert_calls } = create_test_audit();
            service.log_event('sess-2', null, 'session_start', { info: 'started' });
            await Bun.sleep(10);
            expect(insert_calls[0]).toMatchObject({ agent_type: null });
        });
    });

    describe('log_tool_call', () => {
        it('inserts tool_call event with serialized args', async () => {
            const { service, insert_calls } = create_test_audit();
            service.log_tool_call('sess-1', 'explorer', 'grep', { pattern: 'foo' });
            await Bun.sleep(10);
            expect(insert_calls).toHaveLength(1);
            expect(insert_calls[0]).toMatchObject({
                table: 'audit_events',
                session_id: 'sess-1',
                event_type: 'tool_call',
                agent_type: 'explorer',
                payload: { tool_name: 'grep', tool_args: '{"pattern":"foo"}' }
            });
        });

        it('truncates args to 2000 chars', async () => {
            const { service, insert_calls } = create_test_audit();
            const large_args = { data: 'x'.repeat(3000) };
            service.log_tool_call('sess-1', null, 'bash', large_args);
            await Bun.sleep(10);
            const payload = insert_calls[0].payload as Record<string, string>;
            expect(payload.tool_args.length).toBeLessThanOrEqual(2000);
        });

        it('handles null/undefined args gracefully', async () => {
            const { service, insert_calls } = create_test_audit();
            service.log_tool_call('sess-1', null, 'view', null);
            await Bun.sleep(10);
            const payload = insert_calls[0].payload as Record<string, string>;
            expect(payload.tool_args).toBe('{}');
        });
    });

    describe('log_tool_result', () => {
        it('inserts tool_result event with summary', async () => {
            const { service, insert_calls } = create_test_audit();
            service.log_tool_result('sess-1', 'implementer', 'edit', 'File updated');
            await Bun.sleep(10);
            expect(insert_calls[0]).toMatchObject({
                table: 'audit_events',
                event_type: 'tool_result',
                payload: { tool_name: 'edit', summary: 'File updated' }
            });
        });

        it('truncates summary to 2000 chars', async () => {
            const { service, insert_calls } = create_test_audit();
            const long_summary = 'y'.repeat(3000);
            service.log_tool_result('sess-1', null, 'bash', long_summary);
            await Bun.sleep(10);
            const payload = insert_calls[0].payload as Record<string, string>;
            expect(payload.summary.length).toBe(2000);
        });
    });

    describe('log_admin_action', () => {
        it('inserts admin event with admin: prefixed session_id', async () => {
            const { service, insert_calls } = create_test_audit();
            service.log_admin_action('user-42', 'admin_role_change', { target_id: 'user-7', new_role: 'admin' });
            await Bun.sleep(10);
            expect(insert_calls).toHaveLength(1);
            expect(insert_calls[0]).toEqual({
                table: 'audit_events',
                session_id: 'admin:user-42',
                event_type: 'admin_role_change',
                agent_type: null,
                payload: { target_id: 'user-7', new_role: 'admin' }
            });
        });

        it('handles admin_session_revoke event type', async () => {
            const { service, insert_calls } = create_test_audit();
            service.log_admin_action('admin-1', 'admin_session_revoke', { target_id: 'user-5' });
            await Bun.sleep(10);
            expect(insert_calls[0]).toMatchObject({
                event_type: 'admin_session_revoke',
                session_id: 'admin:admin-1'
            });
        });

        it('handles admin_user_delete event type', async () => {
            const { service, insert_calls } = create_test_audit();
            service.log_admin_action('admin-1', 'admin_user_delete', { target_id: 'user-5' });
            await Bun.sleep(10);
            expect(insert_calls[0]).toMatchObject({
                event_type: 'admin_user_delete',
                session_id: 'admin:admin-1'
            });
        });
    });

    describe('error handling', () => {
        it('logs warning when insert fails but does not throw', async () => {
            const { service, set_error } = create_test_audit();
            set_error({ message: 'connection refused' });
            service.log_event('sess-1', null, 'error', { msg: 'boom' });
            await Bun.sleep(10);
            expect(warn_spy).toHaveBeenCalledWith(
                'Audit insert failed',
                expect.objectContaining({ service: 'audit', error: 'connection refused' })
            );
        });

        it('logs warning when admin insert fails but does not throw', async () => {
            const { service, set_error } = create_test_audit();
            set_error({ message: 'timeout' });
            service.log_admin_action('admin-1', 'admin_role_change', { target_id: 'u1' });
            await Bun.sleep(10);
            expect(warn_spy).toHaveBeenCalledWith(
                'Audit insert failed',
                expect.objectContaining({ error: 'timeout' })
            );
        });
    });
});
