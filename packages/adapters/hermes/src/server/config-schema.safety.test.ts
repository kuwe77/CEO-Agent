import { describe, expect, it } from "vitest";

import { getConfigSchema } from "./config-schema.js";

describe("Hermes adapter safety configuration", () => {
  it("exposes dangerous-command approval bypass as an explicit default-off setting", () => {
    const field = getConfigSchema().fields.find(
      (candidate) => candidate.key === "bypassDangerousCommandApprovals",
    );

    expect(field).toEqual(expect.objectContaining({
      type: "toggle",
      default: false,
    }));
    expect(field?.hint).toContain("sandboxed");
  });
});
