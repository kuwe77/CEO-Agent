import { describe, expect, it } from "vitest";
import { crmControlStyle, crmFormStyle } from "../src/ui/app.js";

describe("CEO CRM visual contracts", () => {
  it("keeps founder action controls visible and compact", () => {
    expect(crmControlStyle.minHeight).toBe(42);
    expect(crmControlStyle.border).toBeTruthy();
    expect(crmControlStyle.background).toBeTruthy();
    expect(crmFormStyle.display).toBe("grid");
    expect(crmFormStyle.border).toBeTruthy();
  });
});
