// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, DashboardSummary, Issue } from "@paperclipai/shared";
import type { CompanyArtifact } from "@/api/artifacts";
import { CommandCenter } from "./CommandCenter";

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}));

vi.mock("@/components/ActiveAgentsPanel", () => ({
  ActiveAgentsPanel: () => <div>Live operations panel</div>,
}));

vi.mock("@/components/ActivityRow", () => ({
  ActivityRow: () => <div>Activity event</div>,
}));

vi.mock("@/plugins/slots", () => ({
  PluginSlotOutlet: () => <div>Plugin slots</div>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const dashboard: DashboardSummary = {
  companyId: "company-1",
  agents: { active: 2, running: 1, paused: 0, error: 0 },
  tasks: { open: 3, inProgress: 1, blocked: 0, done: 4 },
  costs: { monthSpendCents: 1200, monthBudgetCents: 10000, monthUtilizationPercent: 12 },
  pendingApprovals: 0,
  budgets: { activeIncidents: 0, pendingApprovals: 0, pausedAgents: 0, pausedProjects: 0 },
  runActivity: [],
};

const agents = [{
  id: "agent-1",
  companyId: "company-1",
  name: "Founder",
  urlKey: "founder",
  role: "ceo",
  title: null,
  icon: null,
  status: "running",
  reportsTo: null,
  capabilities: null,
  adapterType: "hermes_local",
  adapterConfig: { profile: "founder" },
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
}] satisfies Agent[];

const issue = {
  id: "issue-1",
  identifier: "CEO-12",
  title: "Review delivery plan",
  status: "in_progress",
  assigneeAgentId: "agent-1",
  updatedAt: new Date("2026-08-04T12:00:00Z"),
} as Issue;

const artifact: CompanyArtifact = {
  id: "artifact-1",
  source: "work_product",
  mediaKind: "document",
  title: "Delivery brief",
  previewText: null,
  contentType: "text/markdown",
  contentPath: null,
  openPath: null,
  downloadPath: null,
  issue: { id: "issue-1", identifier: "CEO-12", title: "Review delivery plan" },
  project: null,
  createdByAgent: { id: "agent-1", name: "Founder" },
  updatedAt: "2026-08-04T12:00:00Z",
  href: "/issues/CEO-12",
};

describe("CommandCenter", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders live command-center sections with real work and evidence", async () => {
    await act(async () => {
      root.render(
        <CommandCenter
          companyId="company-1"
          companyName="CEO Agent Labs"
          summary={dashboard}
          agents={agents}
          issues={[issue]}
          artifacts={[artifact]}
          activity={[]}
          agentMap={new Map(agents.map((agent) => [agent.id, agent]))}
          userProfileMap={new Map()}
          entityNameMap={new Map()}
          entityTitleMap={new Map()}
          lastUpdatedAt={new Date("2026-08-04T12:00:00Z")}
        />,
      );
    });

    expect(container.textContent).toContain("CEO Agent");
    expect(container.textContent).toContain("CEO Agent Labs");
    expect(container.textContent).toContain("Founder principal");
    expect(container.textContent).toContain("No exceptions requiring founder attention");
    expect(container.textContent).toContain("Work in motion");
    expect(container.textContent).toContain("CEO-12");
    expect(container.textContent).toContain("Live operations");
    expect(container.textContent).toContain("Delivery brief");
    expect(container.textContent).toContain("Agent topology");
  });

  it("names disconnected evidence and audit states without inventing data", async () => {
    await act(async () => {
      root.render(
        <CommandCenter
          companyId="company-1"
          companyName="CEO Agent Labs"
          summary={dashboard}
          agents={[]}
          issues={[]}
          artifacts={[]}
          activity={[]}
          agentMap={new Map()}
          userProfileMap={new Map()}
          entityNameMap={new Map()}
          entityTitleMap={new Map()}
          lastUpdatedAt={null}
        />,
      );
    });

    expect(container.textContent).toContain("No agents are connected to this company yet.");
    expect(container.textContent).toContain("No company artifacts are available yet.");
    expect(container.textContent).toContain("No recorded company activity is available yet.");
    expect(container.textContent).toContain("Last update unavailable");
  });

  it("renders explicit agent and work failures instead of empty or loading claims", async () => {
    await act(async () => {
      root.render(
        <CommandCenter
          companyId="company-1"
          companyName="CEO Agent Labs"
          summary={dashboard}
          agentsError
          issuesError
          artifacts={[]}
          activity={[]}
          agentMap={new Map()}
          userProfileMap={new Map()}
          entityNameMap={new Map()}
          entityTitleMap={new Map()}
          lastUpdatedAt={null}
        />,
      );
    });

    expect(container.textContent).toContain("Agent topology could not be loaded.");
    expect(container.textContent).toContain("Company work could not be loaded.");
    expect(container.textContent).toContain("Live agent operations could not be loaded.");
    expect(container.textContent).not.toContain("No agents are connected to this company yet.");
    expect(container.textContent).not.toContain("Loading work from the company control plane.");
  });
});
