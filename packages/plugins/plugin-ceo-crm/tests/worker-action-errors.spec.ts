import { describe, expect, it, vi } from "vitest";
import { PLUGIN_RPC_ERROR_CODES } from "@paperclipai/plugin-sdk";
import { performCrmAction } from "../src/worker.js";

describe("CRM action error boundary", () => {
  it("logs internal details but returns an opaque worker error", async () => {
    const logger = { error: vi.fn() };
    const internal = new Error("duplicate key violates secret_internal_index");

    await expect(performCrmAction(
      { logger } as never,
      async () => { throw internal; },
    )).rejects.toMatchObject({
      message: "CRM action failed",
      code: PLUGIN_RPC_ERROR_CODES.WORKER_ERROR,
    });
    expect(logger.error).toHaveBeenCalledWith(
      "CRM action failed with an internal error",
      { error: internal.message },
    );
  });
});