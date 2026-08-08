import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CEO CRM UI", () => {
  it("uses plugin data and actions with honest loading, error, and empty states", () => {
    const appPath = resolve(import.meta.dirname, "../src/ui/app.tsx");
    const source = existsSync(appPath) ? readFileSync(appPath, "utf8") : "";

    expect(source).toContain("usePluginData");
    expect(source).toContain("usePluginAction");
    expect(source).toContain("Loading CRM");
    expect(source).toContain("Could not load CRM");
    expect(source).toContain("No CRM records yet");
    expect(source).toContain("Overview");
    expect(source).toContain("Accounts");
    expect(source).toContain("Contacts");
    expect(source).toContain("Deals");
    expect(source).toContain("Activity");
    expect(source).toContain("Evidence");
    expect(source).toContain('usePluginData<PipelineStage[]>("crm-pipelines"');
    expect(source).toContain('aria-label="CRM records"');
    expect(source).toContain("row.body");
    expect(source).toContain("row.proposed_value");
    expect(source).toContain("refresh()");
    expect(source).toContain('name="pipelineStage"');
    expect(source).not.toContain('placeholder="Pipeline ID"');
    expect(source).not.toContain('placeholder="Stage ID"');
    expect(source).toContain("function ScopedCrmPage");
    expect(source.indexOf("if (!companyId)")).toBeLessThan(source.indexOf("<ScopedCrmPage"));
  });
});
