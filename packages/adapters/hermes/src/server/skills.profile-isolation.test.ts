import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

import { listHermesSkills } from "./skills.js";

const tempDirs: string[] = [];

async function installSkill(root: string, category: string, name: string) {
  const dir = path.join(root, category, name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${name} test skill\n---\n`,
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Hermes profile skill isolation", () => {
  it("lists skills from the company-owned specialist profile instead of the default profile", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "hermes-profile-skills-"));
    tempDirs.push(home);

    await installSkill(path.join(home, ".hermes", "skills"), "engineering", "default-only");
    await installSkill(
      path.join(home, ".hermes", "profiles", "pccompanytestsales", "skills"),
      "business",
      "sales-only",
    );

    const result = await listHermesSkills({
      companyId: "company-test",
      adapterType: "hermes_local",
      config: {
        hermesProfile: "sales",
        env: { HOME: home },
      },
    } as any);

    const keys = result.entries.map((entry) => entry.key);
    expect(keys).toContain("sales-only");
    expect(keys).not.toContain("default-only");
  });

  it("does not read the controller profile when the agent targets a remote environment", async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), "hermes-remote-skills-"));
    tempDirs.push(home);

    await installSkill(
      path.join(home, ".hermes", "profiles", "pccompanytestsales", "skills"),
      "business",
      "controller-only",
    );

    const result = await listHermesSkills({
      agentId: "agent-test",
      companyId: "company-test",
      adapterType: "hermes_local",
      executionTargetKind: "remote",
      config: {
        hermesProfile: "sales",
        env: { HOME: home },
      },
    } as any);

    expect(result.entries.map((entry) => entry.key)).not.toContain("controller-only");
    expect(result.warnings).toContainEqual(expect.stringMatching(/remote.*unsupported/i));
  });
});
