import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { installSkill, uninstallSkill } from "./install-skill.js";

describe("installSkill", () => {
  it("copies the bundled skill into a skills root", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-"));
    const result = installSkill({ dest: directory });

    expect(result.destination).toBe(path.join(directory, "asciidoclint"));
    expect(fs.existsSync(path.join(result.destination, "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.destination, "references", "result-schema.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.destination, "references", "lint-summary.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.destination, "references", "agentic-fix.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.destination, "references", "waivers.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.destination, "references", "rule-create.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.destination, "references", "rule-review.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.destination, "references", "feedback.md"))).toBe(true);
  });

  it("requires force before replacing an installed skill", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-"));
    installSkill({ dest: directory });

    expect(() => installSkill({ dest: directory })).toThrow(/already exists/);
    expect(() => installSkill({ dest: directory, force: true })).not.toThrow();
  });

  it("uninstalls an installed skill from a skills root", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-"));
    installSkill({ dest: directory });

    const result = uninstallSkill({ dest: directory });

    expect(result).toEqual({
      destination: path.join(directory, "asciidoclint"),
      removed: true,
    });
    expect(fs.existsSync(result.destination)).toBe(false);
  });

  it("treats uninstalling a missing skill as a no-op", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-"));

    expect(uninstallSkill({ dest: directory })).toEqual({
      destination: path.join(directory, "asciidoclint"),
      removed: false,
    });
  });

  it("installs project skills to the target agent directory", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-project-"));
    const realDirectory = fs.realpathSync(directory);
    const originalCwd = process.cwd();
    try {
      process.chdir(directory);

      expect(installSkill({ project: true, agent: "codex" }).destination).toBe(
        path.join(realDirectory, ".agents", "skills", "asciidoclint"),
      );
      expect(installSkill({ project: true, agent: "cursor", force: true }).destination).toBe(
        path.join(realDirectory, ".agents", "skills", "asciidoclint"),
      );
      expect(installSkill({ project: true, agent: "claude-code" }).destination).toBe(
        path.join(realDirectory, ".claude", "skills", "asciidoclint"),
      );
      expect(installSkill({ project: true, agent: "openclaw" }).destination).toBe(
        path.join(realDirectory, "skills", "asciidoclint"),
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("lets explicit dest override the target agent root", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-dest-"));
    expect(installSkill({ dest: directory, agent: "claude-code" }).destination).toBe(
      path.join(directory, "asciidoclint"),
    );
    expect(uninstallSkill({ dest: directory, agent: "cursor" })).toEqual({
      destination: path.join(directory, "asciidoclint"),
      removed: true,
    });
  });
});
