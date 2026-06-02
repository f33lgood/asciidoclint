import path from "node:path";
import fs from "node:fs";
import type { Diagnostic, DiagnosticCollection, TextDocument, WorkspaceFolder } from "vscode";
import type { LintFinding, LintOptions, LintResult } from "../../../dist/index.js";

export interface AsciidoclintApi {
  lintFiles(patterns: string[], options?: LintOptions): Promise<LintResult>;
  loadRules?(options?: { configFile?: string; customRules?: string[]; cwd?: string }): Promise<{ config?: { documents?: string[] }; rules: Array<{ id: string; alias?: string; description: string; tags: string[]; parser: string; docs?: { summary: string; rationale?: string; badExamples?: Array<{ code: string }>; goodExamples?: Array<{ code: string }>; fixability?: string } }> }>;
}

export interface ExtensionSettings {
  enable: boolean;
  run: "onSave" | "manual";
  config: string;
  customRules: string[];
  hiddenRules: string[];
  showWaived: boolean;
  unsafeFixes: boolean;
  importCliDiagnostics: boolean;
}

export type EditorTriggerEvent =
  | "workspace-open"
  | "document-open"
  | "document-focus"
  | "document-change"
  | "document-save"
  | "document-create"
  | "document-delete"
  | "document-rename"
  | "config-change"
  | "diagnostics-artifact-create"
  | "diagnostics-artifact-change"
  | "diagnostics-artifact-delete"
  | "manual-lint"
  | "manual-import"
  | "manual-clear"
  | "apply-fixes";

export interface EditorTriggerDecision {
  lint: boolean;
  traverseGraph: boolean;
  importDiagnostics: boolean;
  clearDiagnostics: boolean;
  reason: string;
}

export interface LintTarget {
  patterns: string[];
  cwd: string;
  configFile?: string;
  customRules: string[];
}

export interface WorkspaceEntryCandidate {
  pattern: string;
  label: string;
  description: string;
  source: "config" | "conventional" | "top-level";
}

export interface DiagnosticsArtifact extends LintResult {
  version?: number;
  source?: string;
  cwd?: string;
  generatedAt?: string;
  fingerprint?: DiagnosticsFingerprint;
}

export interface DiagnosticsFingerprint {
  tool?: {
    name: string;
    version: string;
  };
  command?: {
    targets: string[];
    configFile?: string;
  };
  files?: Array<{
    file: string;
    mtimeMs?: number;
    size?: number;
  }>;
}

export interface DocumentGraphEdge {
  from: string;
  to: string;
  target: string;
  exists: boolean;
}

export interface DocumentGraph {
  root: string;
  files: string[];
  roots: string[];
  edges: DocumentGraphEdge[];
  ownersByFile: Record<string, string[]>;
}

export function documentSelector(document: TextDocument): boolean {
  if (document.uri.scheme !== "file") {
    return false;
  }
  if (document.languageId === "asciidoc") {
    return true;
  }
  return /\.(?:adoc|asciidoc|asc)$/i.test(document.uri.fsPath);
}

export function isAsciiDocPath(file: string): boolean {
  return /\.(?:adoc|asciidoc|asc)$/i.test(file);
}

export function isConfigPath(file: string, workspaceRoot: string, settings: ExtensionSettings): boolean {
  return path.resolve(file) === path.resolve(resolveOptionalPath(settings.config, workspaceRoot) ?? path.join(workspaceRoot, ".asciidoclint/config.yaml"));
}

export function isDiagnosticsArtifactPath(file: string, workspaceRoot: string): boolean {
  return path.resolve(file) === path.resolve(path.join(workspaceRoot, ".asciidoclint", "diagnostics.json"));
}

export function decideEditorTrigger(event: EditorTriggerEvent, settings: ExtensionSettings, file?: string): EditorTriggerDecision {
  switch (event) {
    case "workspace-open":
      return { lint: false, traverseGraph: true, importDiagnostics: settings.importCliDiagnostics, clearDiagnostics: false, reason: "initialize graph and import existing CLI diagnostics" };
    case "document-open":
    case "document-focus":
    case "document-change":
      return { lint: false, traverseGraph: false, importDiagnostics: false, clearDiagnostics: false, reason: "navigation and unsaved edits do not run lint" };
    case "document-save":
      return {
        lint: settings.enable && settings.run === "onSave" && !!file && isAsciiDocPath(file),
        traverseGraph: !!file && isAsciiDocPath(file),
        importDiagnostics: false,
        clearDiagnostics: false,
        reason: "saved files may update the graph; AsciiDoc saves lint when onSave is enabled",
      };
    case "document-create":
    case "document-delete":
    case "document-rename":
      return { lint: false, traverseGraph: !!file && isAsciiDocPath(file), importDiagnostics: false, clearDiagnostics: false, reason: "file topology changed; graph should be refreshed without publishing lint diagnostics" };
    case "config-change":
      return { lint: false, traverseGraph: true, importDiagnostics: settings.importCliDiagnostics, clearDiagnostics: false, reason: "configuration can change graph roots, ignores, custom rules, and artifact fingerprint" };
    case "diagnostics-artifact-create":
    case "diagnostics-artifact-change":
      return { lint: false, traverseGraph: false, importDiagnostics: settings.importCliDiagnostics, clearDiagnostics: false, reason: "external CLI diagnostics changed" };
    case "diagnostics-artifact-delete":
      return { lint: false, traverseGraph: false, importDiagnostics: false, clearDiagnostics: true, reason: "external CLI diagnostics were removed" };
    case "manual-lint":
      return { lint: settings.enable, traverseGraph: true, importDiagnostics: false, clearDiagnostics: false, reason: "explicit lint command" };
    case "manual-import":
      return { lint: false, traverseGraph: false, importDiagnostics: settings.importCliDiagnostics, clearDiagnostics: false, reason: "explicit diagnostics import command" };
    case "manual-clear":
      return { lint: false, traverseGraph: false, importDiagnostics: false, clearDiagnostics: true, reason: "explicit diagnostics clear command" };
    case "apply-fixes":
      return { lint: settings.enable, traverseGraph: true, importDiagnostics: false, clearDiagnostics: false, reason: "fixing rewrites files and refreshes lint results" };
  }
}

export function buildDocumentGraph(root: string, explicitDocuments: string[] = []): DocumentGraph {
  const workspaceRoot = path.resolve(root);
  const files = listAsciiDocFiles(workspaceRoot);
  const fileSet = new Set(files);
  const edges: DocumentGraphEdge[] = [];
  const included = new Set<string>();
  const levelZeroFiles = new Set<string>();

  for (const file of files) {
    const source = safeReadFile(file);
    if (/^=\s+\S/m.test(source)) {
      levelZeroFiles.add(file);
    }
    for (const includeTarget of includeTargets(source)) {
      const resolved = path.resolve(path.dirname(file), includeTarget);
      const exists = fileSet.has(resolved) || fs.existsSync(resolved);
      edges.push({ from: file, to: resolved, target: includeTarget, exists });
      if (exists && isAsciiDocPath(resolved)) {
        included.add(resolved);
      }
    }
  }

  const explicitRoots = explicitDocuments.map((document) => path.resolve(workspaceRoot, document)).filter((file) => fileSet.has(file));
  const discoveredRoots = files.filter((file) => !included.has(file) || levelZeroFiles.has(file));
  const roots = uniquePaths(explicitRoots.length ? explicitRoots : discoveredRoots);
  const ownersByFile = ownersForRoots(roots, edges);

  return {
    root: workspaceRoot,
    files,
    roots,
    edges,
    ownersByFile,
  };
}

export function targetForDocument(document: TextDocument, workspaceFolder: WorkspaceFolder | undefined, settings: ExtensionSettings): LintTarget {
  const cwd = workspaceFolder?.uri.fsPath ?? path.dirname(document.uri.fsPath);
  return {
    patterns: [document.uri.fsPath],
    cwd,
    configFile: resolveOptionalPath(settings.config, cwd),
    customRules: settings.customRules.map((rule) => resolveMaybePath(rule, cwd)),
  };
}

export function targetForWorkspace(workspaceFolder: WorkspaceFolder, settings: ExtensionSettings): LintTarget {
  const root = workspaceFolder.uri.fsPath;
  return {
    patterns: workspaceEntryPatterns(root).map((candidate) => candidate.pattern),
    cwd: root,
    configFile: resolveOptionalPath(settings.config, root),
    customRules: settings.customRules.map((rule) => resolveMaybePath(rule, root)),
  };
}

export function targetForWorkspaceEntries(workspaceFolder: WorkspaceFolder, settings: ExtensionSettings, patterns: string[]): LintTarget {
  const root = workspaceFolder.uri.fsPath;
  return {
    patterns,
    cwd: root,
    configFile: resolveOptionalPath(settings.config, root),
    customRules: settings.customRules.map((rule) => resolveMaybePath(rule, root)),
  };
}

export function targetForFullWorkspace(workspaceFolder: WorkspaceFolder, settings: ExtensionSettings): LintTarget {
  const root = workspaceFolder.uri.fsPath;
  return {
    patterns: ["**/*.{adoc,asciidoc,asc}"],
    cwd: root,
    configFile: resolveOptionalPath(settings.config, root),
    customRules: settings.customRules.map((rule) => resolveMaybePath(rule, root)),
  };
}

export async function runLint(api: AsciidoclintApi, target: LintTarget, fix = false, unsafeFixes = false, outputDiagnosticsFile?: string): Promise<LintResult> {
  return api.lintFiles(target.patterns, {
    cwd: target.cwd,
    configFile: target.configFile,
    customRules: target.customRules,
    fix,
    unsafeFixes,
    outputDiagnosticsFile,
  });
}

type VscodeDiagnosticApi = Pick<typeof import("vscode"), "Diagnostic" | "DiagnosticRelatedInformation" | "DiagnosticSeverity" | "DiagnosticTag" | "Location" | "Position" | "Range" | "Uri">;

export function updateDiagnostics(collection: DiagnosticCollection, vscodeApi: VscodeDiagnosticApi, findings: LintFinding[]): void {
  publishDiagnostics(collection, vscodeApi, findings, { clear: true });
}

export function filterEditorFindings(findings: LintFinding[], hiddenRules: string[], showWaived = false): LintFinding[] {
  const activeFindings = findings.filter((finding) => showWaived || !finding.waived);
  if (!hiddenRules.length) {
    return activeFindings;
  }
  const hidden = new Set(hiddenRules.map((rule) => rule.toLowerCase()));
  return activeFindings.filter((finding) => !hidden.has(finding.ruleId.toLowerCase()) && !(finding.alias && hidden.has(finding.alias.toLowerCase())));
}

export function filterFindingsInsideWorkspace(findings: LintFinding[], workspaceFolder: WorkspaceFolder): LintFinding[] {
  const root = path.resolve(workspaceFolder.uri.fsPath);
  return findings.filter((finding) => isInsideOrEqual(path.resolve(finding.range.start.file), root));
}

export function replaceAllDiagnostics(collection: DiagnosticCollection, vscodeApi: VscodeDiagnosticApi, findings: LintFinding[]): void {
  publishDiagnostics(collection, vscodeApi, findings, { clear: true });
}

export function updateDiagnosticsForFiles(
  collection: DiagnosticCollection,
  vscodeApi: VscodeDiagnosticApi,
  files: string[],
  findings: LintFinding[],
): void {
  publishDiagnostics(collection, vscodeApi, findings, { scopeFiles: files });
}

interface DiagnosticPublishOptions {
  clear?: boolean;
  scopeFiles?: string[];
}

function publishDiagnostics(
  collection: DiagnosticCollection,
  vscodeApi: VscodeDiagnosticApi,
  findings: LintFinding[],
  options: DiagnosticPublishOptions = {},
): void {
  const byFile = groupDiagnosticsByFile(vscodeApi, findings, options.scopeFiles);
  if (options.clear) {
    collection.clear();
  }
  for (const [file, diagnostics] of byFile) {
    collection.set(vscodeApi.Uri.file(file), diagnostics);
  }
}

function groupDiagnosticsByFile(
  vscodeApi: VscodeDiagnosticApi,
  findings: LintFinding[],
  scopeFiles: string[] = [],
): Map<string, Diagnostic[]> {
  const byFile = new Map<string, Diagnostic[]>();
  for (const file of scopeFiles) {
    byFile.set(path.resolve(file), []);
  }
  for (const finding of findings) {
    const file = path.resolve(finding.range.start.file);
    const diagnostics = byFile.get(file) ?? [];
    diagnostics.push(toDiagnostic(vscodeApi, finding));
    byFile.set(file, diagnostics);
  }
  return byFile;
}

export function readDiagnosticsArtifact(file: string): DiagnosticsArtifact {
  return JSON.parse(fs.readFileSync(file, "utf8")) as DiagnosticsArtifact;
}

export function diagnosticsArtifactPath(workspaceFolder: WorkspaceFolder): string {
  return path.join(workspaceFolder.uri.fsPath, ".asciidoclint", "diagnostics.json");
}

export function artifactBelongsToWorkspace(artifact: DiagnosticsArtifact, workspaceFolder: WorkspaceFolder): boolean {
  return artifactWorkspaceMismatchReasons(artifact, workspaceFolder).length === 0;
}

export function artifactWorkspaceMismatchReasons(artifact: DiagnosticsArtifact, workspaceFolder: WorkspaceFolder): string[] {
  const root = path.resolve(workspaceFolder.uri.fsPath);
  const reasons: string[] = [];
  for (const finding of artifact.findings) {
    if (!isInsideOrEqual(path.resolve(finding.range.start.file), root)) {
      reasons.push(`finding outside workspace: ${finding.range.start.file}`);
      break;
    }
  }
  for (const file of artifact.fingerprint?.files ?? []) {
    if (!isInsideOrEqual(path.resolve(file.file), root)) {
      reasons.push(`fingerprint file outside workspace: ${file.file}`);
      break;
    }
  }
  return reasons;
}

export function staleArtifactReasons(artifact: DiagnosticsArtifact): string[] {
  const reasons: string[] = [];
  for (const file of artifact.fingerprint?.files ?? []) {
    if (!fs.existsSync(file.file)) {
      reasons.push(`missing ${file.file}`);
      continue;
    }
    const stat = fs.statSync(file.file);
    if (file.mtimeMs !== undefined && stat.mtimeMs !== file.mtimeMs) {
      reasons.push(`modified ${file.file}`);
      continue;
    }
    if (file.size !== undefined && stat.size !== file.size) {
      reasons.push(`resized ${file.file}`);
    }
  }
  return reasons;
}

export function toDiagnostic(vscodeApi: VscodeDiagnosticApi, finding: LintFinding): Diagnostic {
  const start = new vscodeApi.Position(Math.max(0, finding.range.start.line - 1), Math.max(0, finding.range.start.column - 1));
  const end = finding.range.end
    ? new vscodeApi.Position(Math.max(0, finding.range.end.line - 1), Math.max(0, finding.range.end.column - 1))
    : new vscodeApi.Position(start.line, start.character + 1);
  const messagePrefix = finding.waived ? "[WAIVED] " : "";
  const diagnostic = new vscodeApi.Diagnostic(
    new vscodeApi.Range(start, end),
    [`${messagePrefix}${ruleLabel(finding)} ${finding.message}`, finding.fixHelper ? `Fix helper: ${finding.fixHelper}` : undefined].filter(Boolean).join("\n"),
    finding.waived ? vscodeApi.DiagnosticSeverity.Information : toDiagnosticSeverity(vscodeApi, finding.severity),
  );
  diagnostic.source = "asciidoclint";
  diagnostic.code = finding.alias ? `${finding.ruleId}/${finding.alias}` : finding.ruleId;
  if (finding.waived && finding.waiver) {
    diagnostic.tags = [vscodeApi.DiagnosticTag.Unnecessary];
    const waiverStart = new vscodeApi.Position(Math.max(0, finding.waiver.line - 1), Math.max(0, finding.waiver.column - 1));
    const waiverRange = new vscodeApi.Range(waiverStart, new vscodeApi.Position(waiverStart.line, waiverStart.character + 1));
    diagnostic.relatedInformation = [
      new vscodeApi.DiagnosticRelatedInformation(
        new vscodeApi.Location(vscodeApi.Uri.file(finding.waiver.file), waiverRange),
        `Waived by ${finding.waiver.directive}${finding.waiver.reason ? `: ${finding.waiver.reason}` : ""}`,
      ),
    ];
  }
  return diagnostic;
}

function ruleLabel(finding: LintFinding): string {
  return finding.alias ? `${finding.ruleId}/${finding.alias}` : finding.ruleId;
}

export function toDiagnosticSeverity(vscodeApi: Pick<typeof import("vscode"), "DiagnosticSeverity">, severity: LintFinding["severity"]): import("vscode").DiagnosticSeverity {
  switch (severity) {
    case "error":
      return vscodeApi.DiagnosticSeverity.Error;
    case "info":
      return vscodeApi.DiagnosticSeverity.Information;
    default:
      return vscodeApi.DiagnosticSeverity.Warning;
  }
}

function resolveOptionalPath(value: string, cwd: string): string | undefined {
  if (!value.trim()) {
    return undefined;
  }
  return path.isAbsolute(value) ? value : path.join(cwd, value);
}

function resolveMaybePath(value: string, cwd: string): string {
  if (value.startsWith(".") || value.startsWith("/") || value.includes(path.sep)) {
    return path.isAbsolute(value) ? value : path.join(cwd, value);
  }
  return value;
}

export function workspaceEntryPatterns(root: string, explicitDocuments: string[] = []): WorkspaceEntryCandidate[] {
  const configured = explicitDocuments
    .map((document) => document.trim())
    .filter(Boolean)
    .filter((document) => fs.existsSync(path.resolve(root, document)))
    .map((document) => ({
      pattern: document,
      label: document,
      description: "configured document root",
      source: "config" as const,
    }));
  if (configured.length) {
    return configured;
  }

  for (const candidate of ["index.adoc", "master.adoc", "README.adoc", "readme.adoc"]) {
    if (fs.existsSync(path.join(root, candidate))) {
      return [{
        pattern: candidate,
        label: candidate,
        description: "conventional document root",
        source: "conventional",
      }];
    }
  }
  return listTopLevelAsciiDocFiles(root).map((file) => {
    const relative = path.relative(root, file).split(path.sep).join("/");
    return {
      pattern: relative,
      label: relative,
      description: "top-level AsciiDoc file",
      source: "top-level",
    };
  });
}

function listAsciiDocFiles(root: string): string[] {
  const files: string[] = [];
  const ignoredDirectories = new Set([".git", ".asciidoclint", "node_modules", "dist", "build", "output", "vendor"]);
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) {
        continue;
      }
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          visit(fullPath);
        }
        continue;
      }
      if (entry.isFile() && isAsciiDocPath(fullPath)) {
        files.push(path.resolve(fullPath));
      }
    }
  };
  if (fs.existsSync(root)) {
    visit(root);
  }
  return files.sort();
}

function listTopLevelAsciiDocFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isAsciiDocPath(entry.name))
    .map((entry) => path.join(root, entry.name))
    .sort((a, b) => scoreTopLevelAsciiDocFile(b) - scoreTopLevelAsciiDocFile(a) || a.localeCompare(b));
}

function scoreTopLevelAsciiDocFile(file: string): number {
  const basename = path.basename(file).toLowerCase();
  let score = 0;
  if (/\b(?:ias|mas|spec|guide|manual)\b|(?:^|[_-])(?:ias|mas)(?:[_-]|\.|$)/.test(basename)) {
    score += 10;
  }
  if (/^(?:index|master|readme)\./.test(basename)) {
    score += 20;
  }
  if (/^(?:br_|fd_|chapter|section)/.test(basename)) {
    score -= 2;
  }
  return score;
}

function includeTargets(source: string): string[] {
  const targets: string[] = [];
  for (const line of source.split(/\r?\n/)) {
    const match = /^include::([^\[]+)\[[^\]]*]\s*$/.exec(line.trim());
    if (!match || /^[a-z][a-z0-9+.-]*:/i.test(match[1]) || match[1].includes("{")) {
      continue;
    }
    targets.push(match[1]);
  }
  return targets;
}

function ownersForRoots(roots: string[], edges: DocumentGraphEdge[]): Record<string, string[]> {
  const childrenByFile = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.exists && isAsciiDocPath(edge.to)) {
      const children = childrenByFile.get(edge.from) ?? [];
      children.push(edge.to);
      childrenByFile.set(edge.from, children);
    }
  }
  const owners = new Map<string, Set<string>>();
  for (const root of roots) {
    const stack = [root];
    const seen = new Set<string>();
    while (stack.length) {
      const file = stack.pop();
      if (!file || seen.has(file)) {
        continue;
      }
      seen.add(file);
      const rootOwners = owners.get(file) ?? new Set<string>();
      rootOwners.add(root);
      owners.set(file, rootOwners);
      stack.push(...(childrenByFile.get(file) ?? []));
    }
  }
  return Object.fromEntries([...owners.entries()].map(([file, rootSet]) => [file, [...rootSet].sort()]));
}

function uniquePaths(files: string[]): string[] {
  return [...new Set(files.map((file) => path.resolve(file)))].sort();
}

function safeReadFile(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function isInsideOrEqual(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}
