import { describe, expect, it } from "vitest";
import { createFollowupIssue } from "../src/domain/crm.js";

function crmContext() {
  return {
    db: {
      namespace: "plugin_ceo_crm_6dfa6b60e3",
      query: async () => [],
      execute: async () => ({ rowCount: 1 }),
    },
    activity: { log: async () => undefined },
    issues: { create: async () => ({ id: "issue-created" }) },
  } as any;
}

describe("CEO CRM company isolation", () => {
  it("denies a follow-up when its CRM entity is not in the authenticated company", async () => {
    await expect(createFollowupIssue(crmContext(), {
      companyId: "company-a",
      entityKind: "contact",
      entityId: "contact-in-company-b",
      title: "Investigate contact",
      idempotencyKey: "follow-up-contact-b",
      actor: { type: "agent", id: "agent-a", agentId: "agent-a", runId: "run-a" },
    })).rejects.toThrow("contact not found");
  });
});
