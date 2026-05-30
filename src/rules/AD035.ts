import type { Rule } from "../types.js";
import { blockDelimiterType, isAsciiDocAnchorLine, isAsciiDocBlockAttributeLine, isAsciiDocTitleLine, isBlockDelimiter, isLineComment, isLineInProtectedBlock, isLineInTableBlock, isListMarkerLine } from "./utils.js";

export const AD035: Rule = {
  id: "AD035",
  alias: "blank-after-block",
  description: "Structural block delimiters should be followed by a blank line",
  tags: ["cleanup", "blocks"],
  parser: "text",
  docs: {
    summary: "Delimited blocks are easier to parse and read when separated from following paragraph text.",
    fixability: "safe",
    badExamples: [{ code: "====\nexample\n====\nText" }],
    goodExamples: [{ code: "====\nexample\n====\n\nText" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      const openDelimiters: string[] = [];
      for (let index = 0; index < file.lines.length - 1; index += 1) {
        const line = file.lines[index] ?? "";
        const next = file.lines[index + 1] ?? "";
        const delimiter = line.trim();
        if (!isBlockDelimiter(delimiter)) {
          continue;
        }
        const delimiterType = blockDelimiterType(delimiter);
        if (isLineInProtectedBlock(document, file.file, index + 1) || isLineInTableBlock(document, file.file, index + 1)) {
          continue;
        }
        const isClosing = openDelimiters[openDelimiters.length - 1] === delimiter;
        if (!isClosing) {
          openDelimiters.push(delimiter);
          continue;
        }
        openDelimiters.pop();
        if (delimiterType === "table" && isTableCellLine(next, delimiter)) {
          continue;
        }
        if (next.trim() === ""
          || next.trim() === "+"
          || next.trim() === "{nbsp}"
          || /^=+\s+\S/.test(next.trim())
          || isBlockDelimiter(next.trim())
          || isListMarkerLine(next)
          || isLineComment(next)
          || isConditionalDirective(next)
          || isAsciiDocAnchorLine(next)
          || isAsciiDocTitleLine(next)
          || isAsciiDocBlockAttributeLine(next)) {
          continue;
        }
        const lineNumber = index + 1;
        onError({
          severity: "warning",
          message: "Block delimiter should be followed by a blank line",
          range: { start: { file: file.file, line: lineNumber, column: line.length + 1 } },
          fix: {
            applicability: "safe",
            edits: [{
              file: file.file,
              range: {
                start: { file: file.file, line: lineNumber + 1, column: 1 },
                end: { file: file.file, line: lineNumber + 1, column: 1 },
              },
              replacement: "\n",
            }],
          },
        });
      }
    }
  },
};

function isTableCellLine(line: string, delimiter = "|==="): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith(delimiter[0] ?? "|") && trimmed !== delimiter;
}

function isConditionalDirective(line: string): boolean {
  return /^(?:ifdef|ifndef|ifeval|endif)::/.test(line.trim());
}
