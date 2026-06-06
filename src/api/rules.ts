import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import yaml from "js-yaml";
import { builtInRules } from "../rules/builtin.js";
import { validateRules } from "../rules/registry.js";
import type { Rule } from "../types.js";

export interface Config {
  extends?: string | string[];
  documents?: string[];
  customRules?: string[];
  ignores?: string[];
  rules?: Record<string, RuleSetting>;
}

export type RuleSetting = boolean | { severity?: "error" | "warning" | "info"; enabled?: boolean };

export interface RuleLoadOptions {
  configFile?: string;
  customRules?: string[];
  cwd?: string;
  homeDir?: string;
  noGlobalConfig?: boolean;
}

export interface ConfigSource {
  kind: "global" | "project" | "explicit";
  file: string;
}

export interface ConfigLoadOptions {
  configFile?: string;
  cwd?: string;
  homeDir?: string;
  noGlobalConfig?: boolean;
}

export async function loadRules(options: RuleLoadOptions = {}): Promise<{ config: Config; rules: Rule[] }> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const config = loadConfig(options.configFile, cwd, options);
  const customRules = [
    ...await loadCustomRules(config.customRules ?? [], cwd),
    ...await loadCustomRules(options.customRules ?? [], cwd),
  ];
  const rules = [...builtInRules, ...customRules];
  validateRules(rules);
  return { config, rules };
}

export function ruleMetadata(rule: Rule): object {
  return {
    id: rule.id,
    alias: rule.alias,
    description: rule.description,
    tags: rule.tags,
    parser: rule.parser,
    configSchema: rule.configSchema,
    docs: rule.docs,
  };
}

export function loadConfig(configFile: string | undefined, cwd: string, options: ConfigLoadOptions = {}): Config {
  return loadConfigDetails({ ...options, configFile, cwd }).config;
}

export function loadConfigDetails(options: ConfigLoadOptions = {}): { config: Config; sources: ConfigSource[] } {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const sources = configSources({
    configFile: options.configFile,
    cwd,
    homeDir: options.homeDir,
    noGlobalConfig: options.noGlobalConfig,
  });
  const config = sources.reduce<Config>((base, source) => (
    mergeConfig(base, configFromFile(source.file))
  ), {});
  return { config, sources };
}

export async function loadCustomRules(references: string[], cwd: string): Promise<Rule[]> {
  const rules: Rule[] = [];
  for (const reference of references) {
    const imported = await import(resolveImport(reference, cwd));
    const exported = imported.default ?? imported.rules ?? imported.rule;
    if (Array.isArray(exported)) {
      rules.push(...exported);
    } else if (exported) {
      rules.push(exported);
    }
  }
  return rules;
}

export function normalizeConfig(config: Config | undefined): Config {
  const base: Config = {};
  for (const preset of asArray(config?.extends)) {
    Object.assign(base, mergeConfig(base, presetConfig(preset)));
  }
  return mergeConfig(base, config ?? {});
}

function mergeConfig(base: Config, override: Config): Config {
  return {
    extends: override.extends ?? base.extends,
    documents: [...(base.documents ?? []), ...(override.documents ?? [])],
    customRules: [...(base.customRules ?? []), ...(override.customRules ?? [])],
    ignores: [...(base.ignores ?? []), ...(override.ignores ?? [])],
    rules: {
      ...(base.rules ?? {}),
      ...(override.rules ?? {}),
    },
  };
}

function configSources(options: Required<Pick<ConfigLoadOptions, "cwd">> & ConfigLoadOptions): ConfigSource[] {
  const sources: ConfigSource[] = [];
  if (!options.noGlobalConfig) {
    const global = path.join(path.resolve(options.homeDir ?? os.homedir()), ".asciidoclint", "config.yaml");
    if (fs.existsSync(global)) {
      sources.push({ kind: "global", file: global });
    }
  }

  if (options.configFile) {
    const explicit = path.resolve(options.cwd, options.configFile);
    if (fs.existsSync(explicit)) {
      sources.push({ kind: "explicit", file: explicit });
    }
    return sources;
  }

  const project = findProjectConfig(options.cwd);
  if (project && !sources.some((source) => path.resolve(source.file) === path.resolve(project))) {
    sources.push({ kind: "project", file: project });
  }
  return sources;
}

function findProjectConfig(cwd: string): string | undefined {
  let directory = path.resolve(cwd);
  while (true) {
    const candidate = path.join(directory, ".asciidoclint", "config.yaml");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
}

function configFromFile(file: string): Config {
  const baseDir = configReferenceBaseDir(file);
  const loaded = normalizeConfig(yaml.load(fs.readFileSync(file, "utf8")) as Config);
  return {
    ...loaded,
    customRules: loaded.customRules?.map((reference) => resolveConfigReference(reference, baseDir)),
  };
}

function configReferenceBaseDir(file: string): string {
  const directory = path.dirname(file);
  if (path.basename(file) === "config.yaml" && path.basename(directory) === ".asciidoclint") {
    return path.dirname(directory);
  }
  return directory;
}

function resolveConfigReference(reference: string, baseDir: string): string {
  if (reference.startsWith(".") || reference.startsWith("/")) {
    return path.resolve(baseDir, reference);
  }
  return reference;
}

function presetConfig(name: string): Config {
  const rules: Record<string, RuleSetting> = {};
  const enableByTag = (tag: string) => {
    for (const rule of builtInRules) {
      rules[rule.id] = rule.tags.includes(tag);
    }
  };

  switch (name) {
    case "asciidoclint:all":
    case "asciidoclint:recommended":
      for (const rule of builtInRules) {
        rules[rule.id] = true;
      }
      return { rules };
    case "asciidoclint:core":
      enableByTag("core");
      return { rules };
    case "asciidoclint:dependencies":
      enableByTag("dependencies");
      return { rules };
    default:
      throw new Error(`Unknown config preset: ${name}`);
  }
}

function resolveImport(reference: string, cwd: string): string {
  if (!isLocalReference(reference)) {
    return reference;
  }

  const absolute = path.resolve(cwd, reference);
  if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
    return pathToFileURL(resolveRulePackageEntry(absolute)).href;
  }
  return pathToFileURL(absolute).href;
}

function isLocalReference(reference: string): boolean {
  return reference.startsWith(".") || reference.startsWith("/") || /\.(ts|mts|cts|m?js|cjs)$/.test(reference);
}

function resolveRulePackageEntry(directory: string): string {
  const packageJson = path.join(directory, "package.json");
  const packageEntry = fs.existsSync(packageJson) ? packageEntryFromJson(packageJson) : undefined;
  const candidates = [
    packageEntry && path.resolve(directory, packageEntry),
    path.join(directory, "dist", "index.js"),
    path.join(directory, "dist", "index.mjs"),
    path.join(directory, "src", "index.js"),
    path.join(directory, "src", "index.mjs"),
    path.join(directory, "src", "index.ts"),
    path.join(directory, "src", "index.mts"),
    path.join(directory, "index.js"),
    path.join(directory, "index.mjs"),
    path.join(directory, "index.ts"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const entry = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!entry) {
    throw new Error(`Custom rule package has no loadable entry: ${directory}`);
  }
  return entry;
}

function packageEntryFromJson(file: string): string | undefined {
  const packageJson = JSON.parse(fs.readFileSync(file, "utf8")) as {
    exports?: string | { ".": string | { import?: string; default?: string } };
    module?: string;
    main?: string;
  };
  if (typeof packageJson.exports === "string") {
    return packageJson.exports;
  }
  if (packageJson.exports && typeof packageJson.exports["."] === "string") {
    return packageJson.exports["."];
  }
  if (packageJson.exports && typeof packageJson.exports["."] === "object") {
    return packageJson.exports["."].import ?? packageJson.exports["."].default;
  }
  return packageJson.module ?? packageJson.main;
}

function asArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
