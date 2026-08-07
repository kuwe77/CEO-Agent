import type { Agent } from "@paperclipai/shared";

import { resolveAdapterTestEnvironmentId } from "./adapter-test-environment";

type RuntimeValidationAgent = Pick<Agent, "adapterType" | "defaultEnvironmentId"> & {
  adapterConfig?: unknown;
};

export function buildAgentRuntimeValidationRequest(
  agent: RuntimeValidationAgent,
  instanceDefaultEnvironmentId: string | null | undefined,
) {
  if (!agent.adapterType) throw new Error("Agent runtime is not configured.");
  const adapterConfig = agent.adapterConfig
    && typeof agent.adapterConfig === "object"
    && !Array.isArray(agent.adapterConfig)
    ? agent.adapterConfig as Record<string, unknown>
    : {};

  return {
    adapterType: agent.adapterType,
    data: {
      adapterConfig,
      environmentId: resolveAdapterTestEnvironmentId({
        agentDefaultEnvironmentId: agent.defaultEnvironmentId,
        instanceDefaultEnvironmentId,
      }),
    },
  };
}
