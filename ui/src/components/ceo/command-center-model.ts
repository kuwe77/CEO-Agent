import type { Agent, DashboardSummary } from "@paperclipai/shared";

export type OperationalStateKind =
  | "budget_incident"
  | "agent_error"
  | "blocker"
  | "approval"
  | "healthy";

export interface OperationalState {
  kind: OperationalStateKind;
  label: string;
  route: string;
}

export interface TopologyPosition {
  x: number;
  y: number;
}

export interface TopologyNode {
  id: string;
  agent: Agent;
  profile: string | null;
  position: TopologyPosition;
}

export interface TopologyEdge {
  id: string;
  from: string;
  to: string;
}

export interface AgentTopology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function objectValue(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

export function extractHermesProfile(
  agent: Pick<Agent, "metadata" | "adapterConfig" | "adapterType">,
): string | null {
  if (agent.adapterType !== "hermes_gateway" && agent.adapterType !== "hermes_local") {
    return null;
  }

  const candidates = [
    objectValue(agent.metadata, "hermesProfile"),
    objectValue(agent.metadata, "hermesProfileSlug"),
    objectValue(agent.adapterConfig, "hermesProfile"),
    objectValue(objectValue(agent.adapterConfig, "env"), "HERMES_PROFILE"),
  ];

  for (const candidate of candidates) {
    const profile = nonEmptyString(candidate);
    if (profile) return profile;
  }
  return null;
}

export function reconcileTopologyPositions(
  current: ReadonlyMap<string, TopologyPosition>,
  defaults: ReadonlyMap<string, TopologyPosition>,
): Map<string, TopologyPosition> {
  return new Map(
    [...defaults].map(([id, fallback]) => [id, current.get(id) ?? fallback]),
  );
}

export function getOperationalState(summary: DashboardSummary): OperationalState {
  if (summary.budgets.activeIncidents > 0) {
    return { kind: "budget_incident", label: "Budget incident requires attention", route: "/costs" };
  }
  if (summary.agents.error > 0) {
    return { kind: "agent_error", label: "Agent error requires attention", route: "/agents" };
  }
  if (summary.tasks.blocked > 0) {
    return { kind: "blocker", label: "Blocked work requires attention", route: "/issues?attention=blocked" };
  }
  if (summary.pendingApprovals + summary.budgets.pendingApprovals > 0) {
    return { kind: "approval", label: "Approval requires attention", route: "/approvals" };
  }
  return { kind: "healthy", label: "No exceptions requiring founder attention", route: "/dashboard" };
}

function sortAgents(agents: readonly Agent[]): Agent[] {
  return [...agents].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) || left.id.localeCompare(right.id),
  );
}

export function buildTopology(agents: readonly Agent[]): AgentTopology {
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  const children = new Map<string, Agent[]>();
  const roots: Agent[] = [];

  for (const agent of agents) {
    if (!agent.reportsTo || !byId.has(agent.reportsTo)) {
      roots.push(agent);
      continue;
    }
    const reports = children.get(agent.reportsTo) ?? [];
    reports.push(agent);
    children.set(agent.reportsTo, reports);
  }

  const layers: Agent[][] = [];
  let layer = sortAgents(roots);
  const seen = new Set<string>();
  while (layer.length > 0) {
    const current = layer.filter((agent) => !seen.has(agent.id));
    if (current.length === 0) break;
    current.forEach((agent) => seen.add(agent.id));
    layers.push(current);
    layer = sortAgents(current.flatMap((agent) => children.get(agent.id) ?? []));
  }

  const disconnected = sortAgents(agents.filter((agent) => !seen.has(agent.id)));
  if (disconnected.length > 0) layers.push(disconnected);

  const positionById = new Map<string, TopologyPosition>();
  const maxNodesPerVisualRow = 4;
  let visualRow = 0;
  layers.forEach((agentsInLayer) => {
    agentsInLayer.forEach((agent, index) => {
      const column = index % maxNodesPerVisualRow;
      const rowOffset = Math.floor(index / maxNodesPerVisualRow);
      positionById.set(agent.id, { x: 48 + column * 272, y: 40 + (visualRow + rowOffset) * 156 });
    });
    visualRow += Math.max(1, Math.ceil(agentsInLayer.length / maxNodesPerVisualRow));
  });

  return {
    nodes: layers.flat().map((agent) => ({
      id: agent.id,
      agent,
      profile: extractHermesProfile(agent),
      position: positionById.get(agent.id)!,
    })),
    edges: sortAgents(agents)
      .filter((agent) => agent.reportsTo && byId.has(agent.reportsTo))
      .map((agent) => ({ id: `${agent.id}->${agent.reportsTo}`, from: agent.id, to: agent.reportsTo! })),
  };
}
