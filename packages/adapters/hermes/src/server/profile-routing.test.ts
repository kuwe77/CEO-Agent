import { describe, expect, it } from "vitest";

import { resolveCompanyHermesProfile } from "./profile-routing.js";

describe("resolveCompanyHermesProfile", () => {
  it("derives a host profile name from the owning company and logical label", () => {
    expect(resolveCompanyHermesProfile("company-1", "strategy")).toBe("pccompany1strategy");
  });

  it("does not let two companies resolve the same logical profile to one host profile", () => {
    expect(resolveCompanyHermesProfile("company-a", "sales"))
      .not.toBe(resolveCompanyHermesProfile("company-b", "sales"));
  });

  it("rejects labels that are not valid lowercase alphanumeric Hermes profile names", () => {
    expect(() => resolveCompanyHermesProfile("company-1", "../founder"))
      .toThrow(/lowercase alphanumeric/);
  });
});
