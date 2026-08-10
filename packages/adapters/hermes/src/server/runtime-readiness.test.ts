import { describe, expect, it, vi } from "vitest";

import {
  checkHermesAuthPool,
  checkHermesPythonRuntime,
} from "./test.js";

describe("Hermes runtime readiness", () => {
  it("uses the Python runtime reported by the Hermes launcher instead of an unrelated PATH python3", async () => {
    const probe = vi.fn(async (command: string, args: string[]) => {
      if (command === "hermes" && args[0] === "--version") {
        return {
          stdout: "Hermes Agent v0.19.0\nPython: 3.11.15\n",
          stderr: "",
        };
      }
      if (command === "python3") {
        return { stdout: "Python 3.9.6\n", stderr: "" };
      }
      throw new Error(`unexpected probe: ${command} ${args.join(" ")}`);
    });

    const result = await checkHermesPythonRuntime("hermes", probe);

    expect(result).toEqual(expect.objectContaining({
      level: "info",
      code: "hermes_python_runtime",
    }));
    expect(result?.message).toContain("3.11.15");
    expect(probe).not.toHaveBeenCalledWith("python3", expect.anything(), expect.anything());
  });

  it("does not reject a working Hermes launcher because an unrelated PATH python3 is old", async () => {
    const probe = vi.fn(async (command: string) => {
      if (command === "hermes") {
        return { stdout: "Hermes Agent v0.18.0\n", stderr: "" };
      }
      return { stdout: "Python 3.9.6\n", stderr: "" };
    });

    const result = await checkHermesPythonRuntime("hermes", probe);

    expect(result).toEqual(expect.objectContaining({
      level: "warn",
      code: "hermes_python_runtime_unverified",
    }));
    expect(probe).not.toHaveBeenCalledWith("python3", expect.anything(), expect.anything());
  });

  it("accepts launcher Python metadata written to stderr", async () => {
    const probe = vi.fn(async () => ({
      stdout: "",
      stderr: "Hermes Agent v0.19.0\nPython: 3.11.15\n",
    }));

    const result = await checkHermesPythonRuntime("hermes", probe);

    expect(result).toEqual(expect.objectContaining({
      level: "info",
      code: "hermes_python_runtime",
    }));
    expect(result?.message).toContain("3.11.15");
  });

  it("recognizes a selected profile's OpenAI Codex OAuth pool without exposing credentials", async () => {
    const probe = vi.fn(async () => ({
      stdout: "copilot (1 credentials):\n  #1  gh auth token api_key\n\nopenai-codex (1 credentials):\n  #1  device_code oauth\n",
      stderr: "",
    }));

    const result = await checkHermesAuthPool(
      "hermes",
      "company-test",
      { hermesProfile: "sales", provider: "openai-codex" },
      probe,
    );

    expect(result).toEqual(expect.objectContaining({
      level: "info",
      code: "hermes_auth_pool_available",
    }));
    expect(result?.message).toContain("openai-codex");
    expect(result?.message).not.toContain("device_code");
    expect(probe).toHaveBeenCalledWith(
      "hermes",
      ["--profile", "pccompanytestsales", "auth", "list"],
      10_000,
    );
  });

  it("uses the detected profile provider when adapter provider is auto", async () => {
    const probe = vi.fn(async () => ({
      stdout: "openai-codex (1 credentials):\n  #1  device_code oauth\n",
      stderr: "",
    }));

    const result = await checkHermesAuthPool(
      "hermes",
      "company-test",
      { hermesProfile: "sales", provider: "auto" },
      probe,
      { provider: "openai-codex" },
    );

    expect(result).toEqual(expect.objectContaining({
      level: "info",
      code: "hermes_auth_pool_available",
    }));
  });

  it("parses ANSI-decorated auth pool output without returning credential details", async () => {
    const probe = vi.fn(async () => ({
      stdout: "\u001b[32mopenai-codex (1 credentials):\u001b[0m\n  #1  secret-detail\n",
      stderr: "",
    }));

    const result = await checkHermesAuthPool(
      "hermes",
      "company-test",
      { hermesProfile: "sales", provider: "openai-codex" },
      probe,
    );

    expect(result).toEqual(expect.objectContaining({
      level: "info",
      code: "hermes_auth_pool_available",
    }));
    expect(JSON.stringify(result)).not.toContain("secret-detail");
  });

  it("does not report an auth pool when the requested provider has no usable credentials", async () => {
    const probe = vi.fn(async () => ({
      stdout: "openai-codex (0 credentials):\n",
      stderr: "",
    }));

    const result = await checkHermesAuthPool(
      "hermes",
      "company-test",
      { hermesProfile: "sales", provider: "openai-codex" },
      probe,
    );

    expect(result).toBeNull();
  });
});
