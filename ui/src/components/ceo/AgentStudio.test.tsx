// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@paperclipai/shared";

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
      root.render(<AgentStudio companyId="company-1" companyName="CEO Agent" agents={agents} />);
    });

    expect(container.querySelector('[data-testid="ceo-agent-studio"]')).not.toBeNull();
    expect(container.textContent).toContain("Agent Studio");
    expect(container.textContent).toContain("Executive Orchestrator");
    expect(container.textContent).toContain("Hermes profile: executive");
    expect(container.textContent).toContain("Running");
    expect(container.querySelector('a[href="/agents/executive-orchestrator"]')).not.toBeNull();
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
});
