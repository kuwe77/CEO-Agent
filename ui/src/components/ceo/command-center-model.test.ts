import { describe, expect, it } from "vitest";
import type { Agent, DashboardSummary } from "@paperclipai/shared";
import {
  buildTopology,
  extractHermesProfile,
  getOperationalState,
  reconcileTopologyPositions,
} from "./command-center-model";

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: "agent-1",
    companyId: "company-1",
    name: "Operator",
    urlKey: "operator",
    role: "general",
    title: null,
    icon: null,
    status: "active",
    reportsTo: null,
    capabilities: null,
    adapterType: "hermes_local",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    companyId: "company-1",
    agents: { active: 1, running: 0, paused: 0, error: 0 },
    tasks: { open: 0, inProgress: 0, blocked: 0, done: 0 },
    costs: { monthSpendCents: 0, monthBudgetCents: 0, monthUtilizationPercent: 0 },
    pendingApprovals: 0,
    budgets: { activeIncidents: 0, pendingApprovals: 0, pausedAgents: 0, pausedProjects: 0 },
    runActivity: [],
    ...overrides,
  };
}

describe("extractHermesProfile", () => {
  it("prefers the explicit metadata Hermes profile", () => {
    expect(extractHermesProfile(agent({
      metadata: { hermesProfile: "founder" },
      adapterConfig: { profile: "fallback" },
    }))).toBe("founder");
  });

  it("reads each supported adapter configuration path", () => {
    expect(extractHermesProfile(agent({ adapterConfig: { hermesProfile: "ops" } }))).toBe("ops");
    expect(extractHermesProfile(agent({ adapterConfig: { env: { HERMES_PROFILE: "delivery" } } }))).toBe("delivery");
  });

  it("returns null for absent or blank values", () => {
    expect(extractHermesProfile(agent({ metadata: { hermesProfileSlug: "  " }, adapterConfig: {} }))).toBeNull();
  });

  it("ignores generic profile fields and profile metadata on non-Hermes adapters", () => {
    expect(extractHermesProfile(agent({ adapterConfig: { profile: "not-a-contract" } }))).toBeNull();
    expect(extractHermesProfile(agent({
      adapterType: "codex_local",
      metadata: { hermesProfile: "not-a-hermes-agent" },
    }))).toBeNull();
  });
});

describe("getOperationalState", () => {
  it("prioritizes budget incidents over all other attention", () => {
    expect(getOperationalState(summary({
      agents: { active: 1, running: 0, paused: 0, error: 2 },
      tasks: { open: 3, inProgress: 1, blocked: 1, done: 0 },
      pendingApprovals: 1,
      budgets: { activeIncidents: 1, pendingApprovals: 0, pausedAgents: 1, pausedProjects: 0 },
    })).kind).toBe("budget_incident");
  });

  it("uses agent errors, blockers, approvals, then healthy in priority order", () => {
    expect(getOperationalState(summary({ agents: { active: 1, running: 0, paused: 0, error: 1 } })).kind).toBe("agent_error");
    expect(getOperationalState(summary({ tasks: { open: 1, inProgress: 0, blocked: 1, done: 0 } })).kind).toBe("blocker");
    expect(getOperationalState(summary({ pendingApprovals: 1 })).kind).toBe("approval");
    expect(getOperationalState(summary()).kind).toBe("healthy");
  });
});

describe("buildTopology", () => {
  it("creates sorted live-agent nodes and only valid reporting edges with deterministic positions", () => {
    const topology = buildTopology([
      agent({ id: "engineer", name: "Engineer", reportsTo: "cto" }),
      agent({ id: "ceo", name: "CEO", role: "ceo" }),
      agent({ id: "orphan", name: "Orphan", reportsTo: "missing" }),
      agent({ id: "cto", name: "CTO", role: "cto", reportsTo: "ceo" }),
    ]);

    expect(topology.nodes.map((node) => [node.id, node.position])).toEqual([
      ["ceo", { x: 48, y: 40 }],
      ["orphan", { x: 320, y: 40 }],
      ["cto", { x: 48, y: 196 }],
      ["engineer", { x: 48, y: 352 }],
    ]);
    expect(topology.edges).toEqual([
      { id: "cto->ceo", from: "cto", to: "ceo" },
      { id: "engineer->cto", from: "engineer", to: "cto" },
    ]);
  });

  it("preserves unsaved positions for existing nodes when topology data is reconciled", () => {
    const current = new Map([
      ["ceo", { x: 512, y: 144 }],
      ["removed", { x: 48, y: 48 }],
    ]);
    const defaults = new Map([
      ["ceo", { x: 48, y: 40 }],
      ["operator", { x: 48, y: 196 }],
    ]);

    expect([...reconcileTopologyPositions(current, defaults)]).toEqual([
      ["ceo", { x: 512, y: 144 }],
      ["operator", { x: 48, y: 196 }],
    ]);
  });
});
