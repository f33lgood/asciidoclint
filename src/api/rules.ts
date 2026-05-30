import fs from "node:fs";
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
  editor?: EditorConfig;
  baseDir?: string;
}

export type RuleSetting = boolean | { severity?: "error" | "warning" | "info"; enabled?: boolean };

export interface EditorConfig {
  defaultScope?: "file" | "document" | "workspace";
  lintOnSave?: boolean;
  followSymlinks?: boolean;
  importCliDiagnostics?: boolean;
}

export interface RuleLoadOptions {
  configFile?: string;
  customRules?: string[];
  cwd?: string;
}

export async function loadRules(options: RuleLoadOptions = {}): Promise<{ config: Config; rules: Rule[] }> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const config = loadConfig(options.configFile, cwd);
  const customRules = [
    ...await loadCustomRules(config.customRules ?? [], config.baseDir ?? cwd),
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

export function loadConfig(configFile: string | undefined, cwd: string): Config {
  const candidates = configFile ? [configFile] : [".asciidoclint.yaml", ".asciidoclint.yml"];
  for (const candidate of candidates) {
    const absolute = path.resolve(cwd, candidate);
    if (fs.existsSync(absolute)) {
      return {
        ...normalizeConfig(yaml.load(fs.readFileSync(absolute, "utf8")) as Config),
        baseDir: path.dirname(absolute),
      };
    }
  }
  return {};
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
    baseDir: override.baseDir ?? base.baseDir,
    documents: [...(base.documents ?? []), ...(override.documents ?? [])],
    customRules: [...(base.customRules ?? []), ...(override.customRules ?? [])],
    ignores: [...(base.ignores ?? []), ...(override.ignores ?? [])],
    editor: {
      ...(base.editor ?? {}),
      ...(override.editor ?? {}),
    },
    rules: {
      ...(base.rules ?? {}),
      ...(override.rules ?? {}),
    },
  };
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
  if (reference.startsWith(".") || reference.startsWith("/") || /\.(ts|mts|cts|m?js|cjs)$/.test(reference)) {
    return pathToFileURL(path.resolve(cwd, reference)).href;
  }
  return reference;
}

function asArray(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
