import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CEO CRM manifest", () => {
  it("declares the company-scoped CRM boundary", () => {
    const manifestPath = resolve(import.meta.dirname, "../src/manifest.ts");
    const source = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : "";

    expect(source).toContain('namespaceSlug: "ceo_crm"');
    expect(source).toContain('routePath: "crm"');
    expect(source).toContain('name: "crm_create_followup_issue"');
  });
});
