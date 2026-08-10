import { describe, expect, it } from "vitest";
import {
  bootstrapDefaultPipeline,
  classifyCrmPublicError,
  createAccount,
  createContact,
  createDeal,
  createFollowupIssue,
  proposeEvidence,
  recordInternalNote,
  requireCompanyScope,
} from "../src/domain/crm.js";

function context(queryRows: unknown[][] = []) {
  const executes: Array<{ sql: string; params: unknown[] }> = [];
  let queryIndex = 0;
  return {
    executes,
    ctx: {
      db: {
        namespace: "plugin_ceo_crm_6dfa6b60e3",
        query: async () => queryRows[queryIndex++] ?? [],
        execute: async (sql: string, params: unknown[]) => { executes.push({ sql, params }); return { rowCount: 1 }; },
      },
      activity: { log: async () => undefined },
      issues: { create: async () => ({ id: "issue-new" }) },
    } as any,
  };
}

describe("CEO CRM domain behavior", () => {
  it("classifies expected tenant and validation denials without turning them into gateway errors", () => {
    expect(classifyCrmPublicError(new Error("account not found"))).toEqual({ status: 404, message: "account not found" });
    expect(classifyCrmPublicError(new Error("company scope mismatch"))).toEqual({ status: 403, message: "company scope mismatch" });
    expect(classifyCrmPublicError(new Error("A host-authorized company scope is required"))).toEqual({ status: 403, message: "A host-authorized company scope is required" });
    expect(classifyCrmPublicError(new Error("CRM founder actions require an authenticated board user"))).toEqual({ status: 403, message: "CRM founder actions require an authenticated board user" });
    expect(classifyCrmPublicError(new Error("name is required"))).toEqual({ status: 400, message: "name is required" });
    expect(classifyCrmPublicError(new Error("account domain already exists"))).toEqual({ status: 409, message: "account domain already exists" });
    expect(classifyCrmPublicError(new Error("database unavailable"))).toBeNull();
  });

  it("rejects a caller-supplied company that differs from host scope", () => {
    expect(() => requireCompanyScope("company-b", "company-a")).toThrow("companyId must match");
  });

  it("parameterizes untrusted account input and emits an outbox audit event", async () => {
    const { ctx, executes } = context([[{ id: "account-stable", name: "Acme'); DROP TABLE crm_accounts; --", normalized_domain: "example.com" }]]);
    const name = "Acme'); DROP TABLE crm_accounts; --";
    const result = await createAccount(ctx, { companyId: "company-a", name, domain: "https://WWW.Example.com/team", idempotencyKey: "create-account-acme", actor: { type: "user", id: "user-a", userId: "user-a" } });

    expect(executes[0]?.sql).toContain("ON CONFLICT DO NOTHING");
    expect(executes[0]?.sql).not.toContain(name);
    expect(executes[0]?.params).toContain(name);
    expect(result.id).toBe("account-stable");
    expect(executes.some((entry) => entry.sql.includes("crm_outbox"))).toBe(true);
    const outbox = executes.find((entry) => entry.sql.includes("crm_outbox"));
    expect(JSON.parse(String(outbox?.params[3]))).toMatchObject({
      actor: { type: "user", id: "user-a", userId: "user-a", agentId: null, runId: null },
    });
  });

  it("returns deterministic company-scoped conflicts for duplicate account domains and contact emails", async () => {
    const account = context([[], [{ id: "account-existing" }]]);
    await expect(createAccount(account.ctx, {
      companyId: "company-a",
      name: "Duplicate account",
      domain: "example.com",
      idempotencyKey: "different-account-request",
      actor: { type: "user", id: "user-a", userId: "user-a" },
    })).rejects.toThrow("account domain already exists");
    expect(account.executes[0]?.sql).toContain("ON CONFLICT DO NOTHING");

    const contact = context([[{ id: "account-a" }], [], [{ id: "contact-existing" }]]);
    await expect(createContact(contact.ctx, {
      companyId: "company-a",
      accountId: "account-a",
      firstName: "Duplicate",
      email: "duplicate@example.com",
      idempotencyKey: "different-contact-request",
      actor: { type: "user", id: "user-a", userId: "user-a" },
    })).rejects.toThrow("contact email already exists");
    expect(contact.executes[0]?.sql).toContain("ON CONFLICT DO NOTHING");
  });

  it("stores an evidence proposal without updating contact canonical fields", async () => {
    const { ctx, executes } = context([[{ id: "contact-a" }], [{ id: "evidence-stable", entity_kind: "contact", entity_id: "contact-a", field_name: "title", proposed_value: "Founder", source: "meeting notes" }]]);
    await proposeEvidence(ctx, { companyId: "company-a", entityKind: "contact", entityId: "contact-a", field: "title", value: "Founder", source: "meeting notes", idempotencyKey: "contact-a-title-founder", actor: { type: "agent", id: "agent-a", agentId: "agent-a", runId: "run-a" } });

    expect(executes.some((entry) => entry.sql.includes("INSERT INTO plugin_ceo_crm_6dfa6b60e3.crm_evidence"))).toBe(true);
    expect(executes.some((entry) => entry.sql.includes("crm_contacts"))).toBe(false);
    expect(executes.some((entry) => /^\s*UPDATE\b/i.test(entry.sql))).toBe(false);
  });

  it("accepts semantically identical evidence objects after jsonb reorders their keys", async () => {
    const inputValue = {
      goalId: "goal-a",
      projectId: "project-a",
      issueId: "issue-a",
      approvalRequired: true,
    };
    const storedValue = {
      issueId: "issue-a",
      goalId: "goal-a",
      approvalRequired: true,
      projectId: "project-a",
    };
    const { ctx } = context([
      [{ id: "deal-a" }],
      [{
        id: "evidence-stable",
        entity_kind: "deal",
        entity_id: "deal-a",
        field_name: "operating_validation_scope",
        proposed_value: storedValue,
        source: "founder authorization",
      }],
    ]);

    await expect(proposeEvidence(ctx, {
      companyId: "company-a",
      entityKind: "deal",
      entityId: "deal-a",
      field: "operating_validation_scope",
      value: inputValue,
      source: "founder authorization",
      idempotencyKey: "deal-a-operating-scope",
      actor: { type: "user", id: "local-board", userId: "local-board" },
    })).resolves.toMatchObject({ id: "evidence-stable", status: "proposed" });
  });

  it("retains the initiating board principal on evidence proposals", async () => {
    const { ctx, executes } = context([[{ id: "contact-a" }], [{ id: "evidence-stable", entity_kind: "contact", entity_id: "contact-a", field_name: "title", proposed_value: "Founder", source: "meeting notes" }]]);
    await proposeEvidence(ctx, {
      companyId: "company-a",
      entityKind: "contact",
      entityId: "contact-a",
      field: "title",
      value: "Founder",
      source: "meeting notes",
      idempotencyKey: "contact-a-title-founder-board",
      actor: { type: "user", id: "local-board", userId: "local-board" },
    });

    const evidenceInsert = executes.find((entry) => entry.sql.includes("INSERT INTO plugin_ceo_crm_6dfa6b60e3.crm_evidence"));
    expect(evidenceInsert?.sql).toContain("actor_user_id");
    expect(evidenceInsert?.params).toContain("local-board");
  });

  it("asks the host for create-or-get-by-origin issue semantics", async () => {
    let claimId = "";
    let linkedIssueId: string | null = null;
    let createInput: Record<string, unknown> | null = null;
    const ctx = {
      db: {
        namespace: "plugin_ceo_crm_6dfa6b60e3",
        query: async (sql: string) => {
          if (sql.includes("crm_contacts")) return [{ id: "contact-a" }];
          if (sql.includes("crm_work_links")) return [{ id: claimId, crm_entity_kind: "contact", crm_entity_id: "contact-a", issue_id: linkedIssueId }];
          if (sql.includes("origin_kind")) return [];
          if (sql.includes("WHERE id = $1 AND company_id = $2")) return [{ id: "issue-new" }];
          return [];
        },
        execute: async (sql: string, params: unknown[]) => {
          if (sql.includes("INSERT INTO plugin_ceo_crm_6dfa6b60e3.crm_work_links")) claimId = String(params[0]);
          if (sql.includes("SET issue_id")) linkedIssueId = String(params[0]);
          return { rowCount: 1 };
        },
      },
      activity: { log: async () => undefined },
      issues: {
        create: async (input: Record<string, unknown>) => {
          createInput = input;
          return { id: "issue-new", createdByRequest: true };
        },
      },
    } as any;

    await expect(createFollowupIssue(ctx, {
      companyId: "company-a",
      entityKind: "contact",
      entityId: "contact-a",
      title: "Research account",
      idempotencyKey: "research-contact-a-create",
      actor: { type: "user", id: "local-board", userId: "local-board" },
    })).resolves.toEqual({ issueId: "issue-new", created: true });
    expect(createInput).toMatchObject({ createOrGetByOrigin: true });
  });

  it("returns the prior follow-up issue for an idempotency key without creating another issue", async () => {
    const { ctx } = context([[{ id: "contact-a" }], [{ id: "claim-existing", crm_entity_kind: "contact", crm_entity_id: "contact-a", issue_id: "issue-existing" }]]);
    const result = await createFollowupIssue(ctx, { companyId: "company-a", entityKind: "contact", entityId: "contact-a", title: "Research account", idempotencyKey: "research-contact-a", actor: { type: "agent", id: "agent-a", agentId: "agent-a", runId: "run-a" } });

    expect(result).toEqual({ issueId: "issue-existing", created: false });
  });

  it("does not create a second follow-up while another caller owns the idempotency claim", async () => {
    let issueCreates = 0;
    const { ctx } = context([[{ id: "contact-a" }], [{ id: "claim-other", crm_entity_kind: "contact", crm_entity_id: "contact-a", issue_id: null }]]);
    ctx.issues.create = async () => { issueCreates += 1; return { id: "issue-should-not-exist" }; };

    await expect(createFollowupIssue(ctx, {
      companyId: "company-a",
      entityKind: "contact",
      entityId: "contact-a",
      title: "Research account",
      idempotencyKey: "research-contact-a",
      actor: { type: "agent", id: "agent-a", agentId: "agent-a", runId: "run-a" },
    })).rejects.toThrow("follow-up creation is already in progress");
    expect(issueCreates).toBe(0);
  });

  it("returns the same internal-note ID when a board retry reuses its idempotency key", async () => {
    const { ctx, executes } = context([[{ id: "contact-a" }], [{ id: "note-stable", account_id: null, contact_id: "contact-a", deal_id: null, body: "Call next week" }]]);
    const result = await recordInternalNote(ctx, {
      companyId: "company-a",
      entityKind: "contact",
      entityId: "contact-a",
      body: "Call next week",
      idempotencyKey: "note-contact-a-next-week",
      actor: { type: "user", id: "user-a", userId: "user-a" },
    });

    expect(executes[0]?.sql).toContain("ON CONFLICT (company_id, idempotency_key) DO NOTHING");
    expect(result.id).toBe("note-stable");
  });

  it("rejects a deal stage that does not belong to the selected company pipeline", async () => {
    const { ctx, executes } = context([[]]);

    await expect(createDeal(ctx, {
      companyId: "company-a",
      pipelineId: "pipeline-a",
      stageId: "stage-from-another-pipeline",
      name: "Expansion",
      idempotencyKey: "deal-expansion",
      actor: { type: "user", id: "user-a", userId: "user-a" },
    })).rejects.toThrow("stage must belong to the selected company pipeline");

    expect(executes).toHaveLength(0);
  });

  it("bootstraps the default pipeline with a conflict-safe insert followed by a canonical scoped read", async () => {
    const { ctx, executes } = context([[{ id: "pipeline-canonical" }]]);
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const originalQuery = ctx.db.query;
    ctx.db.query = async (sql: string, params: unknown[]) => {
      queries.push({ sql, params });
      return originalQuery(sql, params);
    };

    const result = await bootstrapDefaultPipeline(ctx, {
      companyId: "company-a",
      actor: { type: "user", id: "user-a", userId: "user-a" },
    });

    expect(result.pipelineId).toBe("pipeline-canonical");
    expect(executes[0]?.sql).toContain("INSERT INTO");
    expect(executes[0]?.sql).toContain("ON CONFLICT (company_id, name) DO NOTHING");
    expect(queries[0]?.sql).toContain("SELECT id FROM");
    expect(queries[0]?.params).toEqual(["company-a", "Sales"]);
  });
});
