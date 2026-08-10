// @vitest-environment jsdom

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("renders a founder-first hierarchy with real work and evidence", async () => {
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
    expect(container.textContent).toContain("Today");
    expect(container.textContent).toContain("Business health");
    expect(container.textContent).toContain("Execution");
    expect(container.textContent).toContain("No exceptions requiring founder attention");
    expect(container.textContent).toContain("Work in motion");
    expect(container.textContent).toContain("CEO-12");
    expect(container.textContent).toContain("Live operations");
    expect(container.textContent).toContain("Delivery brief");
    expect(container.querySelector('[data-testid="ceo-editorial-dashboard"]')).not.toBeNull();
    expect(container.textContent).toContain("Open Agent Studio");
    expect(container.textContent).not.toContain("Model routing");
    expect(container.textContent).not.toContain("Agent topology");
  });

  it("prioritizes founder decisions and blocked work in Today", async () => {
    const needsAttention = {
      ...dashboard,
      pendingApprovals: 2,
      tasks: { ...dashboard.tasks, blocked: 1 },
    };

    await act(async () => {
      root.render(
        <CommandCenter
          companyId="company-1"
          companyName="CEO Agent Labs"
          summary={needsAttention}
          agents={agents}
          issues={[]}
          artifacts={[]}
          activity={[]}
          agentMap={new Map(agents.map((agent) => [agent.id, agent]))}
          userProfileMap={new Map()}
          entityNameMap={new Map()}
          entityTitleMap={new Map()}
          lastUpdatedAt={null}
        />,
      );
    });

    expect(container.textContent).toContain("2 pending approvals");
    expect(container.textContent).toContain("1 blocked task");
    expect(container.querySelector(".ceo-command-center__today-count")?.textContent).toBe("3");
    expect(container.querySelector('a[href="/approvals"]')).not.toBeNull();
    expect(container.querySelector('a[href="/issues?attention=blocked"]')).not.toBeNull();
  });

  it("encodes issue identifiers used as route segments", async () => {
    await act(async () => {
      root.render(
        <CommandCenter
          companyId="company-1"
          companyName="CEO Agent Labs"
          summary={dashboard}
          agents={agents}
          issues={[{ ...issue, identifier: "CEO/12" } as Issue]}
          artifacts={[]}
          activity={[]}
          agentMap={new Map(agents.map((agent) => [agent.id, agent]))}
          userProfileMap={new Map()}
          entityNameMap={new Map()}
          entityTitleMap={new Map()}
          lastUpdatedAt={null}
        />,
      );
    });

    expect(container.querySelector('a[href="/issues/CEO%2F12"]')).not.toBeNull();
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

    expect(container.textContent).toContain("No work is currently in progress or review.");
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

    expect(container.textContent).toContain("Company work could not be loaded.");
    expect(container.textContent).toContain("Live agent operations could not be loaded.");
    expect(container.textContent).not.toContain("No agents are connected to this company yet.");
    expect(container.textContent).not.toContain("Loading work from the company control plane.");
  });

  it("counts a pending budget approval once in founder attention and decision load", async () => {
    await act(async () => {
      root.render(
        <CommandCenter
          companyId="company-1"
          companyName="CEO Agent Labs"
          summary={{
            ...dashboard,
            pendingApprovals: 1,
            budgets: { ...dashboard.budgets, activeIncidents: 1, pendingApprovals: 1 },
          }}
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

    expect(container.querySelector(".ceo-command-center__today-count")?.textContent).toBe("1");
    const decisionMetric = Array.from(container.querySelectorAll(".ceo-command-center__health-grid > a"))
      .find((node) => node.textContent?.includes("Decision load"));
    expect(decisionMetric?.querySelector("p:nth-of-type(1)")?.textContent).toBe("1");
    expect(container.querySelector('.ceo-command-center__attention-list a[href="/costs"]')).toBeNull();

    await act(async () => {
      root.render(
        <CommandCenter
          companyId="company-1"
          companyName="CEO Agent Labs"
          summary={{
            ...dashboard,
            pendingApprovals: 1,
            budgets: { ...dashboard.budgets, activeIncidents: 2, pendingApprovals: 1 },
          }}
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

    expect(container.querySelector(".ceo-command-center__today-count")?.textContent).toBe("2");
    expect(container.querySelector('.ceo-command-center__attention-list a[href="/costs"]')).not.toBeNull();
  });

  it("keeps all small alert text opaque and on the accessible ink token", () => {
    const cssPath = [
      resolve(process.cwd(), "src/index.css"),
      resolve(process.cwd(), "ui/src/index.css"),
    ].find((candidate) => existsSync(candidate));
    expect(cssPath).toBeDefined();

    const css = readFileSync(cssPath!, "utf8");
    const labelRule = css.match(/\.ceo-command-center__today-panel \.ceo-command-center__section-label\s*\{([^}]*)\}/)?.[1];
    const indexRule = css.match(/\.ceo-command-center__attention-index\s*\{([^}]*)\}/)?.[1];

    expect(labelRule).toContain("color: var(--ceo-os-orange-dark)");
    expect(labelRule).not.toMatch(/opacity:\s*0\./);
    expect(indexRule).toContain("color: var(--ceo-os-orange-dark)");
    expect(indexRule).toContain("opacity: 1");
    expect(indexRule).not.toMatch(/opacity:\s*0\./);
  });
});
