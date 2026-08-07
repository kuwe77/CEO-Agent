import os from "node:os";
import path from "node:path";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { testEnvironment } from "./test.js";

test("reports an available explicitly configured Hermes profile before activation", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "hermes-profile-validation-"));
  const cliPath = path.join(tempDir, "fake-hermes");

  try {
    await writeFile(
      cliPath,
      "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo fake-hermes 1.0; exit 0; fi\nif [ \"$1\" = \"profile\" ] && [ \"$2\" = \"show\" ] && [ \"$3\" = \"pccompanyteststrategy\" ]; then exit 0; fi\nexit 1\n",
      "utf8",
    );
    await chmod(cliPath, 0o755);

    const result = await testEnvironment({
      companyId: "company-test",
      adapterType: "hermes_local",
      config: { command: cliPath, hermesProfile: "strategy" },
    });

    expect(result.checks).toContainEqual(expect.objectContaining({
      code: "hermes_profile_available",
      level: "info",
    }));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("fails preflight when an explicitly configured Hermes profile is unavailable", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "hermes-profile-validation-"));
  const cliPath = path.join(tempDir, "fake-hermes");

  try {
    await writeFile(
      cliPath,
      "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then echo fake-hermes 1.0; exit 0; fi\nexit 1\n",
      "utf8",
    );
    await chmod(cliPath, 0o755);

    const result = await testEnvironment({
      companyId: "company-test",
      adapterType: "hermes_local",
      config: { command: cliPath, hermesProfile: "missingspecialist" },
    });

    expect(result.status).toBe("fail");
    expect(result.checks).toContainEqual(expect.objectContaining({
      code: "hermes_profile_unavailable",
      level: "error",
    }));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
