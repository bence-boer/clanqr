export interface AgentTypeVisual {
    label: string
    icon: string
    color: string
    css_var: string
}

export type AgentTypeKey =
  | 'orchestrator' | 'explorer' | 'architect' | 'implementer'
  | 'verifier' | 'reviewer' | 'synthesizer' | 'researcher'
  | 'chat' | 'custom';

export const AGENT_TYPE_VISUALS: Record<AgentTypeKey, AgentTypeVisual> = {
    orchestrator: { label: 'Orchestrator', icon: 'hub', color: '#d4af37', css_var: '--agent-orchestrator' },
    explorer: { label: 'Explorer', icon: 'explore', color: '#8B5CF6', css_var: '--agent-explorer' },
    architect: { label: 'Architect', icon: 'architecture', color: '#F59E0B', css_var: '--agent-architect' },
    implementer: { label: 'Implementer', icon: 'build', color: '#10B981', css_var: '--agent-implementer' },
    verifier: { label: 'Verifier', icon: 'verified', color: '#3B82F6', css_var: '--agent-verifier' },
    reviewer: { label: 'Reviewer', icon: 'rate_review', color: '#EC4899', css_var: '--agent-reviewer' },
    synthesizer: { label: 'Synthesizer', icon: 'merge', color: '#6366F1', css_var: '--agent-synthesizer' },
    researcher: { label: 'Researcher', icon: 'search', color: '#14B8A6', css_var: '--agent-researcher' },
    chat: { label: 'Chat', icon: 'chat', color: 'var(--fg-muted)', css_var: '--fg-muted' },
    custom: { label: 'Custom', icon: 'smart_toy', color: 'var(--fg-muted)', css_var: '--fg-muted' }
};

export function get_agent_visual(agent_type: string): AgentTypeVisual {
    return AGENT_TYPE_VISUALS[agent_type as AgentTypeKey] ?? AGENT_TYPE_VISUALS.custom;
}
