import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface InstallSkillOptions {
  dest?: string;
  project?: boolean;
  force?: boolean;
}

export interface InstallSkillResult {
  source: string;
  destination: string;
}

const skillName = "asciidoclint";

export function installSkill(options: InstallSkillOptions = {}): InstallSkillResult {
  const source = findBundledSkill();
  const root = options.dest
    ? path.resolve(options.dest)
    : options.project
      ? path.resolve(process.cwd(), ".codex", "skills")
      : path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex"), "skills");
  const destination = path.join(root, skillName);

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
