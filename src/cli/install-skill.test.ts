import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installSkill, uninstallSkill } from "./install-skill.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("installSkill", () => {
  it("copies the bundled skill to the global common root and links Claude to it", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-home-"));
    const result = installSkill({ homeDir: home });
    const common = path.join(home, ".agents", "skills", "asciidoclint");
    const claude = path.join(home, ".claude", "skills", "asciidoclint");

    expect(result.destination).toBe(common);
    expect(result.destinations).toEqual([common, claude]);
    expect(fs.existsSync(path.join(common, "SKILL.md"))).toBe(true);
    expect(fs.lstatSync(common).isDirectory()).toBe(true);
    expect(fs.lstatSync(claude).isSymbolicLink()).toBe(true);
    expect(fs.realpathSync(claude)).toBe(fs.realpathSync(common));
  });

  it("creates project skill symlinks in both common and Claude roots", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-project-"));
    const realDirectory = fs.realpathSync(directory);
    const originalCwd = process.cwd();
    try {
      process.chdir(directory);
      const result = installSkill({ project: true });
      const common = path.join(realDirectory, ".agents", "skills", "asciidoclint");
      const claude = path.join(realDirectory, ".claude", "skills", "asciidoclint");

      expect(result.destination).toBe(common);
      expect(result.destinations).toEqual([common, claude]);
      expect(fs.lstatSync(common).isSymbolicLink()).toBe(true);
      expect(fs.lstatSync(claude).isSymbolicLink()).toBe(true);
      expect(fs.realpathSync(common)).toBe(fs.realpathSync(result.source));
      expect(fs.realpathSync(claude)).toBe(fs.realpathSync(result.source));
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("requires force before replacing installed global skill artifacts", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-home-"));
    installSkill({ homeDir: home });

    expect(() => installSkill({ homeDir: home })).toThrow(/already exists/);
    expect(() => installSkill({ homeDir: home, force: true })).not.toThrow();
  });

  it("does not leave a partial global install when the second destination already exists", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-home-"));
    const common = path.join(home, ".agents", "skills", "asciidoclint");
    const claude = path.join(home, ".claude", "skills", "asciidoclint");
    fs.mkdirSync(claude, { recursive: true });

    expect(() => installSkill({ homeDir: home })).toThrow(/already exists/);
    expect(pathExists(common)).toBe(false);
    expect(pathExists(claude)).toBe(true);
  });

  it("does not leave a partial project install when the second destination already exists", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-project-"));
    const realDirectory = fs.realpathSync(directory);
    const common = path.join(realDirectory, ".agents", "skills", "asciidoclint");
    const claude = path.join(realDirectory, ".claude", "skills", "asciidoclint");
    fs.mkdirSync(claude, { recursive: true });

    const originalCwd = process.cwd();
    try {
      process.chdir(directory);
      expect(() => installSkill({ project: true })).toThrow(/already exists/);
      expect(pathExists(common)).toBe(false);
      expect(pathExists(claude)).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("rolls back a partial global install when linking Claude fails", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-home-"));
    const common = path.join(home, ".agents", "skills", "asciidoclint");
    const claude = path.join(home, ".claude", "skills", "asciidoclint");
    vi.spyOn(fs, "symlinkSync").mockImplementation(() => {
      throw new Error("simulated link failure");
    });

    expect(() => installSkill({ homeDir: home })).toThrow(/simulated link failure/);
    expect(pathExists(common)).toBe(false);
    expect(pathExists(claude)).toBe(false);
  });

  it("rolls back a partial project install when the second symlink fails", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-project-"));
    const realDirectory = fs.realpathSync(directory);
    const common = path.join(realDirectory, ".agents", "skills", "asciidoclint");
    const claude = path.join(realDirectory, ".claude", "skills", "asciidoclint");
    const symlinkSync = fs.symlinkSync.bind(fs);
    vi.spyOn(fs, "symlinkSync")
      .mockImplementationOnce(symlinkSync)
      .mockImplementationOnce(() => {
        throw new Error("simulated link failure");
      });

    const originalCwd = process.cwd();
    try {
      process.chdir(directory);
      expect(() => installSkill({ project: true })).toThrow(/simulated link failure/);
      expect(pathExists(common)).toBe(false);
      expect(pathExists(claude)).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("keeps explicit dest as a direct copy compatibility path", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-dest-"));
    const result = installSkill({ dest: directory });

    expect(result.destination).toBe(path.join(directory, "asciidoclint"));
    expect(result.destinations).toEqual([path.join(directory, "asciidoclint")]);
    expect(fs.existsSync(path.join(result.destination, "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(result.destination, "references", "result-schema.md"))).toBe(true);
    expect(fs.lstatSync(result.destination).isDirectory()).toBe(true);
  });

  it("rejects deprecated agent-specific install roots", () => {
    expect(() => installSkill({ agent: "openclaw" })).toThrow(/--agent is deprecated/);
  });
});

describe("uninstallSkill", () => {
  it("uninstalls global common copy and Claude symlink", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-home-"));
    const install = installSkill({ homeDir: home });
    const result = uninstallSkill({ homeDir: home });

    expect(result).toEqual({
      destination: install.destinations[1],
      destinations: [install.destinations[1], install.destinations[0]],
      removed: true,
      removedDestinations: [install.destinations[1], install.destinations[0]],
    });
    expect(pathExists(install.destinations[0])).toBe(false);
    expect(pathExists(install.destinations[1])).toBe(false);
  });

  it("uninstalls project skill symlinks", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-project-"));
    const originalCwd = process.cwd();
    try {
      process.chdir(directory);
      const install = installSkill({ project: true });
      const result = uninstallSkill({ project: true });

      expect(result).toEqual({
        destination: install.destinations[0],
        destinations: install.destinations,
        removed: true,
        removedDestinations: install.destinations,
      });
      expect(pathExists(install.destinations[0])).toBe(false);
      expect(pathExists(install.destinations[1])).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("treats uninstalling missing skill roots as a no-op", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-home-"));
    const common = path.join(home, ".agents", "skills", "asciidoclint");
    const claude = path.join(home, ".claude", "skills", "asciidoclint");

    expect(uninstallSkill({ homeDir: home })).toEqual({
      destination: claude,
      destinations: [claude, common],
      removed: false,
      removedDestinations: [],
    });
  });

  it("removes broken project symlinks idempotently", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-project-"));
    const realDirectory = fs.realpathSync(directory);
    const common = path.join(realDirectory, ".agents", "skills", "asciidoclint");
    const claude = path.join(realDirectory, ".claude", "skills", "asciidoclint");
    fs.mkdirSync(path.dirname(common), { recursive: true });
    fs.mkdirSync(path.dirname(claude), { recursive: true });
    fs.symlinkSync("../../missing", common, "dir");
    fs.symlinkSync("../../missing", claude, "dir");

    const originalCwd = process.cwd();
    try {
      process.chdir(directory);
      const result = uninstallSkill({ project: true });
      expect(result.removed).toBe(true);
      expect(result.removedDestinations).toEqual([common, claude]);
      expect(pathExists(common)).toBe(false);
      expect(pathExists(claude)).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("uninstalls an explicit dest copy", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-skill-dest-"));
    const install = installSkill({ dest: directory });
    const result = uninstallSkill({ dest: directory });

    expect(result).toEqual({
      destination: install.destination,
      destinations: [install.destination],
      removed: true,
      removedDestinations: [install.destination],
    });
    expect(pathExists(install.destination)).toBe(false);
  });

  it("rejects deprecated agent-specific uninstall roots", () => {
    expect(() => uninstallSkill({ agent: "codex" })).toThrow(/--agent is deprecated/);
  });
});

function pathExists(file: string): boolean {
  // NOTE: duplicated from install-skill's private pathExists; update both implementations together.
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
