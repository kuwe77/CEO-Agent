import { expect, test } from "vitest";
import type { CreateConfigValues } from "@paperclipai/adapter-utils";

import { buildHermesConfig } from "./build-config.js";

const baseValues: CreateConfigValues = {
  adapterType: "hermes_local",
  cwd: "",
  promptTemplate: "",
  model: "",
  thinkingEffort: "",
  chrome: false,
  dangerouslySkipPermissions: false,
  search: false,
  fastMode: false,
  dangerouslyBypassSandbox: false,
  command: "",
  args: "",
  extraArgs: "",
  envVars: "",
  envBindings: {},
  url: "",
  bootstrapPrompt: "",
  maxTurnsPerRun: 0,
  heartbeatEnabled: false,
  intervalSec: 0,
};

test("preserves schema-driven Hermes profile and runtime settings when creating an agent", () => {
  const config = buildHermesConfig({
    ...baseValues,
    adapterSchemaValues: {
      hermesProfile: "strategy",
      provider: "openai-codex",
      quiet: true,
    },
  });

  expect(config).toMatchObject({
    hermesProfile: "strategy",
    provider: "openai-codex",
    quiet: true,
  });
});
