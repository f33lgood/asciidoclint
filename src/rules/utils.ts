import path from "node:path";
import type { BlockType, NormalizedDocument, SectionNode } from "../types.js";

export function groupSectionsByFile(sections: SectionNode[]): Map<string, SectionNode[]> {
  const result = new Map<string, SectionNode[]>();
  for (const section of sections) {
    const list = result.get(section.range.start.file) ?? [];
    list.push(section);
    result.set(section.range.start.file, list);
  }
  return result;
}

export function parseColumnCount(line: string): number | undefined {
  const match = line.match(/cols="([^"]+)"/);
  if (!match) {
    return undefined;
  }
  return (match[1] ?? "").split(",").filter(Boolean).length;
}

export function countTableCells(line: string): number {
  return [...line.matchAll(/(?<!\\)\|/g)].length;
}

export function isComplexTableCellLine(line: string): boolean {
  const trimmed = line.trim();
  return /(^|\s)(?:\.\d+\+|\d+\+|\d+\.\d+\+|[a-z])\|/i.test(trimmed)
    || /\b[aehlmdsv]\|/.test(trimmed)
    || /\+$/.test(trimmed);
}

export function isBlockDelimiter(value: string): boolean {
  return blockDelimiterType(value) !== undefined;
}

export function blockDelimiterType(value: string): BlockType | undefined {
  const trimmed = value.trim();
  if (/^={4,}$/.test(trimmed)) {
    return "example";
  }
  if (/^-{4,}$/.test(trimmed)) {
    return "listing";
  }
  if (/^\.{4,}$/.test(trimmed)) {
    return "literal";
  }
  if (/^\+{4,}$/.test(trimmed)) {
    return "passthrough";
  }
  if (/^_{4,}$/.test(trimmed)) {
    return "quote";
  }
  if (/^\*{4,}$/.test(trimmed)) {
    return "sidebar";
  }
  if (/^\/{4,}$/.test(trimmed)) {
    return "comment";
  }
  if (trimmed === "--") {
    return "unknown";
  }
  if (/^[|,!:]={3,}$/.test(trimmed)) {
    return "table";
  }
  return undefined;
}

export function isListMarkerLine(line: string): boolean {
  return isUnorderedOrOrderedListMarkerLine(line) || isDescriptionListMarkerLine(line);
}

export function isListMarkerResidueLine(line: string): boolean {
  const trimmed = line.trim();
  return !isBlockDelimiter(trimmed) && /^(?:\*+|-|\.+|\d+\.)$/.test(trimmed);
}

export function isUnderlineResidueLine(line: string): boolean {
  return line.trim() === "___";
}

function isUnorderedOrOrderedListMarkerLine(line: string): boolean {
  return /^(\s*)([*-]+|\d+\.|\.+)\s+\S/.test(line);
}

function isDescriptionListMarkerLine(line: string): boolean {
  return /^\s*\S.*?(?::::|:::|::|;;)(?:\s+\S|\s*$)/.test(line);
}

export function isLineComment(line: string): boolean {
  return line.trimStart().startsWith("//");
}

export function isLineInCommentParagraph(lines: string[], index: number): boolean {
  if ((lines[index] ?? "").trim() === "") {
    return false;
  }
  let cursor = index - 1;
  while (cursor >= 0 && (lines[cursor] ?? "").trim() !== "") {
    if ((lines[cursor] ?? "").trim() === "[comment]") {
      return true;
    }
    cursor -= 1;
  }
  return false;
}

export function listMarkerContent(line: string): { content: string; offset: number } {
  const match = line.match(/^(\s*)([*-]+|\d+\.|\.+)\s+(\S.*)$/);
  if (!match) {
    const descriptionMatch = line.match(/^(\s*)\S.*?(?::::|:::|::|;;)(?:\s+(\S.*)|\s*$)/);
    if (!descriptionMatch) {
      return { content: line, offset: 0 };
    }
    const offset = (descriptionMatch[0]?.length ?? 0) - (descriptionMatch[2]?.length ?? 0);
    return { content: descriptionMatch[2] ?? "", offset };
  }
  return {
    content: match[3] ?? "",
    offset: (match[1]?.length ?? 0) + (match[2]?.length ?? 0) + 1,
  };
}

export function isAsciiDocTitleLine(line: string): boolean {
  const trimmed = line.trim();
  return /^\.[^\s.].+/.test(trimmed) || /^\[[^\]]*\btitle\s*=/.test(trimmed);
}

export function getAsciiDocTitle(line: string): string | undefined {
  const trimmed = line.trim();
  const blockTitle = trimmed.match(/^\.(?!\s|\.)((?:.|\s)+)$/);
  if (blockTitle) {
    return blockTitle[1]?.trim();
  }
  const attributeTitle = trimmed.match(/^\[[^\]]*\btitle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\]]+))/);
  return attributeTitle ? (attributeTitle[1] ?? attributeTitle[2] ?? attributeTitle[3] ?? "").trim() : undefined;
}

export function isAsciiDocSectionTitleLine(line: string): boolean {
  return /^(=+|#+)\s+\S/.test(line.trim());
}

export function isAsciiDocAnchorLine(line: string): boolean {
  return parseAsciiDocAnchor(line) !== undefined;
}

export function isAsciiDocBlockAttributeLine(line: string): boolean {
  return /^\[[^\]]*]\s*$/.test(line.trim()) && !isAsciiDocAnchorLine(line);
}

export function isAsciiDocAttributeEntryLine(line: string): boolean {
  return /^:[^:\s][^:\n]*:\s*.*$/.test(line.trim());
}

export function isExemptBeforeListLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === ""
    || trimmed === "+"
    || /^\/\//.test(trimmed)
    || isAsciiDocSectionTitleLine(line)
    || isListMarkerLine(line)
    || isBlockDelimiter(trimmed)
    || isAsciiDocTitleLine(line)
    || isAsciiDocAnchorLine(line)
    || isAsciiDocBlockAttributeLine(line);
}

export function hasTitleImmediatelyBefore(lines: string[], index: number): boolean {
  return findPrecedingTitleLineIndex(lines, index) !== undefined;
}

export function findPrecedingTitleLineIndex(lines: string[], index: number): number | undefined {
  let cursor = index - 1;
  while (cursor >= 0) {
    const line = lines[cursor] ?? "";
    if (isAsciiDocTitleLine(line)) {
      return cursor;
    }
    if (!isAsciiDocAnchorLine(line) && !isAsciiDocBlockAttributeLine(line) && line.trim() !== "") {
      return undefined;
    }
    cursor -= 1;
  }
  return undefined;
}

export function hasAnchorForTitledBlock(lines: string[], index: number): boolean {
  return getAnchorForTitledBlock(lines, index) !== undefined;
}

export function getAnchorForTitledBlock(lines: string[], index: number): string | undefined {
  const titleIndex = findPrecedingTitleLineIndex(lines, index);
  if (titleIndex === undefined) {
    return undefined;
  }
  for (let cursor = titleIndex + 1; cursor < index; cursor += 1) {
    const anchor = parseAsciiDocAnchor(lines[cursor] ?? "");
    if (anchor) {
      return anchor;
    }
  }
  let cursor = titleIndex - 1;
  while (cursor >= 0 && isAsciiDocBlockAttributeLine(lines[cursor] ?? "")) {
    cursor -= 1;
  }
  return cursor >= 0 ? parseAsciiDocAnchor(lines[cursor] ?? "") : undefined;
}

export function parseAsciiDocAnchor(line: string): string | undefined {
  const match = line.trim().match(/^\[\[([^\]]+)]]\s*$|^\[#([^,\]\s]+)(?:,[^\]]*)?]\s*$/);
  return match ? (match[1] ?? match[2]) : undefined;
}

export function hasExplicitId(id: string | boolean | undefined): boolean {
  return typeof id === "string" ? id.trim().length > 0 : id === true;
}

export function precedingAttributeLines(lines: string[], index: number): string[] {
  const attributes: string[] = [];
  let cursor = index - 1;
  while (cursor >= 0) {
    const line = lines[cursor] ?? "";
    if (isAsciiDocBlockAttributeLine(line)) {
      attributes.unshift(line.trim());
      cursor -= 1;
      continue;
    }
    if (isAsciiDocAnchorLine(line) || isAsciiDocTitleLine(line)) {
      cursor -= 1;
      continue;
    }
    break;
  }
  return attributes;
}

export function isDiagramStyleLine(line: string): boolean {
  return /^\[(?:a2s|actdiag|blockdiag|bytefield|dbml|ditaa|dot|dpic|drawio|erd|gnuplot|goat|graphviz|lilypond|matplotlib|mermaid|mmpviz|mscgen|nomnoml|nwdiag|packetdiag|penrose|pikchr|pintora|plantuml|rackdiag|seqdiag|shaape|smcat|state-machine-cat|structurizr|svgbob|symbolator|syntrax|umlet|vega|vega-lite|vegalite|wavedrom)(?:,|\])/.test(line.trim());
}

export function isLineInProtectedBlock(document: NormalizedDocument, file: string, line: number): boolean {
  return document.blocks.some((block) => (
    path.resolve(block.range.start.file) === path.resolve(file)
    && ["listing", "literal", "passthrough", "source", "stem", "diagram", "comment"].includes(block.type)
    && block.range.start.line < line
    && (block.range.end?.line ?? block.range.start.line) > line
  ));
}

export function isLineInTableBlock(document: NormalizedDocument, file: string, line: number): boolean {
  return document.blocks.some((block) => (
    path.resolve(block.range.start.file) === path.resolve(file)
    && block.type === "table"
    && block.range.start.line < line
    && (block.range.end?.line ?? block.range.start.line) > line
  ));
}

export function markdownResidueIssue(line: string): {
  message: string;
  fixHelper: string;
  column: number;
  endColumn: number;
  replacement?: string;
  severity: "warning" | "error";
} | undefined {
  const markdownImage = line.match(/!\[[^\]]*]\([^)]+\)/);
  if (markdownImage?.index !== undefined) {
    const parsed = markdownImage[0].match(/^!\[([^\]]*)]\(([^)]+)\)$/);
    const standalone = line.trim() === markdownImage[0];
    return {
      severity: "warning",
      message: "Markdown image syntax renders as text in AsciiDoc",
      fixHelper: "Use image::target[Alt text].",
      column: markdownImage.index + 1,
      endColumn: markdownImage.index + markdownImage[0].length + 1,
      replacement: parsed ? `${standalone ? "image::" : "image:"}${parsed[2] ?? ""}[${parsed[1] ?? ""}]` : undefined,
    };
  }
  const markdownLink = line.match(/(?<!!)\[[^\]]+]\([^)]+\)/);
  if (markdownLink?.index !== undefined) {
    const parsed = markdownLink[0].match(/^\[([^\]]+)]\(([^)]+)\)$/);
    return {
      severity: "warning",
      message: "Markdown link syntax renders as text in AsciiDoc",
      fixHelper: "Use link:target[text] or xref:target[text].",
      column: markdownLink.index + 1,
      endColumn: markdownLink.index + markdownLink[0].length + 1,
      replacement: parsed ? `${adocLinkMacro(parsed[2] ?? "")}:${parsed[2] ?? ""}[${parsed[1] ?? ""}]` : undefined,
    };
  }
  const reversedMarkdownLink = line.match(/\([^)]+\)\[[^\]]+]/);
  if (reversedMarkdownLink?.index !== undefined) {
    const parsed = reversedMarkdownLink[0].match(/^\(([^)]+)\)\[([^\]]+)]$/);
    return {
      severity: "warning",
      message: "Reversed Markdown link residue renders as text in AsciiDoc",
      fixHelper: "Use link:target[text] or xref:target[text].",
      column: reversedMarkdownLink.index + 1,
      endColumn: reversedMarkdownLink.index + reversedMarkdownLink[0].length + 1,
      replacement: parsed ? `${adocLinkMacro(parsed[1] ?? "")}:${parsed[1] ?? ""}[${parsed[2] ?? ""}]` : undefined,
    };
  }
  return undefined;
}

function adocLinkMacro(target: string): "link" | "xref" {
  return /\.(?:adoc|asciidoc|asc)(?:#|$)/i.test(target) ? "xref" : "link";
}

export function getRequiredSections(config: unknown): string[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return [];
  }
  const requiredSections = (config as { requiredSections?: unknown }).requiredSections;
  if (!Array.isArray(requiredSections)) {
    return [];
  }
  return requiredSections.filter((section): section is string => typeof section === "string");
}
