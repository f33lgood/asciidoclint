import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { describe, expect, it, vi } from "vitest";
import {
  buildDocumentGraph,
  decideEditorTrigger,
  documentSelector,
  artifactBelongsToWorkspace,
  filterEditorFindings,
  filterFindingsInsideWorkspace,
  isConfigPath,
  isDiagnosticsArtifactPath,
  runLint,
  targetForDocument,
  targetForFullWorkspace,
  targetForWorkspace,
  targetForWorkspaceEntries,
  staleArtifactReasons,
  toDiagnostic,
  toDiagnosticSeverity,
  updateDiagnosticsForFiles,
  workspaceEntryPatterns,
  type AsciidoclintApi,
  type ExtensionSettings,
} from "./linting";

const settings: ExtensionSettings = {
  enable: true,
  run: "onSave",
  config: ".asciidoclint/config.yaml",
  customRules: ["./rules/no-todo.js", "org-rules"],
  hiddenRules: [],
  showWaived: false,
  unsafeFixes: false,
  importCliDiagnostics: true,
};

describe("VS Code asciidoclint linting helpers", () => {
  it("selects AsciiDoc documents by language or extension", () => {
    expect(documentSelector(document("/tmp/doc.adoc", "plaintext"))).toBe(true);
    expect(documentSelector(document("/tmp/doc.txt", "asciidoc"))).toBe(true);
    expect(documentSelector(document("/tmp/doc.md", "markdown"))).toBe(false);
  });

  it("builds document lint targets with workspace-relative config and custom rules", () => {
    const target = targetForDocument(
      document("/repo/docs/index.adoc", "asciidoc"),
      { uri: { fsPath: "/repo" } } as any,
      settings,
    );

    expect(target.patterns).toEqual(["/repo/docs/index.adoc"]);
    expect(target.cwd).toBe("/repo");
    expect(target.configFile).toBe(path.join("/repo", ".asciidoclint/config.yaml"));
    expect(target.customRules).toEqual([path.join("/repo", "rules/no-todo.js"), "org-rules"]);
  });

  it("discovers top-level workspace document candidates when no conventional root exists", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-workspace-candidates-"));
    fs.writeFileSync(path.join(directory, "chapter.adoc"), "= Chapter\n");
    fs.writeFileSync(path.join(directory, "ROT_BR_IAS.adoc"), "= Root\n\ninclude::chapter.adoc[]\n");

    const candidates = workspaceEntryPatterns(directory);

    expect(candidates.map((candidate) => candidate.pattern)).toEqual(["ROT_BR_IAS.adoc", "chapter.adoc"]);
    expect(candidates.every((candidate) => candidate.source === "top-level")).toBe(true);
  });

  it("uses configured workspace documents without prompting candidates", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-configured-documents-"));
    fs.writeFileSync(path.join(directory, "root.adoc"), "= Root\n");
    fs.writeFileSync(path.join(directory, "other.adoc"), "= Other\n");

    const candidates = workspaceEntryPatterns(directory, ["root.adoc"]);
    const target = targetForWorkspaceEntries({ uri: { fsPath: directory } } as any, settings, candidates.map((candidate) => candidate.pattern));

    expect(candidates.map((candidate) => candidate.pattern)).toEqual(["root.adoc"]);
    expect(candidates[0]?.source).toBe("config");
    expect(target.patterns).toEqual(["root.adoc"]);
    expect(target.cwd).toBe(directory);
  });

  it("prefers a conventional workspace root when present", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-conventional-root-"));
    fs.writeFileSync(path.join(directory, "index.adoc"), "= Root\n");
    fs.writeFileSync(path.join(directory, "chapter.adoc"), "= Chapter\n");

    const target = targetForWorkspace({ uri: { fsPath: directory } } as any, settings);

    expect(target.patterns).toEqual(["index.adoc"]);
    expect(target.cwd).toBe(directory);
  });

  it("builds full workspace lint targets for all AsciiDoc extensions", () => {
    const target = targetForFullWorkspace({ uri: { fsPath: "/repo" } } as any, settings);

    expect(target.patterns).toEqual(["**/*.{adoc,asciidoc,asc}"]);
    expect(target.cwd).toBe("/repo");
  });

  it("passes fix options through to the shared asciidoclint API", async () => {
    const api: AsciidoclintApi = {
      lintFiles: vi.fn(async () => ({ files: [], findings: [] })),
    };

    await runLint(api, {
      patterns: ["doc.adoc"],
      cwd: "/repo",
      configFile: "/repo/.asciidoclint/config.yaml",
      customRules: [],
    }, true, false);

    expect(api.lintFiles).toHaveBeenCalledWith(["doc.adoc"], {
      cwd: "/repo",
      configFile: "/repo/.asciidoclint/config.yaml",
      customRules: [],
      fix: true,
      unsafeFixes: false,
      outputDiagnosticsFile: undefined,
    });
  });

  it("passes diagnostics artifact output through to the shared asciidoclint API", async () => {
    const api: AsciidoclintApi = {
      lintFiles: vi.fn(async () => ({ files: [], findings: [] })),
    };

    await runLint(api, {
      patterns: ["index.adoc"],
      cwd: "/repo",
      configFile: "/repo/.asciidoclint/config.yaml",
      customRules: [],
    }, false, false, ".asciidoclint/diagnostics.json");

    expect(api.lintFiles).toHaveBeenCalledWith(["index.adoc"], expect.objectContaining({
      outputDiagnosticsFile: ".asciidoclint/diagnostics.json",
    }));
  });

  it("maps severities to VS Code diagnostic severities", () => {
    const vscodeApi = {
      DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
      },
    } as any;

    expect(toDiagnosticSeverity(vscodeApi, "error")).toBe(0);
    expect(toDiagnosticSeverity(vscodeApi, "warning")).toBe(1);
    expect(toDiagnosticSeverity(vscodeApi, "info")).toBe(2);
  });

  it("includes the rule id and alias in diagnostic message text for Problems filtering", () => {
    const diagnostic = toDiagnostic(fakeVscodeApi(), {
      ...finding("/repo/doc.adoc", "AD000"),
      alias: "asciidoctor-diagnostic",
      message: "parser warning",
    });

    expect(diagnostic.message).toContain("AD000/asciidoctor-diagnostic");
    expect(diagnostic.message).toContain("parser warning");
    expect(diagnostic.code).toBe("AD000/asciidoctor-diagnostic");
  });

  it("filters findings outside the workspace before publishing editor diagnostics", () => {
    const workspaceFolder = { uri: { fsPath: "/repo/docs" } } as any;
    const inside = finding("/repo/docs/chapter.adoc", "AD001");
    const outside = finding("/repo/shared/chapter.adoc", "AD002");

    expect(filterFindingsInsideWorkspace([inside, outside], workspaceFolder)).toEqual([inside]);
  });

  it("filters editor diagnostics by hidden rule id or alias", () => {
    const findings = [
      { ...finding("/repo/doc.adoc", "AD000"), alias: "asciidoctor-diagnostic" },
      { ...finding("/repo/doc.adoc", "AD034"), alias: "no-hard-tabs" },
      { ...finding("/repo/doc.adoc", "AD001"), alias: "heading-level-progression" },
    ];

    expect(filterEditorFindings(findings, ["AD000", "no-hard-tabs"]).map((finding) => finding.ruleId)).toEqual(["AD001"]);
    expect(filterEditorFindings(findings, ["asciidoctor-diagnostic"]).map((finding) => finding.ruleId)).toEqual(["AD034", "AD001"]);
  });

  it("hides waived findings from editor diagnostics by default", () => {
    const findings = [
      finding("/repo/doc.adoc", "AD001"),
      {
        ...finding("/repo/doc.adoc", "AD023"),
        waived: true,
        waiver: {
          file: "/repo/doc.adoc",
          line: 1,
          column: 1,
          directive: "disable-next-line",
          rules: ["AD023"],
        },
      },
    ];

    expect(filterEditorFindings(findings, []).map((finding) => finding.ruleId)).toEqual(["AD001"]);
  });

  it("can show waived findings as non-blocking diagnostics", () => {
    const waived = {
      ...finding("/repo/doc.adoc", "AD023"),
      waived: true,
      waiver: {
        file: "/repo/doc.adoc",
        line: 1,
        column: 1,
        directive: "disable-next-line",
        rules: ["AD023"],
        reason: "intentional placeholder",
      },
    };

    expect(filterEditorFindings([waived], [], true).map((finding) => finding.ruleId)).toEqual(["AD023"]);

    const diagnostic = toDiagnostic(fakeVscodeApi(), waived);
    expect(diagnostic.message).toContain("[WAIVED]");
    expect(diagnostic.severity).toBe(2);
    expect(diagnostic.tags).toEqual([1]);
    expect(diagnostic.relatedInformation?.[0]?.message).toContain("intentional placeholder");
  });

  it("accepts diagnostics artifacts generated from a different cwd when findings are inside the workspace", () => {
    const artifact = {
      cwd: "/repo/tool-source",
      files: [],
      findings: [finding("/repo/docs/index.adoc", "AD000")],
      fingerprint: {
        files: [{ file: "/repo/docs/index.adoc" }],
      },
    };
    const workspaceFolder = { uri: { fsPath: "/repo/docs" } } as any;

    expect(artifactBelongsToWorkspace(artifact, workspaceFolder)).toBe(true);
  });

  it("detects stale diagnostics artifacts when fingerprinted files change", () => {
    const stale = staleArtifactReasons({
      files: [],
      findings: [],
      fingerprint: {
        files: [
          {
            file: "/definitely/missing.adoc",
            mtimeMs: 1,
            size: 1,
          },
        ],
      },
    });

    expect(stale[0]).toContain("missing");
  });

  it("decides editor trigger behavior without linting on navigation or typing", () => {
    expect(decideEditorTrigger("document-open", settings, "/repo/index.adoc").lint).toBe(false);
    expect(decideEditorTrigger("document-focus", settings, "/repo/index.adoc").lint).toBe(false);
    expect(decideEditorTrigger("document-change", settings, "/repo/index.adoc").lint).toBe(false);

    const save = decideEditorTrigger("document-save", settings, "/repo/index.adoc");
    expect(save.lint).toBe(true);
    expect(save.traverseGraph).toBe(true);

    const manualSettings = { ...settings, run: "manual" as const };
    const manualSave = decideEditorTrigger("document-save", manualSettings, "/repo/index.adoc");
    expect(manualSave.lint).toBe(false);
    expect(manualSave.traverseGraph).toBe(true);
  });

  it("decides graph and artifact events separately from lint events", () => {
    expect(decideEditorTrigger("workspace-open", settings).traverseGraph).toBe(true);
    expect(decideEditorTrigger("document-create", settings, "/repo/chapter.adoc").lint).toBe(false);
    expect(decideEditorTrigger("document-create", settings, "/repo/chapter.adoc").traverseGraph).toBe(true);
    expect(decideEditorTrigger("config-change", settings, "/repo/.asciidoclint/config.yaml")).toMatchObject({
      lint: false,
      traverseGraph: true,
      importDiagnostics: true,
    });
    expect(decideEditorTrigger("diagnostics-artifact-change", settings, "/repo/.asciidoclint/diagnostics.json")).toMatchObject({
      lint: false,
      traverseGraph: false,
      importDiagnostics: true,
    });
    expect(decideEditorTrigger("diagnostics-artifact-delete", settings, "/repo/.asciidoclint/diagnostics.json")).toMatchObject({
      lint: false,
      clearDiagnostics: true,
    });
  });

  it("recognizes config and diagnostics artifact paths", () => {
    expect(isConfigPath("/repo/.asciidoclint/config.yaml", "/repo", settings)).toBe(true);
    expect(isConfigPath("/repo/other.yaml", "/repo", settings)).toBe(false);
    expect(isDiagnosticsArtifactPath("/repo/.asciidoclint/diagnostics.json", "/repo")).toBe(true);
    expect(isDiagnosticsArtifactPath("/repo/diagnostics.json", "/repo")).toBe(false);
  });

  it("builds a lightweight document graph with roots, include edges, and owners", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-graph-"));
    try {
      fs.writeFileSync(path.join(directory, "index.adoc"), "= Root\n\ninclude::chapter.adoc[]\ninclude::missing.adoc[]\n");
      fs.writeFileSync(path.join(directory, "chapter.adoc"), "== Chapter\n\ninclude::section.adoc[]\n");
      fs.writeFileSync(path.join(directory, "section.adoc"), "=== Section\n");
      fs.mkdirSync(path.join(directory, "node_modules"));
      fs.writeFileSync(path.join(directory, "node_modules", "ignored.adoc"), "= Ignored\n");

      const graph = buildDocumentGraph(directory);
      const index = path.join(directory, "index.adoc");
      const chapter = path.join(directory, "chapter.adoc");
      const section = path.join(directory, "section.adoc");

      expect(graph.files).toEqual([chapter, index, section].sort());
      expect(graph.roots).toEqual([index]);
      expect(graph.edges).toEqual([
        { from: chapter, to: section, target: "section.adoc", exists: true },
        { from: index, to: chapter, target: "chapter.adoc", exists: true },
        { from: index, to: path.join(directory, "missing.adoc"), target: "missing.adoc", exists: false },
      ]);
      expect(graph.ownersByFile[section]).toEqual([index]);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("updates lint result files without clearing imported workspace diagnostics", () => {
    const calls: Array<{ file: string; diagnostics: unknown[] }> = [];
    const collection = {
      set: (uri: { fsPath: string }, diagnostics: unknown[]) => calls.push({ file: uri.fsPath, diagnostics }),
    } as any;
    const vscodeApi = fakeVscodeApi();

    updateDiagnosticsForFiles(collection, vscodeApi, ["/repo/a.adoc"], [
      finding("/repo/a.adoc", "AD001"),
      finding("/repo/b.adoc", "AD002"),
    ]);

    expect(calls.map((call) => call.file)).toEqual(["/repo/a.adoc", "/repo/b.adoc"]);
    expect(calls[0].diagnostics).toHaveLength(1);
    expect(calls[1].diagnostics).toHaveLength(1);
  });
});

function document(fsPath: string, languageId: string): any {
  return {
    uri: { scheme: "file", fsPath },
    languageId,
  };
}

function fakeVscodeApi(): any {
  class Position {
    constructor(public line: number, public character: number) {}
  }
  class Range {
    constructor(public start: Position, public end: Position) {}
  }
  class Diagnostic {
    source?: string;
    code?: string;
    tags?: number[];
    relatedInformation?: Array<{ location: unknown; message: string }>;
    constructor(public range: Range, public message: string, public severity: number) {}
  }
  class Location {
    constructor(public uri: unknown, public range: Range) {}
  }
  class DiagnosticRelatedInformation {
    constructor(public location: Location, public message: string) {}
  }
  return {
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity: {
      Error: 0,
      Warning: 1,
      Information: 2,
    },
    DiagnosticTag: {
      Unnecessary: 1,
    },
    Location,
    Position,
    Range,
    Uri: {
      file: (file: string) => ({ fsPath: file }),
    },
  };
}

function finding(file: string, ruleId: string): any {
  return {
    ruleId,
    severity: "warning",
    message: "message",
    range: {
      start: {
        file,
        line: 1,
        column: 1,
      },
    },
  };
}
