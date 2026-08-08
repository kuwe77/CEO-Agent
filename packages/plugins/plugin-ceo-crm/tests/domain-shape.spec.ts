import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CEO CRM domain worker boundary", () => {
  it("contains scoped, parameterized domain operations without direct credentials", () => {
    const domainPath = resolve(import.meta.dirname, "../src/domain/crm.ts");
    const source = existsSync(domainPath) ? readFileSync(domainPath, "utf8") : "";

    for (const operation of ["bootstrapDefaultPipeline", "getOverview", "searchCrm", "createAccount", "createContact", "createDeal", "recordInternalNote", "proposeEvidence", "createFollowupIssue"]) {
      expect(source).toContain(`export async function ${operation}`);
    }
    expect(source).toContain("requireCompanyScope");
    expect(source).toContain("ctx.db.execute");
    expect(source).not.toContain("DATABASE_URL");
    expect(source).not.toContain("process.env");
  });
});
