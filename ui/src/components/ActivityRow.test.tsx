// @vitest-environment jsdom

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

import { ActivityRow } from "./ActivityRow";

describe("ActivityRow", () => {
  it("shows a semantic integration actor instead of a raw plugin UUID", () => {
    const actorId = "2d3fc4f2-c46d-47d1-90cb-e78548a49e39";
    const markup = renderToStaticMarkup(
      <ActivityRow
        event={{
          id: "event-1",
          companyId: "company-1",
          actorType: "plugin",
          actorId,
          action: "crm.account.created",
          entityType: "crm_account",
          entityId: "account-1",
          details: { name: "Acme" },
          createdAt: "2026-08-11T00:00:00.000Z",
        } as never}
        agentMap={new Map()}
        userProfileMap={new Map()}
        entityNameMap={new Map()}
      />,
    );

    expect(markup).toContain("CRM integration");
    expect(markup).not.toContain(actorId);
  });

  it("does not misattribute an unresolved agent event to an integration", () => {
    const markup = renderToStaticMarkup(
      <ActivityRow
        event={{
          id: "event-2",
          companyId: "company-1",
          actorType: "agent",
          actorId: "deleted-agent",
          action: "issue.created",
          entityType: "issue",
          entityId: "issue-1",
          details: { title: "Missing agent audit event" },
          createdAt: "2026-08-11T00:00:00.000Z",
        } as never}
        agentMap={new Map()}
        userProfileMap={new Map()}
        entityNameMap={new Map()}
      />,
    );

    expect(markup).toContain("Unknown agent");
    expect(markup).not.toContain("Integration");
  });
});
