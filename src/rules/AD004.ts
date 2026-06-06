import type { Rule } from "../types.js";
import { countTableCells } from "./utils.js";

export const AD004: Rule = {
  id: "AD004",
  alias: "table-cell-count",
  description: "Table source should not contain cells omitted from rendered output",
  tags: ["core", "table"],
  parser: "document",
  docs: {
    summary: "A table should not end with incomplete cells that Asciidoctor omits from the rendered output.",
    fixability: "no",
    fixHelper: "Add missing table cells, remove leftover cells, or make intended row and column spans explicit so every source cell appears in the rendered table.",
    badExamples: [{ code: "[cols=\"1,1\"]\n|===\n| one | two | omitted\n|===" }],
    goodExamples: [{ code: "[cols=\"1,1\"]\n|===\n| one | two\n|===" }],
  },
  function: ({ document }, onError) => {
    const reportedNestedTables = new Set<string>();
    for (const block of document.blocks.filter((entry) => entry.type === "table")) {
      if (!block.range.end || block.attributes.format || block.attributes.separator) {
        continue;
      }
      const file = document.files.find((entry) => entry.file === block.range.start.file);
      if (!file) {
        continue;
      }
      if (containsNestedDefaultPsvTable(file.lines, block.range.start.line, block.range.end.line)) {
        continue;
      }
      const sourceCells = countSourceCells(file.lines, block.range.start.line, block.range.end.line);
      const renderedCells = block.table?.renderedCellCount;
      if (renderedCells !== undefined && sourceCells > renderedCells) {
        onError({
          severity: "warning",
          message: `Table source has ${sourceCells - renderedCells} cell${sourceCells - renderedCells === 1 ? "" : "s"} that Asciidoctor did not render`,
          range: { start: block.range.start },
          fixHelper: "Add the missing cells, remove the extra cells, or make the intended row and column spans explicit.",
        });
      }
      for (const finding of findNestedAlternateTableRowIssues(file.lines, block.range.start.line, block.range.end.line)) {
        const key = `${file.file}:${finding.line}`;
        if (reportedNestedTables.has(key)) {
          continue;
        }
        reportedNestedTables.add(key);
        onError({
          severity: "warning",
          message: `Nested table row has ${finding.actual} cell${finding.actual === 1 ? "" : "s"} but declares ${finding.expected} columns`,
          range: { start: { file: file.file, line: finding.line, column: 1 } },
          fixHelper: "Add the missing nested table cell, remove the extra cell marker, or make the intended span explicit so Asciidoctor does not drop cells.",
        });
      }
    }
  },
};

function countSourceCells(lines: string[], startLine: number, endLine: number): number {
  let count = 0;
  for (let index = startLine; index < endLine - 1; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "|===") {
      continue;
    }
    count += countTableCells(line);
  }
  return count;
}

function containsNestedDefaultPsvTable(lines: string[], startLine: number, endLine: number): boolean {
  for (let index = startLine; index < endLine - 1; index += 1) {
    if ((lines[index] ?? "").trim() === "|===") {
      return true;
    }
  }
  return false;
}

interface NestedRowIssue {
  line: number;
  expected: number;
  actual: number;
}

function findNestedAlternateTableRowIssues(lines: string[], startLine: number, endLine: number): NestedRowIssue[] {
  const issues: NestedRowIssue[] = [];
  for (let index = startLine; index < endLine - 1; index += 1) {
    const delimiter = parseNestedTableDelimiter(lines[index] ?? "");
    if (!delimiter || delimiter.marker === "|") {
      continue;
    }
    const expected = findDeclaredColumnCount(lines, index);
    if (!expected) {
      continue;
    }
    const close = findClosingDelimiter(lines, index + 1, endLine - 1, delimiter.marker);
    if (close === undefined) {
      continue;
    }
    issues.push(...findIncompleteRows(lines, index + 1, close, delimiter.marker, expected));
    index = close;
  }
  return issues;
}

function parseNestedTableDelimiter(line: string): { marker: string } | undefined {
  const match = line.match(/^\s*([!,/:])={3,}\s*$/);
  return match ? { marker: match[1] ?? "!" } : undefined;
}

function findDeclaredColumnCount(lines: string[], delimiterIndex: number): number | undefined {
  for (let index = delimiterIndex - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      continue;
    }
    const match = line.match(/^\s*\[.*\bcols\s*=\s*(?:"([^"]+)"|'([^']+)'|([^,\]]+)).*]\s*$/);
    if (!match) {
      return undefined;
    }
    return parseColumnSpecCount((match[1] ?? match[2] ?? match[3] ?? "").trim());
  }
  return undefined;
}

function parseColumnSpecCount(value: string): number {
  const compact = value.match(/^(\d+)\*$/);
  if (compact) {
    return Math.max(1, Number(compact[1] ?? "1"));
  }
  const numeric = value.match(/^\d+$/);
  if (numeric) {
    return Math.max(1, Number(value));
  }
  const parts = value.split(",");
  return Math.max(1, value.includes(",") ? parts.length : parts.filter(Boolean).length);
}

function findClosingDelimiter(lines: string[], startIndex: number, endIndex: number, marker: string): number | undefined {
  const delimiter = new RegExp(`^\\s*\\${marker}={3,}\\s*$`);
  for (let index = startIndex; index < endIndex; index += 1) {
    if (delimiter.test(lines[index] ?? "")) {
      return index;
    }
  }
  return undefined;
}

function findIncompleteRows(lines: string[], startIndex: number, endIndex: number, marker: string, expected: number): NestedRowIssue[] {
  const issues: NestedRowIssue[] = [];
  let rowCells = 0;
  let rowStartLine: number | undefined;
  for (let index = startIndex; index < endIndex; index += 1) {
    const cells = countNestedTableCells(lines[index] ?? "", marker);
    if (cells === 0) {
      continue;
    }
    rowStartLine ??= index + 1;
    rowCells += cells;
    while (rowCells >= expected) {
      rowCells -= expected;
      rowStartLine = rowCells > 0 ? index + 1 : undefined;
    }
  }
  if (rowCells > 0) {
    issues.push({ line: rowStartLine ?? endIndex, expected, actual: rowCells });
  }
  return issues;
}

function countNestedTableCells(line: string, marker: string): number {
  const escapedMarker = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const markerPattern = new RegExp(`(?<!\\\\)(?:^|\\s)(?:\\d+\\+)?[a-z]?${escapedMarker}`, "g");
  return [...line.matchAll(markerPattern)].length;
}
