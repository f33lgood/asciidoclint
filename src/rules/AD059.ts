import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

const tableMetadataPattern = /^\s*(?:\[[^\]]*(?:cols|options|width|frame|grid|format|separator)\s*=|\.[^\s.])/i;
const tableDelimiterPattern = /^\s*([|!,/:])={3,}\s*$/;

export const AD059: Rule = {
  id: "AD059",
  alias: "docx-nested-table-structure",
  description: "DOCX-converted nested tables should use valid nested table separators and shallow nesting",
  tags: ["cleanup", "conversion", "docx", "pandoc", "table"],
  parser: "text",
  docs: {
    summary: "DOCX/Pandoc nested table residue should not break AsciiDoc table boundaries.",
    rationale: "Older DOCX-to-AsciiDoc conversion can emit a nested table with the same `|===` delimiter as the containing table. Asciidoctor treats the inner delimiter as the outer table boundary, so the nested table renders as broken or stray tables. Deep table nesting is also fragile in Asciidoctor.js output.",
    fixability: "no",
    fixHelper: "If this is a nested table, convert the nested table to an alternate separator such as `!===` and change its cell markers from `|` to `!`. For nesting deeper than three table levels, flatten the deepest table into a list or split it into a separate titled table.",
    badExamples: [{ code: "[cols=\"1,1\"]\n|===\n|Outer a|\n[cols=\"1,1\"]\n|===\n|Nested |Broken\n|===\n|===" }],
    goodExamples: [{ code: "[cols=\"1,1\"]\n|===\n|Outer a|\n[cols=\"1,1\"]\n!===\n!Nested !Valid\n!===\n|===" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      const stack: TableContext[] = [];
      for (let index = 0; index < file.lines.length; index += 1) {
        const line = file.lines[index] ?? "";
        if (isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        const delimiter = parseTableDelimiter(line);
        if (!delimiter) {
          if (stack.length && isTableCellLine(line, stack[stack.length - 1]?.marker ?? "|")) {
            stack[stack.length - 1]!.hasTableCell = true;
          }
          continue;
        }

        const top = stack[stack.length - 1];
        if (top && delimiter.marker === top.marker) {
          if (top.hasTableCell && isNestedTableOpening(file.lines, index) && hasAsciiDocTableCellContext(file.lines, index, top.marker)) {
            onError({
              severity: "warning",
              message: "Nested table appears to use the same separator as its containing table",
              range: { start: { file: file.file, line: index + 1, column: 1 } },
              fixHelper: "Convert this nested table to an alternate separator such as `!===`, and change the nested table cell markers from `|` to `!`. Remove any stray standalone `|` left after an already-spanning `a|` row if Asciidoctor omits it.",
            });
          }
          stack.pop();
          continue;
        }

        if (top && isNestedTableOpening(file.lines, index) && stack.length + 1 > 3) {
          onError({
            severity: "warning",
            message: "Nested table depth exceeds three table levels",
            range: { start: { file: file.file, line: index + 1, column: 1 } },
            fixHelper: "Flatten this deeply nested table into a list, move it to a separate titled table, or otherwise reduce table nesting to three total levels or fewer.",
          });
        }
        stack.push({ marker: delimiter.marker, hasTableCell: false });
      }
    }
  },
};

interface TableContext {
  marker: string;
  hasTableCell: boolean;
}

function parseTableDelimiter(line: string): { marker: string } | undefined {
  const match = line.match(tableDelimiterPattern);
  return match ? { marker: match[1] ?? "|" } : undefined;
}

function isNestedTableOpening(lines: string[], delimiterIndex: number): boolean {
  for (let index = delimiterIndex - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    if (line.trim() === "") {
      continue;
    }
    return tableMetadataPattern.test(line);
  }
  return false;
}

function hasAsciiDocTableCellContext(lines: string[], delimiterIndex: number, marker: string): boolean {
  const escapedMarker = escapeRegExp(marker);
  const cellContextPattern = new RegExp(`(?:^|\\s)(?:\\d+\\+)?a${escapedMarker}\\s*$`);
  const otherCellStartPattern = new RegExp(`^(?:\\d+\\+)?[a-z]?${escapedMarker}`);

  for (let index = delimiterIndex - 1; index >= 0; index -= 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (trimmed === "" || tableMetadataPattern.test(line)) {
      continue;
    }
    if (cellContextPattern.test(trimmed)) {
      return true;
    }
    if (parseTableDelimiter(line) || otherCellStartPattern.test(trimmed)) {
      return false;
    }
  }
  return false;
}

function isTableCellLine(line: string, marker: string): boolean {
  const trimmed = line.trim();
  const escapedMarker = escapeRegExp(marker);
  return new RegExp(`^(?:\\d+\\+)?[a-z]?${escapedMarker}`).test(trimmed);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
