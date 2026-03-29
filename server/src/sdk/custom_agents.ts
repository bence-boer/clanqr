/**
 * Custom agent definitions for the Copilot SDK.
 * Each agent has scoped tools and a dedicated system prompt.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SdkAgentType } from './types';

const PROMPTS_DIR = join(import.meta.dir, '../../../agents/prompts');

function load_prompt(filename: string): string {
    try {
        return readFileSync(join(PROMPTS_DIR, filename), 'utf-8');
    }
    catch {
        return `You are an AI assistant. Follow instructions precisely.`;
    }
}

export interface CustomAgentDef {
    name: string
    display_name: string
    description: string
    tools: string[]
    prompt: string
}

function build_manager_agent(): CustomAgentDef {
    return {
        name: 'manager',
        display_name: 'Manager Agent',
        description: 'Senior technical architect that plans implementation work and produces task breakdowns',
        tools: ['grep', 'glob', 'view'],
        prompt: load_prompt('manager.md')
    };
}

function build_ralph_agent(): CustomAgentDef {
    return {
        name: 'ralph',
        display_name: 'Ralph Agent',
        description: 'Coding agent that executes specific implementation tasks with full tool access',
        tools: ['view', 'edit', 'bash', 'grep', 'glob', 'create'],
        prompt: load_prompt('ralph.md')
    };
}

function build_researcher_agent(): CustomAgentDef {
    return {
        name: 'researcher',
        display_name: 'Research Agent',
        description: 'Explores codebases, answers questions, and provides architectural analysis using read-only tools',
        tools: ['grep', 'glob', 'view'],
        prompt: load_prompt('researcher.md')
    };
}

/** Get all custom agent definitions */
export function get_custom_agents(): CustomAgentDef[] {
    return [build_manager_agent(), build_ralph_agent(), build_researcher_agent()];
}

/** Get a single agent definition by type */
export function get_agent_def(agent_type: SdkAgentType): CustomAgentDef {
    const agents: Record<SdkAgentType, () => CustomAgentDef> = {
        manager: build_manager_agent,
        ralph: build_ralph_agent,
        researcher: build_researcher_agent
    };
    return agents[agent_type]();
}
