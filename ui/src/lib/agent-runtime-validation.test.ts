import { describe, expect, it } from "vitest";

import { buildAgentRuntimeValidationRequest } from "./agent-runtime-validation";

describe("buildAgentRuntimeValidationRequest", () => {
  it("targets the agent-owned execution environment", () => {
    expect(buildAgentRuntimeValidationRequest({
      adapterType: "hermes_local",
      adapterConfig: { hermesProfile: "sales" },
      defaultEnvironmentId: "agent-environment",
    }, "instance-environment")).toEqual({
      adapterType: "hermes_local",
      data: {
        adapterConfig: { hermesProfile: "sales" },
        environmentId: "agent-environment",
      },
    });
  });

  it("targets the instance default instead of silently probing the host", () => {
    expect(buildAgentRuntimeValidationRequest({
      adapterType: "hermes_local",
      adapterConfig: null,
      defaultEnvironmentId: null,
    }, "instance-environment")).toEqual({
      adapterType: "hermes_local",
      data: {
        adapterConfig: {},
        environmentId: "instance-environment",
      },
    });
  });
});
