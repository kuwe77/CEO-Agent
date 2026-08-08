import { describe, expect, it, vi } from "vitest";
import { formatCrmOverviewSummary, runFounderFormMutation } from "../src/ui/app.js";

describe("CRM UI behavior", () => {
  it("formats the dashboard overview as one stable text child", () => {
    expect(formatCrmOverviewSummary({
      accounts: 2,
      contacts: 3,
      deals: 4,
      evidenceProposals: 5,
    })).toBe("2 accounts · 3 contacts · 4 deals · 5 evidence proposals");
  });

  it("only resets founder form state after a successful mutation", async () => {
    const form = { reset: vi.fn() };
    const rotateIdempotencyKey = vi.fn();

    await expect(runFounderFormMutation(
      async () => { throw new Error("account domain already exists"); },
      form,
      rotateIdempotencyKey,
    )).rejects.toThrow("account domain already exists");
    expect(form.reset).not.toHaveBeenCalled();
    expect(rotateIdempotencyKey).not.toHaveBeenCalled();

    await expect(runFounderFormMutation(
      async () => ({ id: "account-1" }),
      form,
      rotateIdempotencyKey,
    ))
      .resolves.toEqual({ id: "account-1" });
    expect(rotateIdempotencyKey).toHaveBeenCalledOnce();
    expect(form.reset).toHaveBeenCalledOnce();
  });
});
