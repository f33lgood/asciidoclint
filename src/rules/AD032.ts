import type { Rule } from "../types.js";
import {
  blockDelimiterType,
  isAsciiDocAnchorLine,
  isAsciiDocBlockAttributeLine,
  isAsciiDocSectionTitleLine,
  isAsciiDocTitleLine,
  isBlockDelimiter,
  isLineInProtectedBlock,
} from "./utils.js";

export const AD032: Rule = {
  id: "AD032",
  alias: "blank-before-block",
  description: "Structural block delimiters should be preceded by a blank line",
  tags: ["cleanup", "blocks"],
  parser: "text",
  docs: {
    summary: "Delimited blocks should be separated from preceding text so Asciidoctor can parse the intended block boundary.",
    fixability: "safe",
    badExamples: [{ code: "Text\n====\nexample\n====" }],
    goodExamples: [{ code: "Text\n\n====\nexample\n====" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      const openDelimiters: string[] = [];
      for (let index = 1; index < file.lines.length; index += 1) {
        const line = file.lines[index] ?? "";
        const previous = file.lines[index - 1] ?? "";
        const delimiter = line.trim();
        if (!isBlockDelimiter(delimiter)) {
          continue;
        }
        const delimiterType = blockDelimiterType(delimiter);
        if (isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        if (delimiterType === "table" && isKnownTableClosingDelimiter(document, file.file, index + 1)) {
          continue;
        }
        if (delimiterType === "table" && isTableCellLine(previous, delimiter)) {
          continue;
        }
        const isClosing = openDelimiters[openDelimiters.length - 1] === delimiter;
        if (isClosing) {
          openDelimiters.pop();
          continue;
        }
        openDelimiters.push(delimiter);
        if (previous.trim() !== ""
          && !isBlockDelimiter(previous.trim())
          && previous.trim() !== "+"
          && !isAsciiDocBlockAttributeLine(previous)
          && !isAsciiDocTitleLine(previous)
          && !isAsciiDocSectionTitleLine(previous)
          && !isAsciiDocAnchorLine(previous)) {
          const lineNumber = index + 1;
          const severity = canBeParsedAsSetextSectionDelimiter(delimiter) ? "error" : "warning";
          onError({
            severity,
            message: "Block delimiter should be preceded by a blank line",
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
    }
  },
};

function isTableCellLine(line: string, delimiter = "|==="): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith(delimiter[0] ?? "|") && trimmed !== delimiter;
}

function isKnownTableClosingDelimiter(document: Parameters<Rule["function"]>[0]["document"], file: string, line: number): boolean {
  return document.blocks.some((block) => (
    block.type === "table"
    && block.range.end?.file === file
    && block.range.end.line === line
  ));
}

function canBeParsedAsSetextSectionDelimiter(delimiter: string): boolean {
  return /^={4,}$/.test(delimiter) || /^-{4,}$/.test(delimiter) || /^\+{4,}$/.test(delimiter);
}
