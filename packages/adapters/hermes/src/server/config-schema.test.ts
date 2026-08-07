import { expect, test } from "vitest";

import { getConfigSchema } from "./config-schema.js";

test("exposes an explicit Hermes profile field for specialist isolation", () => {
  const profileField = getConfigSchema().fields.find((field) => field.key === "hermesProfile");

  expect(profileField).toMatchObject({
    key: "hermesProfile",
    label: "Hermes profile",
    type: "text",
  });
});
