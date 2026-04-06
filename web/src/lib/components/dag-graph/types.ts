export interface DagNode {
    id: string
    label: string
    status: string
    agent_type: string
    wave?: number
    verification_status?: string
    description?: string
    depends_on?: string[]
}

export interface DagEdge {
    from: string
    to: string
}

export interface DagLayoutNode {
    id: string
    x: number
    y: number
    width: number
    height: number
    layer: number
    node: DagNode
}

export interface DagLayoutEdge {
    from: string
    to: string
    path: string
}

export interface DagLayout {
    nodes: DagLayoutNode[]
    edges: DagLayoutEdge[]
    width: number
    height: number
}
