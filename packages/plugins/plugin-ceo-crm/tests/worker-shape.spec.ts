import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CEO CRM worker", () => {
  it("registers only governed CRM tools and board routes", () => {
    const workerPath = resolve(import.meta.dirname, "../src/worker.ts");
    const source = existsSync(workerPath) ? readFileSync(workerPath, "utf8") : "";

    for (const name of ["crm_search", "crm_get_contact", "crm_get_deal", "crm_propose_fact", "crm_create_followup_issue"]) {
      expect(source).toContain(`ctx.tools.register("${name}"`);
    }
    expect(source).toContain("requireCompanyScope");
    expect(source).toContain("onApiRequest");
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("fetch(");
  });
});
