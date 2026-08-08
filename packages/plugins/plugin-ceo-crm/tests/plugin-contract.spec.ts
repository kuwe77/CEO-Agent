import { describe, expect, it } from "vitest";
import { pluginManifestV1Schema } from "@paperclipai/shared";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("CEO CRM plugin contract", () => {
  it("validates the manifest and refuses a tool company mismatch", async () => {
    expect(pluginManifestV1Schema.parse(manifest).agents).toBeUndefined();
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);
    await expect(harness.executeTool("crm_search", { companyId: "company-b", query: "Acme" }, { companyId: "company-a" })).rejects.toThrow("companyId must match");
  });

  it.each([
    ["get-contact", "contactId", "missing-contact", "contact not found"],
    ["get-deal", "dealId", "missing-deal", "deal not found"],
  ] as const)("returns HTTP 404 for a missing stable record through %s", async (routeKey, paramName, recordId, message) => {
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    await expect(plugin.definition.onApiRequest?.({
      routeKey,
      method: "GET",
      path: `/${routeKey}/${recordId}`,
      params: { [paramName]: recordId },
      query: {},
      body: null,
      actor: {
        actorType: "user",
        actorId: "local-board",
        userId: "local-board",
        agentId: null,
        runId: null,
      },
      companyId: "company-a",
      headers: {},
    })).resolves.toEqual({ status: 404, body: { error: message } });
  });
});
