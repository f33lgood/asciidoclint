import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import type { BlockNode, LintFinding, ReferenceTarget, SectionNode } from "../types.js";
import { specialSectionStyles } from "../rules/specialSections.js";

const require = createRequire(typeof __filename === "string" ? __filename : import.meta.url);
let asciidoctor: any;
const specialSectionStyleSet = new Set<string>(specialSectionStyles);

export function collectAsciidoctorDiagnostics(file: string): LintFinding[] {
  if (shouldIsolateAsciidoctor()) {
    return collectAsciidoctorDiagnosticsInChild(file);
  }
  const processor = getAsciidoctor();
  const logger = processor.MemoryLogger.create();
  processor.LoggerManager.setLogger(logger);
  try {
    processor.convertFile(file, {
      safe: "unsafe",
      to_file: false,
      mkdirs: false,
    });
  } catch {
    // Diagnostics are collected below; conversion exceptions should not mask lint findings.
  }

  return logger.getMessages().map((message: any): LintFinding => {
    return toFinding(message, file);
  });
}

export function collectAsciidoctorBlocks(file: string): BlockNode[] {
  if (shouldIsolateAsciidoctor()) {
    return collectAsciidoctorBlocksInChild(file);
  }
  try {
    const processor = getAsciidoctor();
    const logger = processor.MemoryLogger.create();
    processor.LoggerManager.setLogger(logger);
    const document = processor.loadFile(file, {
      safe: "unsafe",
      sourcemap: true,
    });
    return blocksFromDocument(document);
  } catch {
    return [];
  }
}

export function collectAsciidoctorSections(file: string): SectionNode[] {
  if (shouldIsolateAsciidoctor()) {
    return collectAsciidoctorSectionsInChild(file);
  }
  try {
    const processor = getAsciidoctor();
    const logger = processor.MemoryLogger.create();
    processor.LoggerManager.setLogger(logger);
    const document = processor.loadFile(file, {
      safe: "unsafe",
      sourcemap: true,
    });
    return sectionsFromDocument(document, file);
  } catch {
    return [];
  }
}

export function collectAsciidoctorReferenceTargets(file: string): ReferenceTarget[] {
  if (shouldIsolateAsciidoctor()) {
    return collectAsciidoctorReferenceTargetsInChild(file);
  }
  try {
    const processor = getAsciidoctor();
    const logger = processor.MemoryLogger.create();
    processor.LoggerManager.setLogger(logger);
    const document = processor.loadFile(file, {
      safe: "unsafe",
      sourcemap: true,
    });
    return referenceTargetsFromDocument(document, file);
  } catch {
    return [];
  }
}

function shouldIsolateAsciidoctor(): boolean {
  return process.env.ASCIIDOCLINT_ISOLATE_ASCIIDOCTOR === "1" || !!process.versions.electron;
}

function collectAsciidoctorDiagnosticsInChild(file: string): LintFinding[] {
  const asciidoctorEntry = require.resolve("asciidoctor");
  const child = spawnSync(process.execPath, ["-e", isolatedAsciidoctorScript(), file, asciidoctorEntry], {
    encoding: "utf8",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      ASCIIDOCLINT_ISOLATE_ASCIIDOCTOR: "0",
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  if (child.status !== 0) {
    return [parserFailureFinding(file, child.stderr || child.stdout || `child process exited with status ${child.status}`)];
  }
  try {
    return JSON.parse(child.stdout) as LintFinding[];
  } catch (error) {
    return [parserFailureFinding(file, `failed to parse child diagnostics output: ${error instanceof Error ? error.message : String(error)}`)];
  }
}

function collectAsciidoctorBlocksInChild(file: string): BlockNode[] {
  const asciidoctorEntry = require.resolve("asciidoctor");
  const child = spawnSync(process.execPath, ["-e", isolatedAsciidoctorBlocksScript(), file, asciidoctorEntry], {
    encoding: "utf8",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      ASCIIDOCLINT_ISOLATE_ASCIIDOCTOR: "0",
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  if (child.status !== 0) {
    return [];
  }
  try {
    return JSON.parse(child.stdout) as BlockNode[];
  } catch {
    return [];
  }
}

function collectAsciidoctorSectionsInChild(file: string): SectionNode[] {
  const asciidoctorEntry = require.resolve("asciidoctor");
  const child = spawnSync(process.execPath, ["-e", isolatedAsciidoctorSectionsScript(), file, asciidoctorEntry], {
    encoding: "utf8",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      ASCIIDOCLINT_ISOLATE_ASCIIDOCTOR: "0",
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  if (child.status !== 0) {
    return [];
  }
  try {
    return JSON.parse(child.stdout) as SectionNode[];
  } catch {
    return [];
  }
}

function collectAsciidoctorReferenceTargetsInChild(file: string): ReferenceTarget[] {
  const asciidoctorEntry = require.resolve("asciidoctor");
  const child = spawnSync(process.execPath, ["-e", isolatedAsciidoctorReferenceTargetsScript(), file, asciidoctorEntry], {
    encoding: "utf8",
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      ASCIIDOCLINT_ISOLATE_ASCIIDOCTOR: "0",
    },
    maxBuffer: 10 * 1024 * 1024,
  });
  if (child.status !== 0) {
    return [];
  }
  try {
    return JSON.parse(child.stdout) as ReferenceTarget[];
  } catch {
    return [];
  }
}

function isolatedAsciidoctorSectionsScript(): string {
  return `
const path = require("node:path");
const file = process.argv[1];
const asciidoctorEntry = process.argv[2];
delete globalThis.Opal;
const asciidoctor = require(asciidoctorEntry)();
const logger = asciidoctor.MemoryLogger.create();
asciidoctor.LoggerManager.setLogger(logger);
function pos(file, line, column) {
  return { file, line, column };
}
function sectionsFromDocument(document) {
  return (document.findBy({ context: "section" }) || []).flatMap((section) => {
    const location = section.getSourceLocation && section.getSourceLocation();
    const sourceFile = location && location.file ? path.resolve(String(location.file)) : path.resolve(file);
    const line = Number((location && (location.getLineNumber && location.getLineNumber())) || (location && location.lineno) || 1);
    const title = String((section.getTitle && section.getTitle()) || section.title || "");
    if (!sourceFile || !line || !title) {
      return [];
    }
    const sectname = (section.getSectionName && section.getSectionName()) || section.sectname;
    const style = (section.getStyle && section.getStyle()) || undefined;
    return [{
      kind: "section",
      title,
      level: Number((section.getLevel && section.getLevel()) || section.level || 0),
      style: style ? String(style) : undefined,
      sectname: sectname ? String(sectname) : undefined,
      source: "asciidoctor",
      range: { start: pos(sourceFile, line, 1) },
      titleRange: { start: pos(sourceFile, line, 1) },
      children: [],
      blocks: [],
    }];
  });
}
try {
  const document = asciidoctor.loadFile(file, { safe: "unsafe", sourcemap: true });
  process.stdout.write(JSON.stringify(sectionsFromDocument(document)));
} catch {
  process.stdout.write("[]");
}
`;
}

function isolatedAsciidoctorScript(): string {
  return `
const path = require("node:path");
const file = process.argv[1];
const asciidoctorEntry = process.argv[2];
delete globalThis.Opal;
const asciidoctor = require(asciidoctorEntry)();
const logger = asciidoctor.MemoryLogger.create();
asciidoctor.LoggerManager.setLogger(logger);
const diagramStyles = new Set(["a2s","actdiag","blockdiag","bytefield","dbml","ditaa","dot","dpic","drawio","erd","gnuplot","goat","graphviz","lilypond","matplotlib","mermaid","mmpviz","mscgen","nomnoml","nwdiag","packetdiag","penrose","pikchr","pintora","plantuml","rackdiag","seqdiag","shaape","smcat","state-machine-cat","structurizr","svgbob","symbolator","syntrax","umlet","vega","vega-lite","vegalite","wavedrom"]);
try {
  asciidoctor.convertFile(file, { safe: "unsafe", to_file: false, mkdirs: false });
} catch {}
const findings = logger.getMessages().map((message) => {
  const location = message.getSourceLocation?.();
  const sourceFile = location?.file ? path.resolve(String(location.file)) : path.resolve(file);
  const line = Number(location?.lineno ?? 1);
  const severity = String(message.getSeverity?.() ?? "WARN").toUpperCase() === "ERROR" ? "error" : "warning";
  return {
    ruleId: "AD000",
    alias: "asciidoctor-diagnostic",
    severity,
    message: String(message.getText?.() ?? message),
    range: { start: { file: sourceFile, line, column: 1 } },
  };
});
process.stdout.write(JSON.stringify(findings));
`;
}

function isolatedAsciidoctorBlocksScript(): string {
  const specialStyles = JSON.stringify(specialSectionStyles);
  return `
const fs = require("node:fs");
const path = require("node:path");
const file = process.argv[1];
const asciidoctorEntry = process.argv[2];
delete globalThis.Opal;
const asciidoctor = require(asciidoctorEntry)();
const logger = asciidoctor.MemoryLogger.create();
asciidoctor.LoggerManager.setLogger(logger);
const specialSectionStyleSet = new Set(${specialStyles});
function pos(file, line, column) {
  return { file, line, column };
}
function findClosingDelimiter(sourceFile, startLine, delimiter) {
  try {
    const lines = fs.readFileSync(sourceFile, "utf8").split(/\\r?\\n/);
    for (let index = startLine; index < lines.length; index += 1) {
      if ((lines[index] || "").trim() === delimiter) {
        return { line: index + 1, column: (lines[index] || "").length + 1 };
      }
    }
  } catch {}
  return undefined;
}
function blocksFromDocument(document) {
  const tables = document.findBy({ context: "table" }) || [];
  const images = document.findBy({ context: "image" }) || [];
  const diagrams = []
    .concat(document.findBy({ context: "listing" }) || [])
    .concat(document.findBy({ context: "literal" }) || [])
    .filter((block) => diagramStyles.has(String((block.getStyle && block.getStyle()) || "")));
  const styledNonSections = []
    .concat(document.findBy((block) => {
      const context = String((block.getContext && block.getContext()) || "");
      const style = String((block.getStyle && block.getStyle()) || "");
      return context !== "section" && specialSectionStyleSet.has(style);
    }) || []);
  return []
    .concat(tables.map((block) => {
    const location = block.getSourceLocation && block.getSourceLocation();
    const sourceFile = location && location.file ? path.resolve(String(location.file)) : path.resolve(file);
    const startLine = Number((location && (location.getLineNumber && location.getLineNumber())) || (location && location.lineno) || 1);
    const end = findClosingDelimiter(sourceFile, startLine, "|===");
    const attributes = block.getAttributes ? block.getAttributes() : {};
    return {
      kind: "block",
      type: "table",
      context: "table",
      source: "asciidoctor",
      style: block.getStyle && block.getStyle() ? String(block.getStyle()) : undefined,
      title: block.getTitle && block.getTitle() ? String(block.getTitle()) : undefined,
      attributes: Object.fromEntries(Object.entries(attributes).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => [key, String(value)])),
      table: tableInfo(block),
      range: { start: pos(sourceFile, startLine, 1), end: end ? pos(sourceFile, end.line, end.column) : undefined },
      contentRange: end ? { start: pos(sourceFile, startLine + 1, 1), end: pos(sourceFile, end.line - 1, 1) } : undefined,
    };
  }))
    .concat(images.map((block) => blockNode(block, "image")))
    .concat(diagrams.map((block) => blockNode(block, "diagram")))
    .concat(styledNonSections.map((block) => blockNode(block, blockTypeForContext(String((block.getContext && block.getContext()) || "")))));
}
function blockNode(block, type) {
  const location = block.getSourceLocation && block.getSourceLocation();
  const sourceFile = location && location.file ? path.resolve(String(location.file)) : path.resolve(file);
  const startLine = Number((location && (location.getLineNumber && location.getLineNumber())) || (location && location.lineno) || 1);
  const attributes = block.getAttributes ? block.getAttributes() : {};
  return {
    kind: "block",
    type,
    context: block.getContext && block.getContext() ? String(block.getContext()) : undefined,
    source: "asciidoctor",
    style: block.getStyle && block.getStyle() ? String(block.getStyle()) : undefined,
    title: block.getTitle && block.getTitle() ? String(block.getTitle()) : undefined,
    attributes: Object.fromEntries(Object.entries(attributes).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => [key, typeof value === "boolean" ? value : String(value)])),
    range: { start: pos(sourceFile, startLine, 1) },
  };
}
function blockTypeForContext(context) {
  return ["paragraph","listing","literal","example","sidebar","quote","table","image","admonition","passthrough","stem"].includes(context) ? context : "unknown";
}
function primitiveNumber(value) {
  return typeof value === "number" ? value : undefined;
}
function tableInfo(block) {
  const rows = block.getRows && block.getRows();
  const cells = []
    .concat(rows && rows.head ? rows.head.flat() : [])
    .concat(rows && rows.body ? rows.body.flat() : [])
    .concat(rows && rows.foot ? rows.foot.flat() : []);
  return {
    columnCount: primitiveNumber(block.getColumnCount && block.getColumnCount()),
    renderedCellCount: cells.length,
    renderedCellSourceLines: cells
      .map((cell) => {
        const location = cell && cell.getSourceLocation && cell.getSourceLocation();
        return Number((location && (location.getLineNumber && location.getLineNumber())) || (location && location.lineno) || 0);
      })
      .filter((line) => line > 0),
  };
}
try {
  const document = asciidoctor.loadFile(file, { safe: "unsafe", sourcemap: true });
  process.stdout.write(JSON.stringify(blocksFromDocument(document)));
} catch {
  process.stdout.write("[]");
}
`;
}

function isolatedAsciidoctorReferenceTargetsScript(): string {
  return `
const path = require("node:path");
const file = process.argv[1];
const asciidoctorEntry = process.argv[2];
delete globalThis.Opal;
const asciidoctor = require(asciidoctorEntry)();
const logger = asciidoctor.MemoryLogger.create();
asciidoctor.LoggerManager.setLogger(logger);
function referenceTargetsFromDocument(document) {
  const refs = document.getCatalog && document.getCatalog().refs;
  const map = refs && refs.$$smap ? refs.$$smap : {};
  return Object.entries(map).flatMap(([id, node]) => {
    const location = node && node.getSourceLocation ? node.getSourceLocation() : node && node.source_location;
    const sourceFile = location && location.file ? path.resolve(String(location.file)) : path.resolve(file);
    const title = node && node.title ? String(node.title) : undefined;
    const context = node && node.context ? String(node.context) : undefined;
    const aliases = title && context === "section" && title !== id ? [title] : [];
    return [{ id, file: sourceFile, aliases, source: "asciidoctor" }];
  });
}
try {
  const document = asciidoctor.loadFile(file, { safe: "unsafe", sourcemap: true });
  process.stdout.write(JSON.stringify(referenceTargetsFromDocument(document)));
} catch {
  process.stdout.write("[]");
}
`;
}

function blocksFromDocument(document: any): BlockNode[] {
  const tables = document.findBy?.({ context: "table" }) ?? [];
  const images = document.findBy?.({ context: "image" }) ?? [];
  const diagrams = [
    ...(document.findBy?.({ context: "listing" }) ?? []),
    ...(document.findBy?.({ context: "literal" }) ?? []),
  ].filter((block: any) => diagramStyles.has(String(block.getStyle?.() ?? "")));
  const styledNonSections = (document.findBy?.((block: any) => {
    const context = String(block.getContext?.() ?? "");
    const style = String(block.getStyle?.() ?? "");
    return context !== "section" && specialSectionStyleSet.has(style);
  }) ?? []);
  return [
    ...tables.map((block: any): BlockNode | undefined => {
    const location = block.getSourceLocation?.();
    const sourceFile = location?.file ? path.resolve(String(location.file)) : undefined;
    if (!sourceFile) {
      return undefined;
    }
    const startLine = Number(location.getLineNumber?.() ?? location.lineno ?? 1);
    const end = findClosingDelimiter(sourceFile, startLine, "|===");
    const attributes = primitiveAttributes(block.getAttributes?.() ?? {});
    return {
      kind: "block",
      type: "table",
      context: "table",
      source: "asciidoctor",
      style: block.getStyle?.() ? String(block.getStyle()) : undefined,
      title: block.getTitle?.() ? String(block.getTitle()) : undefined,
      attributes,
      table: tableInfo(block),
      range: {
        start: { file: sourceFile, line: startLine, column: 1 },
        end: end ? { file: sourceFile, line: end.line, column: end.column } : undefined,
      },
      contentRange: end ? {
        start: { file: sourceFile, line: startLine + 1, column: 1 },
        end: { file: sourceFile, line: end.line - 1, column: 1 },
      } : undefined,
    };
  }),
    ...images.map((block: any): BlockNode | undefined => genericBlockNode(block, "image")),
    ...diagrams.map((block: any): BlockNode | undefined => genericBlockNode(block, "diagram")),
    ...styledNonSections.map((block: any): BlockNode | undefined => genericBlockNode(block, blockTypeForContext(String(block.getContext?.() ?? "")))),
  ].filter((block: BlockNode | undefined): block is BlockNode => !!block);
}

function sectionsFromDocument(document: any, rootFile: string): SectionNode[] {
  return (document.findBy?.({ context: "section" }) ?? [])
    .map((section: any): SectionNode | undefined => {
      const location = section.getSourceLocation?.();
      const sourceFile = location?.file ? path.resolve(String(location.file)) : path.resolve(rootFile);
      const line = Number(location?.getLineNumber?.() ?? location?.lineno ?? 1);
      const title = String(section.getTitle?.() ?? section.title ?? "");
      if (!sourceFile || !line || !title) {
        return undefined;
      }
      const sectname = section.getSectionName?.() ?? section.sectname;
      const style = section.getStyle?.();
      return {
        kind: "section",
        title,
        level: Number(section.getLevel?.() ?? section.level ?? 0),
        style: style ? String(style) : undefined,
        sectname: sectname ? String(sectname) : undefined,
        source: "asciidoctor",
        range: {
          start: { file: sourceFile, line, column: 1 },
        },
        titleRange: {
          start: { file: sourceFile, line, column: 1 },
        },
        children: [],
        blocks: [],
      };
    })
    .filter((section: SectionNode | undefined): section is SectionNode => !!section);
}

function referenceTargetsFromDocument(document: any, rootFile: string): ReferenceTarget[] {
  const refs = document.getCatalog?.().refs;
  const map = refs?.$$smap ?? {};
  return Object.entries(map).map(([id, node]: [string, any]) => {
    const location = node.getSourceLocation?.() ?? node.source_location;
    const sourceFile = location?.file ? path.resolve(String(location.file)) : path.resolve(rootFile);
    const title = node.title ? String(node.title) : undefined;
    const context = node.context ? String(node.context) : undefined;
    return {
      id,
      file: sourceFile,
      aliases: title && context === "section" && title !== id ? [title] : [],
      source: "asciidoctor",
    };
  });
}

const diagramStyles = new Set([
  "a2s", "actdiag", "blockdiag", "bytefield", "dbml", "ditaa", "dot", "dpic",
  "drawio", "erd", "gnuplot", "goat", "graphviz", "lilypond", "matplotlib",
  "mermaid", "mmpviz", "mscgen", "nomnoml", "nwdiag", "packetdiag", "penrose",
  "pikchr", "pintora", "plantuml", "rackdiag", "seqdiag", "shaape", "smcat",
  "state-machine-cat", "structurizr", "svgbob", "symbolator", "syntrax",
  "umlet", "vega", "vega-lite", "vegalite", "wavedrom",
]);

function genericBlockNode(block: any, type: BlockNode["type"]): BlockNode | undefined {
  const location = block.getSourceLocation?.();
  const sourceFile = location?.file ? path.resolve(String(location.file)) : undefined;
  if (!sourceFile) {
    return undefined;
  }
  const startLine = Number(location.getLineNumber?.() ?? location.lineno ?? 1);
  return {
    kind: "block",
    type,
    context: block.getContext?.() ? String(block.getContext()) : undefined,
    source: "asciidoctor",
    style: block.getStyle?.() ? String(block.getStyle()) : undefined,
    title: block.getTitle?.() ? String(block.getTitle()) : undefined,
    attributes: primitiveAttributes(block.getAttributes?.() ?? {}),
    range: {
      start: { file: sourceFile, line: startLine, column: 1 },
    },
  };
}

function blockTypeForContext(context: string): BlockNode["type"] {
  if (["paragraph", "listing", "literal", "example", "sidebar", "quote", "table", "image", "admonition", "passthrough", "stem"].includes(context)) {
    return context as BlockNode["type"];
  }
  return "unknown";
}

function tableInfo(block: any): BlockNode["table"] {
  const rows = block.getRows?.();
  const cells = [
    ...(rows?.head ?? []).flat(),
    ...(rows?.body ?? []).flat(),
    ...(rows?.foot ?? []).flat(),
  ];
  return {
    columnCount: primitiveNumber(block.getColumnCount?.()),
    renderedCellCount: cells.length,
    renderedCellSourceLines: cells
      .map((cell: any) => {
        const location = cell?.getSourceLocation?.();
        return Number(location?.getLineNumber?.() ?? location?.lineno ?? 0);
      })
      .filter((line: number) => line > 0),
  };
}

function primitiveNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function primitiveAttributes(attributes: Record<string, unknown>): Record<string, string | boolean> {
  return Object.fromEntries(Object.entries(attributes)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .map(([key, value]) => [key, typeof value === "boolean" ? value : String(value)]));
}

function findClosingDelimiter(sourceFile: string, startLine: number, delimiter: string): { line: number; column: number } | undefined {
  try {
    const lines = fs.readFileSync(sourceFile, "utf8").split(/\r?\n/);
    for (let index = startLine; index < lines.length; index += 1) {
      if ((lines[index] ?? "").trim() === delimiter) {
        return { line: index + 1, column: (lines[index] ?? "").length + 1 };
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function parserFailureFinding(file: string, detail: string): LintFinding {
  return {
    ruleId: "AD000",
    alias: "asciidoctor-diagnostic",
    severity: "warning",
    message: `Asciidoctor diagnostics failed: ${detail.split("\\n")[0]}`,
    range: {
      start: { file: path.resolve(file), line: 1, column: 1 },
    },
  };
}

function toFinding(message: any, file: string): LintFinding {
  const location = message.getSourceLocation?.();
  const sourceFile = location?.file ? path.resolve(String(location.file)) : path.resolve(file);
  const line = Number(location?.lineno ?? 1);
  const severity = String(message.getSeverity?.() ?? "WARN").toUpperCase() === "ERROR" ? "error" : "warning";
  return {
    ruleId: "AD000",
    alias: "asciidoctor-diagnostic",
    severity,
    message: String(message.getText?.() ?? message),
    range: {
      start: { file: sourceFile, line, column: 1 },
    },
  };
}

function getAsciidoctor(): any {
  asciidoctor ??= loadAsciidoctor();
  return asciidoctor;
}

function loadAsciidoctor(): any {
  const globalObject = globalThis as typeof globalThis & { Opal?: unknown };
  const hadOpal = Object.prototype.hasOwnProperty.call(globalObject, "Opal");
  if (hadOpal) {
    Reflect.deleteProperty(globalObject, "Opal");
  }
  const factory = require("asciidoctor") as () => any;
  const processor = factory();
  // Asciidoctor.js keeps using globalThis.Opal after initialization. If the
  // editor host already had an Opal object from another extension/runtime,
  // restoring or reusing it can recurse in Opal constant resolution.
  return processor;
}
