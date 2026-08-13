// @vitest-environment jsdom

import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/router", () => ({
  NavLink: ({ children, className, to }: { children: React.ReactNode | ((state: { isActive: boolean }) => React.ReactNode); className?: string | ((state: { isActive: boolean }) => string); to: string }) => {
    const state = { isActive: false };
    return <a href={to} className={typeof className === "function" ? className(state) : className}>{typeof children === "function" ? children(state) : children}</a>;
  },
  useLocation: () => ({ pathname: "/CEO/approvals" }),
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

vi.mock("../context/DialogContext", () => ({
  useDialogActions: () => ({ openNewIssue: vi.fn() }),
}));

vi.mock("../hooks/useInboxBadge", () => ({
  useInboxBadge: () => ({ inbox: 0 }),
}));

import { MobileBottomNav } from "./MobileBottomNav";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("MobileBottomNav", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  afterEach(async () => {
    await act(async () => root?.unmount());
    container?.remove();
  });

  it("occupies its own mobile layout row instead of overlaying page actions", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<MobileBottomNav visible />);
    });

    const nav = container.querySelector("nav");
    expect(nav?.className).toContain("shrink-0");
    expect(nav?.className).not.toContain("fixed");
    expect(nav?.className).not.toContain("bottom-0");
  });
});
