/**
 * Custom agent definitions for the Copilot SDK.
 * Registry-driven: loads agent types from agent_registry_service instead of hardcoded builders.
 */
import { agent_registry_service, type AgentTypeInfo } from '../services/agent_registry_service';

export interface CustomAgentDef {
    name: string
    display_name: string
    description: string
    tools: string[]
    prompt: string
}

function capitalize_first(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function map_agent_type(info: AgentTypeInfo): CustomAgentDef {
    return {
        name: info.name,
        display_name: `${capitalize_first(info.name)} Agent`,
        description: info.description,
        tools: info.tools,
        prompt: info.prompt_content
    };
}

/** Get all registered agent type definitions for SDK session creation */
export async function get_custom_agents(): Promise<CustomAgentDef[]> {
    const agent_types = await agent_registry_service.list_agent_types();
    return agent_types.map(map_agent_type);
}

/** Get a single agent definition by type name */
export async function get_agent_def(agent_type: string): Promise<CustomAgentDef | null> {
    const info = await agent_registry_service.get_agent_type(agent_type);
    if (!info) return null;
    return map_agent_type(info);
}
