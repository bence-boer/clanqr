import { describe, expect, it } from 'bun:test';
import { validate_dag, insert_dag_from_plan, type DagTask } from './dag_service';
import type { TypedSupabaseClient } from '../db';

function make_task(id: string, deps: string[] = []): DagTask {
    return {
        task_id: id,
        description: `Task ${id}`,
        assignee_role: 'implementer',
        dependencies: deps,
        context_paths: [],
        execution_strategy: 'sequential',
        skills: [],
        definition_of_done: `${id} passes tests`
    };
}

describe('validate_dag', () => {
    it('accepts a simple linear DAG (A→B→C)', () => {
        const tasks = [make_task('A'), make_task('B', ['A']), make_task('C', ['B'])];
        const result = validate_dag(tasks);
        expect(result).toEqual({ valid: true, errors: [] });
    });

    it('accepts a diamond DAG (A→B, A→C, B→D, C→D)', () => {
        const tasks = [
            make_task('A'),
            make_task('B', ['A']),
            make_task('C', ['A']),
            make_task('D', ['B', 'C'])
        ];
        const result = validate_dag(tasks);
        expect(result).toEqual({ valid: true, errors: [] });
    });

    it('detects a cycle (A→B→C→A)', () => {
        const tasks = [
            make_task('A', ['C']),
            make_task('B', ['A']),
            make_task('C', ['B'])
        ];
        const result = validate_dag(tasks);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Cycle detected in task dependency graph');
    });

    it('reports missing dependency references', () => {
        const tasks = [make_task('A', ['Z'])];
        const result = validate_dag(tasks);
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toInclude('unknown task "Z"');
    });

    it('accepts an empty task array', () => {
        const result = validate_dag([]);
        expect(result).toEqual({ valid: true, errors: [] });
    });

    it('accepts a single task with no dependencies', () => {
        const result = validate_dag([make_task('solo')]);
        expect(result).toEqual({ valid: true, errors: [] });
    });

    it('detects a self-dependency as a cycle', () => {
        const tasks = [make_task('A', ['A'])];
        const result = validate_dag(tasks);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Cycle detected in task dependency graph');
    });

    it('reports multiple missing dependencies at once', () => {
        const tasks = [make_task('A', ['X', 'Y'])];
        const result = validate_dag(tasks);
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toInclude('"X"');
        expect(result.errors[1]).toInclude('"Y"');
    });

    it('reports both missing dep and cycle errors', () => {
        const tasks = [make_task('A', ['B', 'Z']), make_task('B', ['A'])];
        const result = validate_dag(tasks);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('unknown task'))).toBe(true);
        expect(result.errors.some((e) => e.includes('Cycle'))).toBe(true);
    });
});

describe('insert_dag_from_plan', () => {
    it('throws when task bulk insert fails', async () => {
        const failing_db = {
            from: () => ({
                insert: () => ({
                    select: () => Promise.resolve({ data: null, error: { message: 'DB error' } })
                })
            })
        } as unknown as TypedSupabaseClient;
        const tasks = [make_task('A')];
        await expect(insert_dag_from_plan('feat-1', tasks, failing_db)).rejects.toThrow(
            'Failed to insert DAG tasks'
        );
    });

    it('throws when insert returns no data', async () => {
        const empty_db = {
            from: () => ({
                insert: () => ({
                    select: () => Promise.resolve({ data: null, error: null })
                })
            })
        } as unknown as TypedSupabaseClient;
        const tasks = [make_task('A')];
        await expect(insert_dag_from_plan('feat-1', tasks, empty_db)).rejects.toThrow(
            'no data returned'
        );
    });
});
