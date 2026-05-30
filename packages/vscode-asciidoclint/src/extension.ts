import fs from "node:fs";
import * as vscode from "vscode";
import type { AsciidoclintApi, ExtensionSettings } from "./linting";
import {
  artifactBelongsToWorkspace,
  artifactWorkspaceMismatchReasons,
  buildDocumentGraph,
  decideEditorTrigger,
  diagnosticsArtifactPath,
  documentSelector,
  filterFindingsInsideWorkspace,
  filterEditorFindings,
  isAsciiDocPath,
  isConfigPath,
  readDiagnosticsArtifact,
  runLint,
  staleArtifactReasons,
  targetForDocument,
  targetForWorkspaceEntries,
  targetForWorkspace,
  updateDiagnosticsForFiles,
  updateDiagnostics,
  workspaceEntryPatterns,
} from "./linting";

let diagnostics: vscode.DiagnosticCollection;
let output: vscode.OutputChannel;
let apiPromise: Promise<AsciidoclintApi> | undefined;
let activeRunId = 0;
let artifactWatchers: vscode.FileSystemWatcher[] = [];
let graphWatchers: vscode.FileSystemWatcher[] = [];
const documentGraphs = new Map<string, ReturnType<typeof buildDocumentGraph>>();
const lintFingerprints = new Map<string, string>();

export function activate(context: vscode.ExtensionContext): void {
  diagnostics = vscode.languages.createDiagnosticCollection("asciidoclint");
  output = vscode.window.createOutputChannel("asciidoclint");
  context.subscriptions.push(diagnostics, output);

  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
    const settings = getSettings();
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    const event = folder && isConfigPath(document.uri.fsPath, folder.uri.fsPath, settings) ? "config-change" : "document-save";
    const decision = decideEditorTrigger(event, settings, document.uri.fsPath);
    if (folder && decision.traverseGraph) {
      rebuildDocumentGraph(folder, decision.reason);
    }
    if (decision.lint && documentSelector(document)) {
      void lintDocumentIfChanged(document, decision.reason);
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("asciidoclint")) {
      const settings = getSettings();
      const decision = decideEditorTrigger("config-change", settings);
      if (decision.traverseGraph) {
        rebuildAllDocumentGraphs(decision.reason);
      }
      if (decision.importDiagnostics) {
        void importCliDiagnostics();
      }
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand("asciidoclint.lintWorkspace", lintWorkspace));
  context.subscriptions.push(vscode.commands.registerCommand("asciidoclint.rebuildDocumentGraph", () => {
    rebuildAllDocumentGraphs("manual graph rebuild");
    void vscode.window.setStatusBarMessage("asciidoclint: document graph rebuilt", 5000);
  }));
  context.subscriptions.push(vscode.commands.registerCommand("asciidoclint.cancel", cancelLint));
  context.subscriptions.push(vscode.commands.registerCommand("asciidoclint.importCliDiagnostics", importCliDiagnostics));
  context.subscriptions.push(vscode.commands.registerCommand("asciidoclint.clearDiagnostics", clearDiagnostics));
  context.subscriptions.push(vscode.commands.registerCommand("asciidoclint.fixWorkspaceSafe", fixWorkspaceSafe));

  rebuildAllDocumentGraphs(decideEditorTrigger("workspace-open", getSettings()).reason);
  setupDocumentGraphWatchers(context);
  setupArtifactWatchers(context);
  void importCliDiagnostics();
}

export function deactivate(): void {
  diagnostics?.dispose();
  output?.dispose();
}

async function lintDocumentIfChanged(document: vscode.TextDocument, reason: string): Promise<void> {
  const fingerprint = fingerprintDocument(document, getSettings());
  if (lintFingerprints.get(document.uri.fsPath) === fingerprint) {
    output.appendLine(`Skipped lint for unchanged document ${document.uri.fsPath} (${reason})`);
    return;
  }
  await lintDocument(document, reason);
}

async function lintDocument(document: vscode.TextDocument, reason: string): Promise<void> {
  const settings = getSettings();
  if (!settings.enable) {
    diagnostics.clear();
    return;
  }
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  const target = targetForDocument(document, folder, settings);
  try {
    const result = await runLint(await getApi(), target);
    const visibleFindings = filterEditorFindings(result.findings, settings.hiddenRules);
    const affectedFiles = affectedFilesFor(document.uri.fsPath, result.files, visibleFindings);
    updateDiagnosticsForFiles(diagnostics, vscode, affectedFiles, visibleFindings);
    rememberLintFingerprint(document, settings);
    output.appendLine(`Linted ${document.uri.fsPath}: ${visibleFindings.length} visible findings (${result.findings.length} total; ${reason})`);
    void vscode.window.setStatusBarMessage(`asciidoclint: ${visibleFindings.length} findings`, 5000);
  } catch (error) {
    reportError("Failed to lint AsciiDoc file", error);
  }
}

async function lintWorkspace(): Promise<void> {
  await runWorkspaceTargets({
    title: "asciidoclint: linting workspace entry documents",
    targetFactory: targetForWorkspace,
    folderAction: "Linting workspace folder",
    cancelMessage: "Lint cancelled.",
    finishMessage: "Finished",
    finalOutput: "Linted workspace",
    finalUserMessage: (count) => `asciidoclint: ${count} findings. See Problems panel.`,
    errorMessage: "Failed to lint AsciiDoc workspace",
    fix: false,
  });
}

interface WorkspaceRunOptions {
  title: string;
  targetFactory: typeof targetForWorkspace;
  folderAction: string;
  cancelMessage: string;
  finishMessage: string;
  finalOutput: string;
  finalUserMessage: (count: number) => string;
  errorMessage: string;
  fix: boolean;
}

async function runWorkspaceTargets(options: WorkspaceRunOptions): Promise<void> {
  const runId = beginLintRun();
  const settings = getSettings();
  if (!settings.enable) {
    void vscode.window.showInformationMessage("asciidoclint is disabled by setting asciidoclint.enable.");
    return;
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (!folders.length) {
    void vscode.window.showInformationMessage("Open a workspace folder before running asciidoclint.");
    return;
  }
  let api: AsciidoclintApi;
  const plannedTargets: Array<{ folder: vscode.WorkspaceFolder; target: ReturnType<typeof targetForWorkspace> }> = [];
  try {
    api = await getApi();
    for (const folder of folders) {
      const target = await chooseWorkspaceTarget(folder, settings, api, options.fix ? "fix" : "lint");
      if (!target) {
        output.appendLine(`${options.cancelMessage} No workspace document root selected for ${folder.uri.fsPath}.`);
        return;
      }
      plannedTargets.push({ folder, target });
    }
  } catch (error) {
    reportError(options.errorMessage, error);
    return;
  }
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: options.title,
    cancellable: true,
  }, async (progress, token) => {
    token.onCancellationRequested(cancelLint);
    try {
      const allFindings = [];
      for (const { folder, target } of plannedTargets) {
        if (token.isCancellationRequested || runId !== activeRunId) {
          output.appendLine(options.cancelMessage);
          return;
        }
        progress.report({ message: folder.name });
        output.appendLine(`${options.folderAction}: ${folder.uri.fsPath}`);
        output.appendLine(`Patterns: ${target.patterns.join(", ")}`);
        const result = await runLint(api, target, options.fix, false, ".asciidoclint/diagnostics.json");
        if (token.isCancellationRequested || runId !== activeRunId) {
          output.appendLine(options.cancelMessage);
          return;
        }
        const visibleFindings = filterFindingsInsideWorkspace(filterEditorFindings(result.findings, settings.hiddenRules), folder);
        const outsideFindings = result.findings.length - filterFindingsInsideWorkspace(result.findings, folder).length;
        if (outsideFindings > 0) {
          output.appendLine(`Skipped ${outsideFindings} findings outside workspace folder ${folder.uri.fsPath}`);
        }
        output.appendLine(`${options.finishMessage} ${folder.uri.fsPath}: ${visibleFindings.length} visible findings (${result.findings.length} total)`);
        allFindings.push(...visibleFindings);
      }
      updateDiagnostics(diagnostics, vscode, allFindings);
      output.appendLine(`${options.finalOutput}: ${allFindings.length} findings`);
      void vscode.window.showInformationMessage(options.finalUserMessage(allFindings.length));
    } catch (error) {
      reportError(options.errorMessage, error);
    }
  });
}

async function chooseWorkspaceTarget(
  folder: vscode.WorkspaceFolder,
  settings: ExtensionSettings,
  api: AsciidoclintApi,
  action: "lint" | "fix",
): Promise<ReturnType<typeof targetForWorkspace> | undefined> {
  const root = folder.uri.fsPath;
  const configFile = settings.config ? targetForWorkspace(folder, settings).configFile : undefined;
  const loaded = await api.loadRules?.({
    cwd: root,
    configFile,
    customRules: settings.customRules.map((rule) => rule.startsWith(".") || rule.startsWith("/") ? rule : rule),
  });
  const candidates = workspaceEntryPatterns(root, loaded?.config?.documents ?? []);
  if (!candidates.length) {
    void vscode.window.showInformationMessage(`asciidoclint: no top-level AsciiDoc documents found in ${folder.name}.`);
    return undefined;
  }
  if (candidates.length === 1) {
    output.appendLine(`Selected workspace document root for ${folder.uri.fsPath}: ${candidates[0]?.pattern}`);
    return targetForWorkspaceEntries(folder, settings, [candidates[0]!.pattern]);
  }
  const picked = await vscode.window.showQuickPick(candidates.map((candidate) => ({
    label: candidate.label,
    description: candidate.description,
    detail: `${action} ${candidate.pattern}`,
    candidate,
  })), {
    title: "asciidoclint: Select Workspace Document Root",
    placeHolder: `Choose the top-level AsciiDoc document to ${action} in ${folder.name}`,
    ignoreFocusOut: true,
  });
  if (!picked) {
    return undefined;
  }
  output.appendLine(`Selected workspace document root for ${folder.uri.fsPath}: ${picked.candidate.pattern}`);
  return targetForWorkspaceEntries(folder, settings, [picked.candidate.pattern]);
}

function beginLintRun(): number {
  activeRunId += 1;
  return activeRunId;
}

function cancelLint(): void {
  activeRunId += 1;
  output.appendLine("Cancel requested. Current parser pass may finish before diagnostics stop updating.");
  void vscode.window.setStatusBarMessage("asciidoclint: cancel requested", 5000);
}

async function importCliDiagnostics(): Promise<void> {
  const settings = getSettings();
  if (!settings.importCliDiagnostics) {
    output.appendLine("CLI diagnostics import is disabled.");
    return;
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  const findings = [];
  let importedAnyArtifact = false;
  for (const folder of folders) {
    const artifactFile = diagnosticsArtifactPath(folder);
    try {
      const artifact = readDiagnosticsArtifact(artifactFile);
      importedAnyArtifact = true;
      if (!artifactBelongsToWorkspace(artifact, folder)) {
        output.appendLine(`Imported diagnostics artifact with outside-workspace entries filtered: ${artifactFile}; ${artifactWorkspaceMismatchReasons(artifact, folder).join("; ")}`);
      }
      const staleReasons = staleArtifactReasons(artifact);
      if (staleReasons.length) {
        output.appendLine(`Imported stale diagnostics artifact ${artifactFile}; changes detected: ${staleReasons.slice(0, 5).join(", ")}`);
        void vscode.window.setStatusBarMessage("asciidoclint: imported stale CLI diagnostics; rerun lint recommended", 8000);
      } else {
        output.appendLine(`Imported diagnostics artifact: ${artifactFile}`);
      }
      findings.push(...filterFindingsInsideWorkspace(filterEditorFindings(artifact.findings, settings.hiddenRules), folder));
      rememberArtifactFingerprints(artifact, settings);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        reportError(`Failed to import diagnostics artifact ${artifactFile}`, error);
      }
    }
  }
  if (importedAnyArtifact) {
    updateDiagnostics(diagnostics, vscode, findings);
    void vscode.window.setStatusBarMessage(`asciidoclint: imported ${findings.length} visible CLI diagnostics`, 5000);
  }
}

function clearDiagnostics(): void {
  diagnostics.clear();
  output.appendLine("Cleared asciidoclint diagnostics.");
  void vscode.window.setStatusBarMessage("asciidoclint: diagnostics cleared", 5000);
}

function setupArtifactWatchers(context: vscode.ExtensionContext): void {
  for (const watcher of artifactWatchers) {
    watcher.dispose();
  }
  artifactWatchers = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const pattern = new vscode.RelativePattern(folder, ".asciidoclint/diagnostics.json");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate(() => void importCliDiagnostics(), undefined, context.subscriptions);
    watcher.onDidChange(() => void importCliDiagnostics(), undefined, context.subscriptions);
    watcher.onDidDelete(() => clearDiagnostics(), undefined, context.subscriptions);
    context.subscriptions.push(watcher);
    artifactWatchers.push(watcher);
  }
}

function setupDocumentGraphWatchers(context: vscode.ExtensionContext): void {
  for (const watcher of graphWatchers) {
    watcher.dispose();
  }
  graphWatchers = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const pattern = new vscode.RelativePattern(folder, "**/*.{adoc,asciidoc,asc,yaml,yml}");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidCreate((uri) => handleGraphFileEvent("document-create", uri), undefined, context.subscriptions);
    watcher.onDidChange((uri) => handleGraphFileEvent(isConfigPath(uri.fsPath, folder.uri.fsPath, getSettings()) ? "config-change" : "document-save", uri), undefined, context.subscriptions);
    watcher.onDidDelete((uri) => handleGraphFileEvent("document-delete", uri), undefined, context.subscriptions);
    context.subscriptions.push(watcher);
    graphWatchers.push(watcher);
  }
}

function handleGraphFileEvent(event: "document-create" | "document-save" | "document-delete" | "config-change", uri: vscode.Uri): void {
  const settings = getSettings();
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  if (!folder) {
    return;
  }
  const decision = decideEditorTrigger(event, settings, uri.fsPath);
  if (!decision.traverseGraph) {
    return;
  }
  if (!isAsciiDocPath(uri.fsPath) && !isConfigPath(uri.fsPath, folder.uri.fsPath, settings)) {
    return;
  }
  rebuildDocumentGraph(folder, decision.reason);
  if (decision.importDiagnostics) {
    void importCliDiagnostics();
  }
}

function rebuildAllDocumentGraphs(reason: string): void {
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    rebuildDocumentGraph(folder, reason);
  }
}

function rebuildDocumentGraph(folder: vscode.WorkspaceFolder, reason: string): void {
  try {
    const graph = buildDocumentGraph(folder.uri.fsPath);
    documentGraphs.set(folder.uri.fsPath, graph);
    output.appendLine(`Document graph rebuilt for ${folder.uri.fsPath}: ${graph.files.length} files, ${graph.roots.length} roots, ${graph.edges.length} includes (${reason})`);
  } catch (error) {
    reportError(`Failed to rebuild document graph for ${folder.uri.fsPath}`, error);
  }
}

function rememberLintFingerprint(document: vscode.TextDocument, settings: ExtensionSettings): void {
  lintFingerprints.set(document.uri.fsPath, fingerprintDocument(document, settings));
}

function rememberArtifactFingerprints(artifact: { fingerprint?: { files?: Array<{ file: string; mtimeMs?: number; size?: number }> } }, settings: ExtensionSettings): void {
  for (const file of artifact.fingerprint?.files ?? []) {
    lintFingerprints.set(file.file, fingerprintParts(file.file, file.mtimeMs, file.size, settingsFingerprint(settings)).join("\n"));
  }
}

function fingerprintDocument(document: vscode.TextDocument, settings: ExtensionSettings): string {
  const stat = safeStat(document.uri.fsPath);
  return fingerprintParts(document.uri.fsPath, stat?.mtimeMs, stat?.size ?? document.getText().length, settingsFingerprint(settings)).join("\n");
}

function settingsFingerprint(settings: ExtensionSettings): string {
  return [
    settings.config,
    settings.customRules.join("\0"),
    settings.hiddenRules.join("\0"),
  ].join("\n");
}

function fingerprintParts(file: string, mtimeMs: number | undefined, size: number | undefined, salt: string): string[] {
  return [file, String(mtimeMs ?? ""), String(size ?? ""), salt];
}

function safeStat(file: string): { mtimeMs: number; size: number } | undefined {
  try {
    const stat = fs.statSync(file);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch {
    return undefined;
  }
}

async function fixWorkspaceSafe(): Promise<void> {
  await saveDirtyAsciiDocDocuments();
  await runWorkspaceTargets({
    title: "asciidoclint: fixing workspace safely",
    targetFactory: targetForWorkspace,
    folderAction: "Applying safe fixes in workspace folder",
    cancelMessage: "Workspace fix cancelled.",
    finishMessage: "Finished safe fixes for",
    finalOutput: "Applied safe fixes in workspace",
    finalUserMessage: (count) => `asciidoclint: safe workspace fixes applied. ${count} non-parser findings remain; parser diagnostics were preserved.`,
    errorMessage: "Failed to apply safe asciidoclint workspace fixes",
    fix: true,
  });
}

async function saveDirtyAsciiDocDocuments(): Promise<void> {
  for (const document of vscode.workspace.textDocuments) {
    if (document.isDirty && documentSelector(document)) {
      await document.save();
    }
  }
}

function uniqueFiles(files: string[]): string[] {
  return [...new Set(files)];
}

function affectedFilesFor(primaryFile: string, resultFiles: string[], findings: Array<{ range: { start: { file: string } } }>): string[] {
  return uniqueFiles([primaryFile, ...resultFiles, ...findings.map((finding) => finding.range.start.file)]);
}

function getSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration("asciidoclint");
  return {
    enable: config.get("enable", true),
    run: config.get("run", "onSave"),
    config: config.get("config", ".asciidoclint.yaml"),
    customRules: config.get("customRules", []),
    hiddenRules: config.get("hiddenRules", []),
    unsafeFixes: config.get("unsafeFixes", false),
    importCliDiagnostics: config.get("importCliDiagnostics", true),
  };
}

function getApi(): Promise<AsciidoclintApi> {
  apiPromise ??= import("../../../dist/index.js") as Promise<AsciidoclintApi>;
  return apiPromise;
}

function reportError(message: string, error: unknown): void {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  output.appendLine(`${message}: ${detail}`);
  output.show(true);
  void vscode.window.showErrorMessage(`${message}: ${error instanceof Error ? error.message : String(error)}`);
}
