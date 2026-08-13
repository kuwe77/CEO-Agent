// @vitest-environment node

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardLive } from "./DashboardLive";

vi.mock("@/lib/router", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1", companies: [{ id: "company-1" }] }),
}));

vi.mock("../context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("../components/ActiveAgentsPanel", () => ({
  ActiveAgentsPanel: ({ gridClassName, responsiveCardHeight, minCardWidth }: { gridClassName?: string; responsiveCardHeight?: boolean; minCardWidth?: string }) => (
    <div data-grid-class={gridClassName} data-responsive-card-height={responsiveCardHeight ? "true" : "false"} data-min-card-width={minCardWidth} />
  ),
}));

describe("DashboardLive responsive run cards", () => {
  it("uses container-aware columns and a shorter mobile card", () => {
    const markup = renderToStaticMarkup(<DashboardLive />);
    expect(markup).toContain('data-grid-class="gap-3"');
    expect(markup).toContain('data-responsive-card-height="true"');
    expect(markup).toContain('data-min-card-width="28rem"');
    expect(markup).not.toContain("md:grid-cols-2");
  });
});