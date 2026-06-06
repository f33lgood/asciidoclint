import path from "node:path";
import fs from "node:fs";
import fg from "fast-glob";
import { parseDocument, resolveDocumentXrefs } from "../parsers/tolerant.js";
import { helpers } from "../rules/helpers.js";
import type { BlockNode, LintFinding, LintOptions, LintResult, NormalizedDocument, ReferenceTarget, Rule, SectionNode } from "../types.js";
import { getVersion } from "../version.js";
import { applyFixes } from "./fixes.js";
import { loadRules, type Config } from "./rules.js";
import { applyWaivers } from "./waivers.js";

export async function lintFiles(patterns: string[], options: LintOptions = {}): Promise<LintResult> {
  return lintFilesInternal(patterns, options, false);
}

async function lintFilesInternal(patterns: string[], options: LintOptions, afterFix: boolean): Promise<LintResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const { config, rules } = await loadRules(options);
  const files = await expandFiles(patterns, cwd, config);
  const enabledRules = filterEnabledRules(rules, config);
  const knownRuleIds = new Set(["AD000", ...rules.map((rule) => rule.id)]);
  const findings: LintFinding[] = [];
  const parsedFiles = new Map<string, NormalizedDocument["files"][number]>();

  for (const file of files) {
    const document = parseDocument(file);
    for (const parsedFile of document.files) {
      parsedFiles.set(path.resolve(parsedFile.file), parsedFile);
    }
    mergeAsciidoctorSections(document, await collectParserSections(file));
    mergeAsciidoctorBlocks(document, await collectParserBlocks(file));
    mergeAsciidoctorReferenceTargets(document, await collectParserReferenceTargets(file));
    resolveDocumentXrefs(document);
    const parserDiagnostics = options.parserDiagnostics === false ? [] : await collectParserDiagnostics(file);
    findings.push(...parserDiagnostics);

    for (const rule of enabledRules) {
      await rule.function(
        {
          file: document.file,
          lines: document.lines,
          document,
          dependencies: document.dependencies,
          parserDiagnostics,
          config: config.rules?.[rule.id] ?? (rule.alias ? config.rules?.[rule.alias] : undefined),
          version: getVersion(),
          helpers,
        },
        (finding) => {
          const configuredSeverity = getConfiguredSeverity(rule, config);
          const fixHelper = finding.fixHelper ?? rule.docs?.fixHelper;
          findings.push({
            ...finding,
            ruleId: finding.ruleId ?? rule.id,
            alias: finding.alias ?? rule.alias,
            severity: configuredSeverity ?? finding.severity,
            fixHelper,
          });
        },
      );
    }
  }

  const result = { files, findings: sortFindings(applyWaivers(findings, [...parsedFiles.values()], knownRuleIds)) };
  if (options.fix && !afterFix) {
    applyFixes(result.findings, options.unsafeFixes ?? false);
    return lintFilesInternal(patterns, { ...options, fix: false }, true);
  }
  if (options.outputDiagnosticsFile) {
    writeDiagnosticsFile(result, options.outputDiagnosticsFile, cwd, patterns, options.configFile);
  }
  return result;
}

async function collectParserDiagnostics(file: string): Promise<LintFinding[]> {
  const { collectAsciidoctorDiagnostics } = await import("../parsers/asciidoctor.js");
  return collectAsciidoctorDiagnostics(file);
}

async function collectParserBlocks(file: string): Promise<BlockNode[]> {
  const { collectAsciidoctorBlocks } = await import("../parsers/asciidoctor.js");
  return collectAsciidoctorBlocks(file);
}

async function collectParserSections(file: string): Promise<SectionNode[]> {
  const { collectAsciidoctorSections } = await import("../parsers/asciidoctor.js");
  return collectAsciidoctorSections(file);
}

async function collectParserReferenceTargets(file: string): Promise<ReferenceTarget[]> {
  const { collectAsciidoctorReferenceTargets } = await import("../parsers/asciidoctor.js");
  return collectAsciidoctorReferenceTargets(file);
}

function mergeAsciidoctorSections(document: NormalizedDocument, sections: SectionNode[]): void {
  if (!sections.length) {
    return;
  }
  for (const section of sections) {
    const existing = document.sections.find((candidate) => (
      path.resolve(candidate.range.start.file) === path.resolve(section.range.start.file)
      && candidate.range.start.line === section.range.start.line
      && candidate.title === section.title
    ));
    if (!existing) {
      continue;
    }
    existing.sectname = section.sectname;
    existing.source = "asciidoctor";
    if (!existing.style && section.style) {
      existing.style = section.style;
    }
  }
}

function mergeAsciidoctorBlocks(document: NormalizedDocument, blocks: BlockNode[]): void {
  if (!blocks.length) {
    return;
  }
  const authoritativeTypes = new Set(blocks
    .filter((block) => ["table", "image", "diagram"].includes(block.type))
    .map((block) => block.type));
  const authoritativeFiles = new Set(blocks.map((block) => path.resolve(block.range.start.file)));
  const merged = [
    ...document.blocks.filter((block) => (
      !authoritativeTypes.has(block.type)
      || !authoritativeFiles.has(path.resolve(block.range.start.file))
    )),
  ];
  for (const block of blocks) {
    if (!merged.some((candidate) => sameBlock(candidate, block))) {
      merged.push(block);
    }
  }
  document.blocks = merged.sort((a, b) => (
    a.range.start.file.localeCompare(b.range.start.file)
    || a.range.start.line - b.range.start.line
    || a.range.start.column - b.range.start.column
  ));
}

function sameBlock(a: BlockNode, b: BlockNode): boolean {
  return path.resolve(a.range.start.file) === path.resolve(b.range.start.file)
    && a.range.start.line === b.range.start.line
    && a.range.start.column === b.range.start.column
    && a.type === b.type
    && a.style === b.style;
}

function mergeAsciidoctorReferenceTargets(document: NormalizedDocument, targets: ReferenceTarget[]): void {
  const byKey = new Map<string, ReferenceTarget>();
  for (const target of document.referenceTargets) {
    byKey.set(referenceTargetKey(target), target);
  }
  for (const target of targets) {
    byKey.set(referenceTargetKey(target), target);
  }
  document.referenceTargets = [...byKey.values()].sort((a, b) => (
    a.file.localeCompare(b.file) || a.id.localeCompare(b.id)
  ));
}

function referenceTargetKey(target: ReferenceTarget): string {
  return `${path.resolve(target.file)}#${target.id}`;
}

async function expandFiles(patterns: string[], cwd: string, config: Config): Promise<string[]> {
  const matches = await fg(patterns.length ? patterns : ["**/*.adoc"], {
    cwd,
    absolute: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: ["node_modules/**", "dist/**", ...(config.ignores ?? [])],
  });
  return [...new Set(matches)]
    .filter((file) => !isIgnored(path.relative(cwd, file), config.ignores ?? []))
    .sort();
}

function isIgnored(relativePath: string, ignores: string[]): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  return ignores.some((pattern) => matchesIgnorePattern(normalized, pattern));
}

function matchesIgnorePattern(file: string, pattern: string): boolean {
  const normalized = pattern.split(path.sep).join("/");
  if (normalized.endsWith("/**")) {
    return file.startsWith(normalized.slice(0, -3));
  }
  if (normalized.startsWith("**/")) {
    return file.endsWith(normalized.slice(3));
  }
  if (normalized.includes("*")) {
    const regex = new RegExp(`^${normalized.split("*").map(escapeRegex).join(".*")}$`);
    return regex.test(file);
  }
  return file === normalized || file.startsWith(`${normalized}/`);
}

function escapeRegex(value: string): string {
  return value.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
}

function filterEnabledRules(rules: Rule[], config: Config): Rule[] {
  if (!config.rules) {
    return rules;
  }
  return rules.filter((rule) => {
    const byId = config.rules?.[rule.id];
    const byAlias = rule.alias ? config.rules?.[rule.alias] : undefined;
    const setting = byId ?? byAlias;
    if (setting === false) {
      return false;
    }
    if (typeof setting === "object" && setting.enabled === false) {
      return false;
    }
    return true;
  });
}

function getConfiguredSeverity(rule: Rule, config: Config): "error" | "warning" | "info" | undefined {
  const setting = config.rules?.[rule.id] ?? (rule.alias ? config.rules?.[rule.alias] : undefined);
  if (!setting || typeof setting === "boolean") {
    return undefined;
  }
  return setting.severity;
}

function sortFindings(findings: LintFinding[]): LintFinding[] {
  return findings.sort((a, b) => {
    const file = a.range.start.file.localeCompare(b.range.start.file);
    if (file !== 0) {
      return file;
    }
    return a.range.start.line - b.range.start.line || a.range.start.column - b.range.start.column || a.ruleId.localeCompare(b.ruleId);
  });
}

function writeDiagnosticsFile(result: LintResult, outputFile: string, cwd: string, targets: string[], configFile?: string): void {
  const absolute = path.resolve(cwd, outputFile);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify({
    version: 1,
    source: "asciidoclint",
    cwd,
    generatedAt: new Date().toISOString(),
    fingerprint: {
      tool: {
        name: "asciidoclint",
        version: getVersion(),
      },
      command: {
        targets,
        configFile,
      },
      files: result.files.map((file) => {
        const stat = fs.statSync(file);
        return {
          file,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
        };
      }),
    },
    ...result,
  }, null, 2)}\n`);
}
