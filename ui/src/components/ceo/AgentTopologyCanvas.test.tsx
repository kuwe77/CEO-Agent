// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Agent } from "@paperclipai/shared";
import { AgentTopologyCanvas } from "./AgentTopologyCanvas";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function agent(overrides: Partial<Agent>): Agent {
  return {
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
    adapterType: "hermes_gateway",
    adapterConfig: {},
    runtimeConfig: {},
    budgetMonthlyCents: 0,
    spentMonthlyCents: 0,
    pauseReason: null,
    pausedAt: null,
    permissions: { canCreateAgents: false },
    lastHeartbeatAt: null,
    metadata: { hermesProfile: "founder-principal" },
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

describe("AgentTopologyCanvas", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders live agents with their adapter, profile mapping, and local-arrangement guidance", async () => {
    await act(async () => {
      root.render(
        <AgentTopologyCanvas
          companyId="company-1"
          agents={[
            agent({ id: "founder", name: "Founder" }),
            agent({
              id: "operator",
              name: "Operator",
              role: "engineer",
              reportsTo: "founder",
              status: "idle",
              adapterType: "codex_local",
              metadata: null,
            }),
          ]}
        />,
      );
    });

    expect(container.textContent).toContain("Founder");
    expect(container.textContent).toContain("Hermes: founder-principal");
    expect(container.textContent).toContain("Codex local");
    expect(container.textContent).toContain("Unmapped");
    expect(container.textContent).toContain("Reporting lines use live organization data. Arrangement is local to this browser.");
    expect(container.querySelectorAll('[data-testid="topology-wire"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="topology-save-layout"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="topology-reset-layout"]')).not.toBeNull();
  });

  it("restores a saved browser-local layout on initial mount", async () => {
    window.localStorage.setItem(
      "ceo-agent:topology-layout:company-1",
      JSON.stringify({ founder: { x: 420, y: 260 } }),
    );

    await act(async () => {
      root.render(
        <AgentTopologyCanvas
          companyId="company-1"
          agents={[agent({ id: "founder", name: "Founder" })]}
        />,
      );
    });

    const node = container.querySelector("article") as HTMLElement | null;
    expect(node?.style.left).toBe("420px");
    expect(node?.style.top).toBe("260px");
  });

  it("restores a saved layout when agents arrive after the initial loading state", async () => {
    window.localStorage.setItem(
      "ceo-agent:topology-layout:company-1",
      JSON.stringify({ founder: { x: 560, y: 320 } }),
    );

    await act(async () => {
      root.render(<AgentTopologyCanvas companyId="company-1" agents={undefined} />);
    });
    await act(async () => {
      root.render(
        <AgentTopologyCanvas
          companyId="company-1"
          agents={[agent({ id: "founder", name: "Founder" })]}
        />,
      );
    });

    const node = container.querySelector("article") as HTMLElement | null;
    expect(node?.style.left).toBe("560px");
    expect(node?.style.top).toBe("320px");
  });

  it("preserves in-memory positions through a same-company loading transition", async () => {
    const founder = agent({ id: "founder", name: "Founder" });
    window.localStorage.setItem(
      "ceo-agent:topology-layout:company-1",
      JSON.stringify({ founder: { x: 680, y: 360 } }),
    );

    await act(async () => {
      root.render(<AgentTopologyCanvas companyId="company-1" agents={[founder]} />);
    });
    window.localStorage.removeItem("ceo-agent:topology-layout:company-1");
    await act(async () => {
      root.render(<AgentTopologyCanvas companyId="company-1" agents={undefined} />);
    });
    await act(async () => {
      root.render(<AgentTopologyCanvas companyId="company-1" agents={[{ ...founder }]} />);
    });

    const node = container.querySelector("article") as HTMLElement | null;
    expect(node?.style.left).toBe("680px");
    expect(node?.style.top).toBe("360px");
  });
});
