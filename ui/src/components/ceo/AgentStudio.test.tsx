// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, Issue } from "@paperclipai/shared";

import { AgentStudio } from "./AgentStudio";

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const agents = [
  {
    id: "agent-1",
    companyId: "company-1",
    name: "Executive Orchestrator",
    urlKey: "executive-orchestrator",
    role: "general",
    title: "Chief of Staff",
    icon: null,
    status: "running",
    reportsTo: null,
    capabilities: null,
    adapterType: "hermes_local",
    adapterConfig: { hermesProfile: "executive" },
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
  },
] satisfies Agent[];

const currentIssue = {
  id: "issue-1",
  identifier: "CEO-3",
  title: "Choose the first beachhead ICP",
  status: "in_progress",
  assigneeAgentId: "agent-1",
  updatedAt: new Date("2026-08-10T00:00:00Z"),
} as Issue;

describe("AgentStudio", () => {
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

  it("shows real Hermes specialist routing and configuration links", async () => {
    await act(async () => {
      root.render(<AgentStudio companyId="company-1" companyName="CEO Agent" agents={agents} issues={[currentIssue]} />);
    });

    expect(container.querySelector('[data-testid="ceo-agent-studio"]')).not.toBeNull();
    expect(container.textContent).toContain("Agent Studio");
    expect(container.textContent).toContain("Executive Orchestrator");
    expect(container.textContent).toContain("Hermes profile: executive");
    expect(container.textContent).toContain("Running");
    expect(container.textContent).toContain("Current assignment");
    expect(container.textContent).toContain("CEO-3");
    expect(container.textContent).toContain("Choose the first beachhead ICP");
    expect(container.textContent).toContain("Technical setup");
    expect(container.textContent).toContain("Model routing");
    expect(container.textContent).toContain("Agent topology");
    const agentCard = container.querySelector('[data-testid="agent-studio-agent-agent-1"]');
    expect(agentCard?.querySelectorAll('a[href="/agents/executive-orchestrator"]')).toHaveLength(1);
    expect(container.querySelector('a[href="/agents/new"]')).not.toBeNull();
  });

  it("surfaces a founder-triggered runtime validation result without inventing a health claim", async () => {
    const onValidateAgent = vi.fn();
    await act(async () => {
      root.render(
        <AgentStudio
          companyId="company-1"
          companyName="CEO Agent"
          agents={agents}
          onValidateAgent={onValidateAgent}
          validationByAgentId={{ "agent-1": "pass" }}
        />,
      );
    });

    const validateButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Validate runtime"));
    expect(validateButton).toBeDefined();
    await act(async () => validateButton?.click());
    expect(onValidateAgent).toHaveBeenCalledWith(agents[0]);
    expect(container.textContent).toContain("Runtime check: pass");
  });

  it("does not claim gateway profile isolation that its runtime cannot enforce", async () => {
    const gatewayAgent = {
      ...agents[0],
      id: "agent-gateway",
      name: "Gateway specialist",
      adapterType: "hermes_gateway",
      adapterConfig: { hermesProfile: "sales" },
    } satisfies Agent;

    await act(async () => {
      root.render(<AgentStudio companyId="company-1" companyName="CEO Agent" agents={[gatewayAgent]} />);
    });

    expect(container.textContent).toContain("Gateway-managed runtime");
    expect(container.textContent).not.toContain("Hermes profile: sales");
    const profileMetric = Array.from(container.querySelectorAll(".ceo-agent-studio__readiness > div"))
      .find((node) => node.textContent?.includes("Profile routes"));
    expect(profileMetric?.querySelector("strong")?.textContent).toBe("0");
  });

  it("does not misreport an unavailable agent registry as an empty company", async () => {
    await act(async () => {
      root.render(<AgentStudio companyId="company-1" companyName="CEO Agent" agentsError />);
    });

    expect(container.textContent).toContain("Agent registry could not be loaded.");
    expect(container.textContent).not.toContain("No agents are connected to this company yet.");
  });

  it("shows loading instead of numeric agent metrics while the registry is pending", async () => {
    await act(async () => {
      root.render(<AgentStudio companyId="company-1" companyName="CEO Agent" />);
    });

    for (const label of ["Roster", "Running now", "Active work", "Profile routes"]) {
      const metric = Array.from(container.querySelectorAll(".ceo-agent-studio__readiness > div"))
        .find((node) => node.textContent?.includes(label));
      expect(metric?.querySelector("strong")?.textContent).toBe("Loading");
    }
    expect(container.textContent).toContain("Loading live company agent registry.");
    expect(container.textContent).not.toContain("No agents are connected to this company yet.");
  });

  it("shows unavailable instead of numeric agent metrics when the registry fails", async () => {
    await act(async () => {
      root.render(
        <AgentStudio
          companyId="company-1"
          companyName="CEO Agent"
          agentsError
          issues={[currentIssue]}
        />,
      );
    });

    for (const label of ["Roster", "Running now", "Active work", "Profile routes"]) {
      const metric = Array.from(container.querySelectorAll(".ceo-agent-studio__readiness > div"))
        .find((node) => node.textContent?.includes(label));
      expect(metric?.querySelector("strong")?.textContent).toBe("Unavailable");
    }
    expect(container.textContent).toContain("Agent registry could not be loaded.");
  });

  it("does not show a numeric active-work total until assignments load", async () => {
    await act(async () => {
      root.render(<AgentStudio companyId="company-1" companyName="CEO Agent" agents={agents} issuesLoading />);
    });

    const activeWork = Array.from(container.querySelectorAll(".ceo-agent-studio__readiness > div"))
      .find((node) => node.textContent?.includes("Active work"));
    expect(activeWork?.querySelector("strong")?.textContent).toBe("Loading");
    expect(activeWork?.querySelector('[role="status"]')?.getAttribute("aria-live")).toBe("polite");

    await act(async () => {
      root.render(<AgentStudio companyId="company-1" companyName="CEO Agent" agents={agents} issuesError />);
    });
    const unavailableActiveWork = Array.from(container.querySelectorAll(".ceo-agent-studio__readiness > div"))
      .find((node) => node.textContent?.includes("Active work"));
    expect(unavailableActiveWork?.querySelector("strong")?.textContent).toBe("Unavailable");
  });

  it("counts assignments only for visible non-terminated agents and encodes issue routes", async () => {
    const terminatedAgent = { ...agents[0], id: "agent-terminated", status: "terminated" } satisfies Agent;
    const hiddenAssignment = { ...currentIssue, id: "issue-hidden", assigneeAgentId: terminatedAgent.id } as Issue;
    const routedIssue = { ...currentIssue, identifier: "CEO/3" } as Issue;

    await act(async () => {
      root.render(
        <AgentStudio
          companyId="company-1"
          companyName="CEO Agent"
          agents={[...agents, terminatedAgent]}
          issues={[hiddenAssignment, routedIssue]}
        />,
      );
    });

    const activeWork = Array.from(container.querySelectorAll(".ceo-agent-studio__readiness > div"))
      .find((node) => node.textContent?.includes("Active work"));
    expect(activeWork?.querySelector("strong")?.textContent).toBe("1");
    expect(container.querySelector('a[href="/issues/CEO%2F3"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="agent-studio-agent-agent-terminated"]')).toBeNull();
    expect(container.querySelectorAll(".ceo-agent-studio__runtime-row")).toHaveLength(1);
  });
});
