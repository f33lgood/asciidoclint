import type { Rule } from "../types.js";
import { isExemptBeforeListLine, isLineComment, isLineInProtectedBlock, isLineInTableBlock, isListMarkerLine } from "./utils.js";

export const AD008: Rule = {
  id: "AD008",
  alias: "blank-before-list",
  description: "Lists should be separated from preceding paragraph text",
  tags: ["core", "lists", "blank_lines"],
  parser: "text",
  docs: {
    summary: "A list should have a blank line before the first list item unless it follows another structural line.",
    rationale: "Without a blank line, Asciidoctor treats a would-be list marker after paragraph text as paragraph continuation text, so the intended list is not created.",
    fixability: "safe",
    fixHelper: "Insert one blank line before the list marker.",
    badExamples: [{ code: "Paragraph\n* item" }],
    goodExamples: [{ code: "Paragraph\n\n* item" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (let index = 1; index < file.lines.length; index += 1) {
        const line = file.lines[index] ?? "";
        if (isLineComment(line)
          || !isListMarkerLine(line)
          || isIndentedListMarkerLine(line)
          || isLineInProtectedBlock(document, file.file, index + 1)
          || isLineInTableBlock(document, file.file, index + 1)) {
          continue;
        }
        const previous = file.lines[index - 1] ?? "";
        if (isExemptBeforeListLine(previous)) {
          continue;
        }
        if (hasTableCellContextBefore(file.lines, index)) {
          continue;
        }
        if (hasContinuationContextBefore(file.lines, index)) {
          continue;
        }
        const lineNumber = index + 1;
        onError({
          severity: "warning",
          message: "List should be preceded by a blank line",
          range: { start: { file: file.file, line: lineNumber, column: 1 } },
          fix: {
            applicability: "safe",
            edits: [{
              file: file.file,
              range: {
                start: { file: file.file, line: lineNumber, column: 1 },
                end: { file: file.file, line: lineNumber, column: 1 },
              },
              replacement: "\n",
            }],
          },
        });
      }
    }
  },
};

function hasContinuationContextBefore(lines: string[], index: number): boolean {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const trimmed = (lines[cursor] ?? "").trim();
    if (trimmed === "") {
      return false;
    }
    if (trimmed === "+") {
      return true;
    }
    if (isListMarkerLine(lines[cursor] ?? "")) {
      return true;
    }
  }
  return false;
}

function isIndentedListMarkerLine(line: string): boolean {
  return /^\s+\S/.test(line);
}

function hasTableCellContextBefore(lines: string[], index: number): boolean {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const trimmed = (lines[cursor] ?? "").trim();
    if (trimmed === "") {
      continue;
    }
    if (/^a\|/.test(trimmed) || /(^|\s)a\|\s*$/.test(trimmed) || /\sa\|\s*\S*$/.test(trimmed)) {
      return true;
    }
    return false;
  }
  return false;
}
