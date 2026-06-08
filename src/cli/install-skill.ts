import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface InstallSkillOptions {
  dest?: string;
  project?: boolean;
  agent?: SupportedSkillAgent;
  force?: boolean;
  homeDir?: string;
}

export interface InstallSkillResult {
  source: string;
  destination: string;
  destinations: string[];
}

export interface UninstallSkillOptions {
  dest?: string;
  project?: boolean;
  agent?: SupportedSkillAgent;
  homeDir?: string;
}

export interface UninstallSkillResult {
  destination: string;
  destinations: string[];
  removed: boolean;
  removedDestinations: string[];
}

const skillName = "asciidoclint";
const deprecatedAgentMessage =
  "--agent is deprecated and no longer selects a skill root. Use the command without --agent for the default global roots, add --project for project roots, or use --dest <directory> for a custom root.";

export type SupportedSkillAgent = "codex" | "cursor" | "claude-code" | "openclaw";

export function installSkill(options: InstallSkillOptions = {}): InstallSkillResult {
  rejectDeprecatedAgentOption(options.agent);
  const source = findBundledSkill();

  if (options.dest) {
    const destination = path.join(path.resolve(options.dest), skillName);
    installCopy(source, destination, options.force);
    return { source, destination, destinations: [destination] };
  }

  if (options.project) {
    const destinations = projectSkillDestinations(process.cwd());
    prepareDestinations(destinations, options.force);
    installPreparedDestinations(destinations, (destination) => writeSymlink(source, destination));
    return { source, destination: destinations[0], destinations };
  }

  const { common, claude } = globalSkillDestinations(options.homeDir);
  prepareDestinations([common, claude], options.force);
  installPreparedDestinations([common, claude], (destination) => {
    if (destination === common) {
      writeCopy(source, common);
      return;
    }
    writeSymlink(common, claude);
  });
  return { source, destination: common, destinations: [common, claude] };
}

export function uninstallSkill(options: UninstallSkillOptions = {}): UninstallSkillResult {
  rejectDeprecatedAgentOption(options.agent);
  const destinations = uninstallDestinations(options);
  const removedDestinations: string[] = [];
  for (const destination of destinations) {
    if (pathExists(destination)) {
      removePath(destination);
      removedDestinations.push(destination);
    }
  }
  return {
    // For global uninstall, destinations are ordered for removal safety:
    // Claude symlink first, then the common copy.
    destination: destinations[0],
    destinations,
    removed: removedDestinations.length > 0,
    removedDestinations,
  };
}

function rejectDeprecatedAgentOption(agent: SupportedSkillAgent | undefined): void {
  if (agent) {
    throw new Error(deprecatedAgentMessage);
  }
}

function uninstallDestinations(options: UninstallSkillOptions): string[] {
  if (options.dest) {
    return [path.join(path.resolve(options.dest), skillName)];
  }
  if (options.project) {
    return projectSkillDestinations(process.cwd());
  }
  const { common, claude } = globalSkillDestinations(options.homeDir);
  return [claude, common];
}

function projectSkillDestinations(root: string): string[] {
  return [
    path.resolve(root, ".agents", "skills", skillName),
    path.resolve(root, ".claude", "skills", skillName),
  ];
}

function globalSkillDestinations(homeDir = os.homedir()): { common: string; claude: string } {
  return {
    common: path.join(homeDir, ".agents", "skills", skillName),
    claude: path.join(homeDir, ".claude", "skills", skillName),
  };
}

function installCopy(source: string, destination: string, force = false): void {
  if (path.resolve(source) === path.resolve(destination)) {
    return;
  }
  prepareDestination(destination, force);
  writeCopy(source, destination);
}

function prepareDestinations(destinations: string[], force = false): void {
  for (const destination of destinations) {
    prepareDestination(destination, force);
  }
}

function installPreparedDestinations(destinations: string[], write: (destination: string) => void): void {
  const written: string[] = [];
  try {
    for (const destination of destinations) {
      write(destination);
      written.push(destination);
    }
  } catch (error) {
    rollbackWrittenDestinations(written);
    throw error;
  }
}

function rollbackWrittenDestinations(destinations: string[]): void {
  for (const destination of destinations.slice().reverse()) {
    if (pathExists(destination)) {
      removePath(destination);
    }
  }
}

function writeCopy(source: string, destination: string): void {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

function writeSymlink(source: string, destination: string): void {
  if (path.resolve(source) === path.resolve(destination)) {
    return;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.symlinkSync(path.relative(path.dirname(destination), source), destination, "dir");
}

function prepareDestination(destination: string, force: boolean): void {
  if (!pathExists(destination)) {
    return;
  }
  if (!force) {
    throw new Error(`${destination} already exists; pass --force to replace it`);
  }
  removePath(destination);
}

function removePath(file: string): void {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink()) {
    fs.unlinkSync(file);
    return;
  }
  fs.rmSync(file, { recursive: true, force: true });
}

function pathExists(file: string): boolean {
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
