import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { installSkill } from "./install-skill.js";

describe("installSkill", () => {
  it("copies the bundled skill into a skills root", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-"));
    const result = installSkill({ dest: directory });

    expect(result.destination).toBe(path.join(directory, "asciidoclint"));
    expect(fs.existsSync(path.join(result.destination, "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.destination, "references", "result-schema.md"))).toBe(true);
  });

  it("requires force before replacing an installed skill", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-"));
    installSkill({ dest: directory });

    expect(() => installSkill({ dest: directory })).toThrow(/already exists/);
    expect(() => installSkill({ dest: directory, force: true })).not.toThrow();
  });
});
