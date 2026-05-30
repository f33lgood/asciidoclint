import fs from "node:fs";
import path from "node:path";
import type {
  BlockNode,
  DependencyGraph,
  DependencyRecord,
  ConditionalRecord,
  IncludeRecord,
  LintFinding,
  NormalizedDocument,
  ParsedFile,
  ReferenceTarget,
  SectionNode,
  SourcePosition,
  SourceRange,
  SourceMapRecord,
} from "../types.js";
import { blockDelimiterType } from "../rules/utils.js";

const headingPattern = /^(=+|#+)\s+(.+?)\s*$/;
const attributePattern = /^:([^:]+):\s*(.*)$/;
const includePattern = /^include::([^\[]+)\[(.*)\]\s*$/;
const imagePattern = /^image::([^\[]+)\[(.*)\]\s*$/;
const inlineImagePattern = /(^|[^\w:])image:(?!:)([^\s\[]+)\[[^\]]*]/g;
const xrefPattern = /xref:([^\[]+)\[[^\]]*\]|<<([^,>\s]+)(?:,[^>]*)?>>/g;
const localLinkPattern = /(^|[^\w:])link:(?!:)([^\s\[]+)\[[^\]]*]/g;
const explicitAnchorPattern = /^\[\[([^\]]+)\]\]\s*$|^\[#([^,\]\s]+)(?:,[^\]]*)?]\s*$|^\[id=([^,\]\s]+)(?:,[^\]]*)?]\s*$/;
const inlineAnchorPattern = /\[\[([^\]]+)]]|\[#([^,\]\s]+)(?:,[^\]]*)?]/g;
const ifdefPattern = /^(ifdef|ifndef)::([^\[]+)\[\]\s*$/;
const endifPattern = /^endif::(?:[^\[]*)\[\]\s*$/;
interface ParseState {
  rootFile: string;
  attributes: Record<string, string>;
  sections: SectionNode[];
  blocks: BlockNode[];
  includes: IncludeRecord[];
  dependencies: DependencyRecord[];
  conditionals: ConditionalRecord[];
  diagnostics: LintFinding[];
  files: ParsedFile[];
  visited: Set<string>;
  anchors: Map<string, Set<string>>;
  sourceMap: SourceMapRecord[];
  expandedLine: number;
}

interface OpenBlock {
  delimiter: string;
  type: BlockNode["type"];
  range: SourceRange;
  style?: string;
}

export function parseDocument(file: string): NormalizedDocument {
  const absolute = path.resolve(file);
  const state: ParseState = {
    rootFile: absolute,
    attributes: {},
    sections: [],
    blocks: [],
    includes: [],
    dependencies: [],
    conditionals: [],
    diagnostics: [],
    files: [],
    visited: new Set(),
    anchors: new Map(),
    sourceMap: [],
    expandedLine: 1,
  };

  parseFile(absolute, state, { ...state.attributes });
  finalizeXrefDependencies(state);
  const rootLines = state.files.find((entry) => entry.file === absolute)?.lines ?? [];
  const dependencies: DependencyGraph = { records: state.dependencies };

  return {
    file: absolute,
    lines: rootLines,
    attributes: state.attributes,
    sections: state.sections,
    blocks: state.blocks,
    referenceTargets: referenceTargetsFromAnchors(state.anchors),
    includes: state.includes,
    dependencies,
    diagnostics: state.diagnostics,
    sourceMap: state.sourceMap,
    conditionals: state.conditionals,
    files: state.files,
  };
}

function parseFile(file: string, state: ParseState, inheritedAttributes: Record<string, string>): Record<string, string> {
  const absolute = path.resolve(file);
  if (state.visited.has(absolute)) {
    return { ...inheritedAttributes };
  }
  state.visited.add(absolute);

  let text: string;
  try {
    text = fs.readFileSync(absolute, "utf8");
  } catch {
    return { ...inheritedAttributes };
  }

  const lines = text.split(/\r?\n/);
  state.files.push({ file: absolute, lines });
  const attributes = { ...inheritedAttributes };
  const sectionStack: SectionNode[] = [];
  let openBlock: OpenBlock | undefined;
  const conditionalStack: boolean[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index] ?? "";
    const position = pos(absolute, lineNumber, 1);
    const trimmed = line.trim();
    const protectedBlock = isProtectedOpenBlock(openBlock);
    addSourceMap(state, absolute, lineNumber);

    if (!protectedBlock) {
      const conditional = line.match(ifdefPattern);
      if (conditional) {
        const directive = (conditional[1] ?? "ifdef") as "ifdef" | "ifndef";
        const attribute = conditional[2] ?? "";
        const attributeNames = attribute.split(",").map((name) => name.trim()).filter(Boolean);
        const hasAny = attributeNames.some((name) => attributes[name] !== undefined);
        const active = directive === "ifdef" ? hasAny : !hasAny;
        conditionalStack.push(active);
        state.conditionals.push({
          directive,
          attribute,
          active,
          range: lineRange(absolute, lineNumber, 1, line.length + 1),
        });
        continue;
      }

      if (endifPattern.test(line)) {
        conditionalStack.pop();
        continue;
      }
    }

    const conditionalActive = conditionalStack.every(Boolean);
    if (!conditionalActive) {
      continue;
    }

    if (!protectedBlock && trimmed.startsWith("//") && blockDelimiterType(trimmed) === undefined) {
      continue;
    }

    const commentParagraphRange = !openBlock ? findCommentParagraphRange(lines, index) : undefined;
    if (commentParagraphRange) {
      if (commentParagraphRange.start === index) {
        state.blocks.push({
          kind: "block",
          type: "comment",
          style: "comment",
          attributes: {},
          range: {
            start: pos(absolute, index, 1),
            end: pos(absolute, commentParagraphRange.end + 1, (lines[commentParagraphRange.end] ?? "").length + 1),
          },
          contentRange: lineRange(absolute, lineNumber, 1, line.length + 1),
        });
      }
      continue;
    }

    const attr = line.match(attributePattern);
    if (!openBlock && attr) {
      attributes[attr[1] ?? ""] = attr[2] ?? "";
      state.attributes[attr[1] ?? ""] = attr[2] ?? "";
      continue;
    }

    if (!protectedBlock) {
      collectInlineDependencies(line, absolute, lineNumber, attributes, state);
      collectInlineAnchors(line, absolute, state);
    }

    const anchor = !protectedBlock ? line.match(explicitAnchorPattern) : undefined;
    if (anchor) {
      addAnchor(state, absolute, (anchor[1] ?? anchor[2] ?? anchor[3] ?? "").trim());
      continue;
    }

    const include = !protectedBlock ? line.match(includePattern) : undefined;
    if (include) {
      const target = substituteAttributes(include[1] ?? "", attributes);
      const includeAttributes = parseBracketAttributes(include[2] ?? "");
      const resolved = isExternalTarget(target) ? target : path.resolve(path.dirname(absolute), target);
      const range = lineRange(absolute, lineNumber, 1, line.length + 1);
      const missingStatus = isOptionalInclude(includeAttributes) || isExternalTarget(target) ? "skipped" : "missing";
      const status = !isExternalTarget(target) && fs.existsSync(resolved) ? "resolved" : missingStatus;
      state.includes.push({
        target,
        resolvedTarget: status === "resolved" ? resolved : undefined,
        range,
        status,
        attributes: includeAttributes,
      });
      state.dependencies.push({
        type: "include",
        target,
        resolvedTarget: status === "resolved" ? resolved : undefined,
        range,
        status,
      });
      if (status === "resolved" && isAsciiDocSourceFile(resolved)) {
        Object.assign(attributes, parseFile(resolved, state, attributes));
      }
      continue;
    }

    const image = !protectedBlock ? line.match(imagePattern) : undefined;
    if (image) {
      const target = substituteAttributes(image[1] ?? "", attributes);
      const resolved = resolveImageTarget(absolute, target, attributes);
      const range = lineRange(absolute, lineNumber, 1, line.length + 1);
      const status = isExternalTarget(resolved) ? "skipped" : fs.existsSync(resolved) ? "resolved" : "missing";
      state.blocks.push({
        kind: "block",
        type: "image",
        attributes: { ...parseBracketAttributes(image[2] ?? ""), target },
        range,
      });
      state.dependencies.push({
        type: "image",
        target,
        resolvedTarget: status === "resolved" ? resolved : undefined,
        range,
        status,
      });
      continue;
    }

    const markdownFence = trimmed.startsWith("```") ? "```" : undefined;
    const delimiterType = markdownFence ? "listing" : blockDelimiterType(trimmed);
    if (delimiterType) {
      if (openBlock?.delimiter === (markdownFence ?? trimmed)) {
        state.blocks.push({
          kind: "block",
          type: blockTypeForOpenBlock(openBlock),
          style: openBlock.style,
          attributes: {},
          range: { start: openBlock.range.start, end: pos(absolute, lineNumber, line.length + 1) },
          contentRange: lineRange(absolute, openBlock.range.start.line + 1, 1, lineNumber - 1 > openBlock.range.start.line ? 1 : 1),
        });
        openBlock = undefined;
      } else if (!openBlock) {
        openBlock = {
          delimiter: markdownFence ?? trimmed,
          type: delimiterType,
          style: markdownFence ? "source" : detectStyle(lines[index - 1]),
          range: lineRange(absolute, lineNumber, 1, line.length + 1),
        };
      }
      continue;
    }

    if (protectedBlock) {
      continue;
    }

    const heading = line.match(headingPattern);
    if (heading) {
      const marker = heading[1] ?? "";
      const title = heading[2] ?? "";
      const level = marker.length - 1;
      const range = lineRange(absolute, lineNumber, 1, line.length + 1);
      const section: SectionNode = {
        kind: "section",
        title,
        level,
        range,
        titleRange: range,
        children: [],
        blocks: [],
      };
      while (sectionStack.length && (sectionStack[sectionStack.length - 1]?.level ?? 0) >= level) {
        sectionStack.pop();
      }
      const parent = sectionStack[sectionStack.length - 1];
      if (parent) {
        section.parent = parent;
        parent.children.push(section);
      }
      sectionStack.push(section);
      state.sections.push(section);
      addAnchor(state, absolute, title);
      if (!explicitAnchorImmediatelyBefore(lines, index)) {
        addAnchor(state, absolute, sectionId(title));
      }
      continue;
    }
  }

  return attributes;
}

function collectInlineDependencies(
  line: string,
  file: string,
  lineNumber: number,
  attributes: Record<string, string>,
  state: ParseState,
): void {
  for (const match of line.matchAll(inlineImagePattern)) {
    const rawTarget = match[2] ?? "";
    const target = substituteAttributes(rawTarget, attributes);
    if (!target) {
      continue;
    }
    const prefixLength = match[1]?.length ?? 0;
    const column = (match.index ?? 0) + prefixLength + 1;
    const range = lineRange(file, lineNumber, column, column + match[0].length - prefixLength);
    const resolved = resolveImageTarget(file, target, attributes);
    const status = isExternalTarget(resolved) ? "skipped" : fs.existsSync(resolved) ? "resolved" : "missing";
    state.dependencies.push({
      type: "image",
      target,
      resolvedTarget: status === "resolved" ? resolved : undefined,
      range,
      status,
    });
  }

  for (const match of line.matchAll(xrefPattern)) {
    const rawTarget = match[1] ?? match[2] ?? "";
    const target = normalizeXrefTarget(substituteAttributes(rawTarget, attributes));
    if (!target) {
      continue;
    }
    const column = (match.index ?? 0) + 1;
    const range = lineRange(file, lineNumber, column, column + match[0].length);
    const resolved = resolveXref(file, target, state);
    state.dependencies.push({
      type: "xref",
      target,
      resolvedTarget: resolved.status === "resolved" ? resolved.resolvedTarget : undefined,
      range,
      status: resolved.status,
    });
  }

  for (const match of line.matchAll(localLinkPattern)) {
    const rawTarget = match[2] ?? "";
    const target = substituteAttributes(rawTarget, attributes);
    if (!target || isExternalTarget(target)) {
      continue;
    }
    const prefixLength = match[1]?.length ?? 0;
    const column = (match.index ?? 0) + prefixLength + 1;
    const range = lineRange(file, lineNumber, column, column + match[0].length - prefixLength);
    const resolved = path.resolve(path.dirname(file), localFilePathFromLinkTarget(target));
    const status = fs.existsSync(resolved) ? "resolved" : "missing";
    state.dependencies.push({
      type: "attachment",
      target,
      resolvedTarget: status === "resolved" ? resolved : undefined,
      range,
      status,
    });
  }
}

function localFilePathFromLinkTarget(target: string): string {
  return target.split(/[?#]/, 1)[0] ?? target;
}

function collectInlineAnchors(line: string, file: string, state: ParseState): void {
  for (const match of line.matchAll(inlineAnchorPattern)) {
    addAnchor(state, file, (match[1] ?? match[2] ?? "").trim());
  }
}

function resolveXref(file: string, target: string, state: ParseState): { status: "resolved" | "missing"; resolvedTarget?: string } {
  const [targetFile, targetAnchor] = splitXrefTarget(target);
  if (targetFile) {
    const resolvedFile = path.resolve(path.dirname(file), targetFile);
    if (!fs.existsSync(resolvedFile)) {
      return { status: "missing" };
    }
    if (!targetAnchor) {
      return { status: "resolved", resolvedTarget: resolvedFile };
    }
    parseFile(resolvedFile, state, { ...state.attributes });
    return hasAnchor(state, resolvedFile, targetAnchor)
      ? { status: "resolved", resolvedTarget: resolvedFile }
      : { status: "missing" };
  }
  return hasAnyAnchor(state, targetAnchor ?? target)
    ? { status: "resolved", resolvedTarget: file }
    : { status: "missing" };
}

export function resolveDocumentXrefs(document: NormalizedDocument): void {
  const targets = new Map<string, ReferenceTarget[]>();
  for (const target of document.referenceTargets) {
    for (const id of [target.id, ...(target.aliases ?? [])]) {
      const key = referenceKey(target.file, id);
      targets.set(key, [...(targets.get(key) ?? []), target]);
    }
  }

  for (const record of document.dependencies.records) {
    if (record.type !== "xref") {
      continue;
    }
    const resolved = resolveDocumentXref(record.range.start.file, record.target, targets);
    record.status = resolved.status;
    record.resolvedTarget = resolved.resolvedTarget;
  }
}

function resolveDocumentXref(
  sourceFile: string,
  target: string,
  targets: Map<string, ReferenceTarget[]>,
): { status: "resolved" | "missing"; resolvedTarget?: string } {
  const [targetFile, targetAnchor] = splitXrefTarget(target);
  if (targetFile) {
    const resolvedFile = path.resolve(path.dirname(sourceFile), targetFile);
    if (!fs.existsSync(resolvedFile)) {
      return { status: "missing" };
    }
    if (!targetAnchor) {
      return { status: "resolved", resolvedTarget: resolvedFile };
    }
    return targets.has(referenceKey(resolvedFile, targetAnchor))
      ? { status: "resolved", resolvedTarget: resolvedFile }
      : { status: "missing" };
  }
  const anchor = targetAnchor ?? target;
  if (targets.has(referenceKey(sourceFile, anchor))) {
    return { status: "resolved", resolvedTarget: sourceFile };
  }
  for (const key of targets.keys()) {
    if (key.endsWith(`#${anchor}`)) {
      return { status: "resolved", resolvedTarget: sourceFile };
    }
  }
  return { status: "missing" };
}

function finalizeXrefDependencies(state: ParseState): void {
  for (const record of state.dependencies) {
    if (record.type !== "xref") {
      continue;
    }
    const resolved = resolveXref(record.range.start.file, record.target, state);
    record.status = resolved.status;
    record.resolvedTarget = resolved.resolvedTarget;
  }
}

function splitXrefTarget(target: string): [string | undefined, string | undefined] {
  const hash = target.indexOf("#");
  if (hash === -1) {
    return hasFileExtension(target) ? [target, undefined] : [undefined, target.replace(/^#/, "")];
  }
  const file = target.slice(0, hash);
  const anchor = target.slice(hash + 1);
  return [file || undefined, anchor || undefined];
}

function normalizeXrefTarget(target: string): string {
  return target.replace(/^#/, "").trim();
}

function hasFileExtension(target: string): boolean {
  return /\.[A-Za-z0-9]+(?:#.*)?$/.test(target);
}

function isExternalTarget(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("mailto:");
}

function resolveImageTarget(file: string, target: string, attributes: Record<string, string>): string {
  if (path.isAbsolute(target) || isExternalTarget(target)) {
    return target;
  }
  const imagesdir = attributes.imagesdir;
  if (imagesdir && isExternalTarget(imagesdir)) {
    return new URL(target, imagesdir.endsWith("/") ? imagesdir : `${imagesdir}/`).toString();
  }
  const imageTarget = imagesdir ? path.join(imagesdir, target) : target;
  return path.resolve(path.dirname(file), imageTarget);
}

function isOptionalInclude(attributes: Record<string, string | boolean>): boolean {
  return attributes.optional === true
    || attributes.opts === "optional"
    || attributes.options === "optional"
    || (typeof attributes.opts === "string" && attributes.opts.split(/\s+/).includes("optional"))
    || (typeof attributes.options === "string" && attributes.options.split(/\s+/).includes("optional"));
}

function addAnchor(state: ParseState, file: string, anchor: string): void {
  if (!anchor) {
    return;
  }
  const absolute = path.resolve(file);
  const anchors = state.anchors.get(absolute) ?? new Set<string>();
  anchors.add(anchor);
  state.anchors.set(absolute, anchors);
}

function referenceTargetsFromAnchors(anchors: Map<string, Set<string>>): ReferenceTarget[] {
  return [...anchors.entries()].flatMap(([file, ids]) => (
    [...ids].map((id) => ({ id, file, source: "tolerant" as const }))
  ));
}

function referenceKey(file: string, id: string): string {
  return `${path.resolve(file)}#${id}`;
}

function explicitAnchorImmediatelyBefore(lines: string[], index: number): boolean {
  const previous = lines[index - 1] ?? "";
  return explicitAnchorPattern.test(previous);
}

function hasAnchor(state: ParseState, file: string, anchor: string): boolean {
  return state.anchors.get(path.resolve(file))?.has(anchor) ?? false;
}

function hasAnyAnchor(state: ParseState, anchor: string): boolean {
  return [...state.anchors.values()].some((anchors) => anchors.has(anchor));
}

function sectionId(title: string): string {
  return `_${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

export function substituteAttributes(value: string, attributes: Record<string, string>): string {
  return value.replace(/\{([^}]+)\}/g, (_match, name: string) => attributes[name] ?? `{${name}}`);
}

function detectStyle(previousLine: string | undefined): string | undefined {
  const previous = previousLine?.trim();
  if (!previous?.startsWith("[") || !previous.endsWith("]")) {
    return undefined;
  }
  const content = previous.slice(1, -1);
  return content.split(",")[0];
}

function isProtectedOpenBlock(openBlock: OpenBlock | undefined): boolean {
  if (!openBlock) {
    return false;
  }
  return openBlock.style === "source"
    || openBlock.style === "comment"
    || ["listing", "literal", "passthrough", "comment"].includes(openBlock.type);
}

function isAsciiDocSourceFile(file: string): boolean {
  return /\.(?:adoc|asciidoc|asc)$/i.test(file);
}

function blockTypeForOpenBlock(openBlock: OpenBlock): BlockNode["type"] {
  if (openBlock.style === "source") {
    return "source";
  }
  if (openBlock.style === "comment") {
    return "comment";
  }
  return openBlock.type;
}

function findCommentParagraphRange(lines: string[], index: number): { start: number; end: number } | undefined {
  const line = lines[index] ?? "";
  if (line.trim() === "" || blockDelimiterType(line.trim()) !== undefined) {
    return undefined;
  }

  let start = index;
  while (start > 0 && (lines[start - 1] ?? "").trim() !== "" && (lines[start - 1] ?? "").trim() !== "[comment]") {
    start -= 1;
  }

  if ((lines[start - 1] ?? "").trim() !== "[comment]") {
    return undefined;
  }

  let end = index;
  while (end + 1 < lines.length && (lines[end + 1] ?? "").trim() !== "") {
    end += 1;
  }

  return { start, end };
}

function parseBracketAttributes(value: string): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  if (!value) {
    return result;
  }
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    const named = part.match(/^([A-Za-z_][A-Za-z0-9_.-]*)=(.*)$/);
    if (!named) {
      result[index === 0 ? "alt" : part] = index === 0 ? part : true;
    } else {
      result[named[1] ?? ""] = (named[2] ?? "").replace(/^"|"$/g, "");
    }
  }
  return result;
}

function pos(file: string, line: number, column: number): SourcePosition {
  return { file, line, column };
}

function addSourceMap(state: ParseState, file: string, line: number): void {
  state.sourceMap.push({
    expandedLine: state.expandedLine,
    source: pos(file, line, 1),
  });
  state.expandedLine += 1;
}

function lineRange(file: string, line: number, startColumn: number, endColumn: number): SourceRange {
  return {
    start: pos(file, line, startColumn),
    end: pos(file, line, endColumn),
  };
}
