import { beforeEach, expect, test, vi } from "vitest";

vi.mock("@paperclipai/adapter-utils/execution-target", () => ({
  describeAdapterExecutionTarget: vi.fn(() => "remote specialist environment"),
  resolveAdapterExecutionTargetCwd: vi.fn((_target, _configured, fallback) => fallback),
  runAdapterExecutionTargetProcess: vi.fn(async (
    _runId: string,
    _target: unknown,
    command: string,
    args: string[],
  ) => ({
    exitCode: 0,
    signal: null,
    timedOut: false,
    stdout: args[0] === "--version"
      ? "Hermes Agent v0.19.0\nPython: 3.11.15\n"
      : "",
    stderr: "",
  })),
}));

import { runAdapterExecutionTargetProcess } from "@paperclipai/adapter-utils/execution-target";
import { testEnvironment } from "./test.js";

const remoteTarget = {
  kind: "remote" as const,
  transport: "sandbox" as const,
  providerKey: "test",
  remoteCwd: "/workspace",
};

beforeEach(() => {
  vi.clearAllMocks();
});

test("runs Hermes CLI and company-owned profile probes inside the selected remote environment", async () => {
  const result = await testEnvironment({
    companyId: "company-test",
    adapterType: "hermes_local",
    config: { command: "hermes", hermesProfile: "strategy" },
    executionTarget: remoteTarget,
    environmentName: "Sales sandbox",
  });

  const calls = vi.mocked(runAdapterExecutionTargetProcess).mock.calls;
  expect(calls).toEqual(expect.arrayContaining([
    expect.arrayContaining([expect.any(String), remoteTarget, "hermes", ["--version"]]),
    expect.arrayContaining([
      expect.any(String),
      remoteTarget,
      "hermes",
      ["profile", "show", "pccompanyteststrategy"],
    ]),
  ]));
  expect(calls.some((call) => call[2] === "python3")).toBe(false);
  expect(result.checks).toContainEqual(expect.objectContaining({
    code: "hermes_environment_target",
    level: "info",
  }));
  expect(result.checks).toContainEqual(expect.objectContaining({
    code: "hermes_profile_available",
  }));
  expect(result.checks).toContainEqual(expect.objectContaining({
    code: "hermes_python_runtime",
    level: "info",
  }));
});
