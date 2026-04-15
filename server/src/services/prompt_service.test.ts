import { describe, it, expect, mock, beforeEach } from 'bun:test';

mock.module('../utils/logger', () => ({
    logger: { debug: () => {
    }, info: () => {
    }, warn: () => {
    }, error: () => {
    } }
}));
let mock_task_traits: { name: string, content: string }[] = [];
let mock_feature_traits: { name: string, content: string }[] = [];
mock.module('./trait_service', () => ({
    resolve_task_traits: async () => mock_task_traits,
    resolve_feature_traits: async () => mock_feature_traits
}));
mock.module('./skill_service', () => ({ skill_service: { get_skill: async () => null } }));

const RALPH = [
    'You are Clanqr.', '', '**PROJECT:** {{PROJECT_NAME}}',
    '**FEATURE:** {{FEATURE_TITLE}}', '', '{{TASK_HEADER}}', '',
    '{{TASK_DESCRIPTION}}', '', '{{TRAITS_SECTION}}', '{{SKILLS_SECTION}}'
].join('\n');

const MANAGER = [
    'You are a Manager Agent.', '', '**PROJECT:** {{PROJECT_NAME}}',
    '**FEATURE:** {{FEATURE_TITLE}}', '', '{{FEATURE_DESCRIPTION}}', '',
    '{{RESOURCES_SECTION}}', '', '{{TRAITS_SECTION}}'
].join('\n');

let mock_prompt: string | null = null;

function mock_db() {
    const prompts_chain = { select: () => ({ eq: () => ({ single: () =>
        Promise.resolve({ data: mock_prompt ? { content: mock_prompt } : null,
            error: mock_prompt ? null : { message: 'not found' } }) }) }) };
    const empty_chain = { select: () => ({ eq: () =>
        Promise.resolve({ data: [], error: null }) }) };
    return { from: (t: string) => t === 'prompts' ? prompts_chain : empty_chain
    } as unknown as ReturnType<typeof import('../db').create_supabase_client>;
}

import { prompt_service } from './prompt_service';

describe('resolve_for_task — user input delimiters', () => {
    beforeEach(() => {
        mock_task_traits = [];
        mock_feature_traits = [];
    });

    it('wraps task description with <user_input> tags', async () => {
        mock_prompt = RALPH;
        const r = await prompt_service.resolve_for_task('t1',
            { title: 'Fix bug', description: 'Login breaks with +', feature_title: 'Auth', project_name: 'P' }, mock_db());
        expect(r).toContain('<user_input>Login breaks with +</user_input>');
    });

    it('wraps feature title with <user_input> tags', async () => {
        mock_prompt = RALPH;
        const r = await prompt_service.resolve_for_task('t1',
            { title: 'Fix', description: 'Desc', feature_title: 'Auth Improvements', project_name: 'P' }, mock_db());
        expect(r).toContain('<user_input>Auth Improvements</user_input>');
    });

    it('wraps task title with <user_input> tags', async () => {
        mock_prompt = RALPH;
        const r = await prompt_service.resolve_for_task('t1',
            { title: 'Fix login bug', description: 'Desc', feature_title: 'Auth', project_name: 'P' }, mock_db());
        expect(r).toContain('<user_input>Fix login bug</user_input>');
    });

    it('wraps project name with <user_input> tags', async () => {
        mock_prompt = RALPH;
        const r = await prompt_service.resolve_for_task('t1',
            { title: null, description: 'Desc', feature_title: 'F', project_name: 'MyProject' }, mock_db());
        expect(r).toContain('<user_input>MyProject</user_input>');
    });

    it('handles null task title gracefully', async () => {
        mock_prompt = RALPH;
        const r = await prompt_service.resolve_for_task('t1',
            { title: null, description: 'Do something', feature_title: 'F', project_name: 'P' }, mock_db());
        expect(r).toContain('<user_input>Do something</user_input>');
        expect(r).not.toContain('<user_input>null</user_input>');
    });
});

describe('resolve_for_manager — user input delimiters', () => {
    beforeEach(() => {
        mock_task_traits = [];
        mock_feature_traits = [];
    });

    it('wraps feature title with <user_input> tags', async () => {
        mock_prompt = MANAGER;
        const r = await prompt_service.resolve_for_manager(
            { title: 'New Dashboard', description: 'Build it', project: 'P', resources: [] },
            'f1', 'p1', mock_db());
        expect(r).toContain('<user_input>New Dashboard</user_input>');
    });

    it('wraps feature description with <user_input> tags', async () => {
        mock_prompt = MANAGER;
        const r = await prompt_service.resolve_for_manager(
            { title: 'Dash', description: 'Build dashboard with charts', project: 'P', resources: [] },
            'f1', 'p1', mock_db());
        expect(r).toContain('<user_input>Build dashboard with charts</user_input>');
    });

    it('wraps project name with <user_input> tags', async () => {
        mock_prompt = MANAGER;
        const r = await prompt_service.resolve_for_manager(
            { title: 'F', description: 'D', project: 'MyProject', resources: [] },
            'f1', 'p1', mock_db());
        expect(r).toContain('<user_input>MyProject</user_input>');
    });

    it('wraps resource URLs with <user_input> tags', async () => {
        mock_prompt = MANAGER;
        const r = await prompt_service.resolve_for_manager(
            { title: 'F', description: 'D', project: 'P',
                resources: [{ url: 'https://example.com/spec', title: 'Spec' }] },
            'f1', 'p1', mock_db());
        expect(r).toContain('<user_input>https://example.com/spec</user_input>');
    });

    it('handles null description gracefully', async () => {
        mock_prompt = MANAGER;
        const r = await prompt_service.resolve_for_manager(
            { title: 'F', description: null, project: 'P', resources: [] },
            'f1', 'p1', mock_db());
        expect(r).toContain('No description provided');
        expect(r).not.toContain('<user_input>No description provided</user_input>');
    });

    it('wraps resource titles with <user_input> tags', async () => {
        mock_prompt = MANAGER;
        const r = await prompt_service.resolve_for_manager(
            { title: 'F', description: 'D', project: 'P',
                resources: [{ url: 'https://example.com', title: 'User Title' }] },
            'f1', 'p1', mock_db());
        expect(r).toContain('<user_input>User Title</user_input>');
    });
});
