import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CEO CRM migration", () => {
  it("keeps every CRM business row company-scoped with durable evidence and idempotency", () => {
    const migrationPath = resolve(import.meta.dirname, "../migrations/001_crm_core.sql");
    const source = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

    for (const table of ["crm_accounts", "crm_contacts", "crm_pipelines", "crm_pipeline_stages", "crm_deals", "crm_activities", "crm_evidence", "crm_work_links", "crm_outbox"]) {
      expect(source).toMatch(new RegExp(`CREATE TABLE plugin_ceo_crm_6dfa6b60e3\\.${table}[\\s\\S]*?company_id uuid NOT NULL`));
    }
    expect(source).toContain("REFERENCES public.companies(id)");
    expect(source).toContain("REFERENCES public.issues(id)");
    expect(source).toContain("UNIQUE (company_id, idempotency_key)");
    expect(source).toContain("CHECK (amount IS NULL OR amount >= 0)");
    expect(source).toContain("UNIQUE (id, company_id, pipeline_id)");
    expect(source).toContain("FOREIGN KEY (stage_id, company_id, pipeline_id)");
    expect(source).not.toContain("ON DELETE SET NULL");
    expect(source).toContain("crm_evidence");
    expect(source).not.toContain("updated_at timestamptz NOT NULL DEFAULT now()\n);\n\nCREATE TABLE plugin_ceo_crm_6dfa6b60e3.crm_work_links");
  });

  it("adds retry-safe mutation keys and durable follow-up reservations", () => {
    const migrationPath = resolve(import.meta.dirname, "../migrations/002_runtime_integrity.sql");
    const source = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

    for (const table of ["crm_accounts", "crm_contacts", "crm_deals", "crm_evidence"]) {
      expect(source).toContain(`ALTER TABLE plugin_ceo_crm_6dfa6b60e3.${table}`);
      expect(source).toMatch(new RegExp(`${table}[\\s\\S]+?idempotency_key`));
    }
    expect(source).toContain("ALTER COLUMN issue_id DROP NOT NULL");
    expect(source).toContain("crm_work_links_issue_pending_idx");
  });

  it("stores board principal IDs as text because local and external principals are not UUID-only", () => {
    const migrationPath = resolve(import.meta.dirname, "../migrations/003_actor_principal_ids.sql");
    const source = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

    expect(source).toContain("ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_work_links");
    expect(source).toContain("ALTER COLUMN actor_user_id TYPE text");
    expect(source).toContain("USING actor_user_id::text");
  });

  it("enforces Paperclip issue and CRM work-link company consistency in PostgreSQL", () => {
    const migrationPath = resolve(import.meta.dirname, "../migrations/004_issue_company_scope.sql");
    const source = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

    expect(source).toContain("crm_work_links_issue_company_fk");
    expect(source).toContain("FOREIGN KEY (issue_id, company_id)");
    expect(source).toContain("REFERENCES public.issues(id, company_id)");
  });

  it("retains non-UUID human principal provenance on evidence", () => {
    const migrationPath = resolve(import.meta.dirname, "../migrations/005_evidence_actor_provenance.sql");
    const source = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

    expect(source).toContain("ALTER TABLE plugin_ceo_crm_6dfa6b60e3.crm_evidence");
    expect(source).toContain("ADD COLUMN actor_user_id text");
  });
});
