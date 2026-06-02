import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface InstallSkillOptions {
  dest?: string;
  project?: boolean;
  agent?: SupportedSkillAgent;
  force?: boolean;
}

export interface InstallSkillResult {
  source: string;
  destination: string;
}

export interface UninstallSkillOptions {
  dest?: string;
  project?: boolean;
  agent?: SupportedSkillAgent;
}

export interface UninstallSkillResult {
  destination: string;
  removed: boolean;
}

const skillName = "asciidoclint";
const defaultAgent = "codex";

export type SupportedSkillAgent = "codex" | "cursor" | "claude-code" | "openclaw";

const skillAgentRoots: Record<SupportedSkillAgent, { project: string; global: string }> = {
  codex: {
    project: path.join(".agents", "skills"),
    global: path.join(os.homedir(), ".codex", "skills"),
  },
  cursor: {
    project: path.join(".agents", "skills"),
    global: path.join(os.homedir(), ".cursor", "skills"),
  },
  "claude-code": {
    project: path.join(".claude", "skills"),
    global: path.join(os.homedir(), ".claude", "skills"),
  },
  openclaw: {
    project: "skills",
    global: path.join(os.homedir(), ".openclaw", "skills"),
  },
};

export function installSkill(options: InstallSkillOptions = {}): InstallSkillResult {
  const source = findBundledSkill();
  const root = resolveSkillsRoot(options);
  const destination = path.join(root, skillName);

  if (path.resolve(source) === path.resolve(destination)) {
    return { source, destination };
  }

  if (fs.existsSync(destination)) {
    if (!options.force) {
      throw new Error(`${destination} already exists; pass --force to replace it`);
    }
    fs.rmSync(destination, { recursive: true, force: true });
  }

  fs.mkdirSync(root, { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
  return { source, destination };
}

export function uninstallSkill(options: UninstallSkillOptions = {}): UninstallSkillResult {
  const destination = path.join(resolveSkillsRoot(options), skillName);
  const removed = fs.existsSync(destination);
  if (removed) {
    fs.rmSync(destination, { recursive: true, force: true });
  }
  return { destination, removed };
}

function resolveSkillsRoot(options: { dest?: string; project?: boolean; agent?: SupportedSkillAgent }): string {
  if (options.dest) {
    return path.resolve(options.dest);
  }
  const agent = options.agent ?? defaultAgent;
  const roots = skillAgentRoots[agent];
  if (!roots) {
    throw new Error(`Unsupported skill agent: ${agent}`);
  }
  return options.project ? path.resolve(process.cwd(), roots.project) : roots.global;
}

function findBundledSkill(): string {
  let current = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = path.join(current, "skills", skillName);
    if (fs.existsSync(path.join(candidate, "SKILL.md"))) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not find bundled ${skillName} skill`);
    }
    current = parent;
  }
}
