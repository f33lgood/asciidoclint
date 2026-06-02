import path from "node:path";
import { waiverRuleDefinitions, type WaiverRuleId } from "../rules/waiverRule.js";
import type { LintFinding, ParsedFile, Severity, WaiverRecord } from "../types.js";

interface WaiverDirective extends WaiverRecord {
  activeRules: string[];
}

interface ActiveBlock extends WaiverDirective {
  startLine: number;
}

const DIRECTIVE_RE = /^\s*\/\/\s*asciidoclint(?:\s+(.*))?$/;
const VALID_RULE_ID_RE = /^[A-Z]{2,}\d{2,}$/;
const WAIVER_RULE_ID_RE = /^ADW\d{2}$/;

export function applyWaivers(findings: LintFinding[], files: ParsedFile[], knownRuleIds: Set<string>): LintFinding[] {
  const waiverDirectives: WaiverDirective[] = [];
  const waiverDiagnostics: LintFinding[] = [];

  for (const file of uniqueFiles(files)) {
    const { directives, diagnostics } = parseWaivers(file, knownRuleIds);
    waiverDirectives.push(...directives);
    waiverDiagnostics.push(...diagnostics);
  }

  const annotated = findings.map((finding) => applyWaiverToFinding(finding, waiverDirectives));
  return [...annotated, ...waiverDiagnostics];
}

function parseWaivers(file: ParsedFile, knownRuleIds: Set<string>): { directives: WaiverDirective[]; diagnostics: LintFinding[] } {
  const directives: WaiverDirective[] = [];
  const diagnostics: LintFinding[] = [];
  const activeBlocks: ActiveBlock[] = [];

  for (const [index, line] of file.lines.entries()) {
    const lineNumber = index + 1;
    const match = DIRECTIVE_RE.exec(line);
    if (!match) {
      continue;
    }

    const column = line.indexOf("//") + 1;
    const body = (match[1] ?? "").trim();
    const [directiveName, rest = ""] = splitDirective(body);
    if (!isKnownDirective(directiveName)) {
      diagnostics.push(waiverDiagnostic("ADW01", file.file, lineNumber, column));
      continue;
    }

    const { ruleText, reason } = splitReason(rest);
    const ruleList = parseRuleList(ruleText);
    if (ruleList.kind === "missing") {
      diagnostics.push(waiverDiagnostic("ADW02", file.file, lineNumber, column));
      continue;
    }
    if (ruleList.kind === "malformed") {
      diagnostics.push(waiverDiagnostic("ADW03", file.file, lineNumber, column));
      continue;
    }

    const validRules: string[] = [];
    for (const ruleId of ruleList.rules) {
      if (WAIVER_RULE_ID_RE.test(ruleId)) {
        diagnostics.push(waiverDiagnostic("ADW08", file.file, lineNumber, column));
        continue;
      }
      if (!knownRuleIds.has(ruleId)) {
        diagnostics.push(waiverDiagnostic("ADW04", file.file, lineNumber, column, `: ${ruleId}`));
        continue;
      }
      validRules.push(ruleId);
    }

    if (!validRules.length) {
      continue;
    }

    if (directiveName === "disable-next-line") {
      directives.push({
        file: file.file,
        line: lineNumber,
        column,
        directive: "disable-next-line",
        rules: ruleList.rules,
        activeRules: validRules,
        reason,
      });
      continue;
    }

    if (directiveName === "disable-block") {
      activeBlocks.push({
        file: file.file,
        line: lineNumber,
        column,
        directive: "disable-block",
        rules: ruleList.rules,
        activeRules: validRules,
        reason,
        startLine: lineNumber + 1,
      });
      continue;
    }

    const active = activeBlocks.pop();
    if (!active) {
      diagnostics.push(waiverDiagnostic("ADW05", file.file, lineNumber, column));
      continue;
    }
    if (!sameRuleSet(active.activeRules, validRules)) {
      diagnostics.push(waiverDiagnostic("ADW07", file.file, lineNumber, column));
    }
    directives.push({
      ...active,
      line: active.line,
      column: active.column,
      directive: "disable-block",
    });
    (directives[directives.length - 1] as WaiverDirective & { endLine?: number }).endLine = lineNumber - 1;
  }

  for (const active of activeBlocks) {
    diagnostics.push(waiverDiagnostic("ADW06", file.file, active.line, active.column));
    directives.push(active);
  }

  return { directives, diagnostics };
}

function applyWaiverToFinding(finding: LintFinding, directives: WaiverDirective[]): LintFinding {
  if (WAIVER_RULE_ID_RE.test(finding.ruleId)) {
    return finding;
  }
  const waiver = directives.find((directive) => coversFinding(directive, finding));
  if (!waiver) {
    return finding;
  }
  const record: WaiverRecord = {
    file: waiver.file,
    line: waiver.line,
    column: waiver.column,
    directive: waiver.directive,
    rules: waiver.rules,
    ...(waiver.reason ? { reason: waiver.reason } : {}),
  };
  return {
    ...finding,
    waived: true,
    waiver: record,
  };
}

function coversFinding(directive: WaiverDirective & { endLine?: number }, finding: LintFinding): boolean {
  if (path.resolve(directive.file) !== path.resolve(finding.range.start.file)) {
    return false;
  }
  if (!directive.activeRules.includes(finding.ruleId)) {
    return false;
  }
  if (directive.directive === "disable-next-line") {
    return finding.range.start.line === directive.line + 1;
  }
  const startLine = directive.line + 1;
  const endLine = directive.endLine ?? Number.POSITIVE_INFINITY;
  return finding.range.start.line >= startLine && finding.range.start.line <= endLine;
}

function splitDirective(body: string): [string, string?] {
  const [name = "", ...rest] = body.split(/\s+/);
  return [name, rest.join(" ")];
}

function isKnownDirective(value: string): value is "disable-next-line" | "disable-block" | "enable-block" {
  return value === "disable-next-line" || value === "disable-block" || value === "enable-block";
}

function splitReason(value: string): { ruleText: string; reason?: string } {
  const marker = value.indexOf("--");
  if (marker === -1) {
    return { ruleText: value.trim() };
  }
  const reason = value.slice(marker + 2).trim();
  return {
    ruleText: value.slice(0, marker).trim(),
    ...(reason ? { reason } : {}),
  };
}

function parseRuleList(value: string): { kind: "ok"; rules: string[] } | { kind: "missing" } | { kind: "malformed" } {
  if (!value.trim()) {
    return { kind: "missing" };
  }
  const parts = value.split(",").map((part) => part.trim());
  if (parts.some((part) => part === "") || parts.some((part) => !VALID_RULE_ID_RE.test(part))) {
    return { kind: "malformed" };
  }
  return { kind: "ok", rules: parts };
}

function sameRuleSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function waiverDiagnostic(ruleId: WaiverRuleId, file: string, line: number, column: number, messageSuffix = ""): LintFinding {
  const definition = waiverRuleDefinitions[ruleId];
  return {
    ruleId,
    alias: definition.alias,
    severity: "warning" satisfies Severity,
    message: `${definition.message}${messageSuffix}`,
    range: {
      start: { file, line, column },
    },
  };
}

function uniqueFiles(files: ParsedFile[]): ParsedFile[] {
  const byFile = new Map<string, ParsedFile>();
  for (const file of files) {
    byFile.set(path.resolve(file.file), file);
  }
  return [...byFile.values()];
}
