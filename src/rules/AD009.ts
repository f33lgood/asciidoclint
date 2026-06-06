import type { Rule } from "../types.js";
import { isAsciiDocAnchorLine, isAsciiDocSectionTitleLine, isAsciiDocTitleLine, isLineInProtectedBlock, isLineInTableBlock, isListMarkerLine } from "./utils.js";

export const AD009: Rule = {
  id: "AD009",
  alias: "blank-after-list",
  description: "Lists should be separated from following structural blocks",
  tags: ["core", "lists", "blank_lines", "structure"],
  parser: "text",
  docs: {
    summary: "A section title or other structural block start should not immediately follow list content.",
    rationale: "Without a blank line, Asciidoctor can treat section titles, anchors, block titles, and block image macros as continuation text inside the previous list item. The intended heading or block then disappears from the rendered document structure.",
    fixability: "safe",
    fixHelper: "Insert one blank line before the structural line that follows the list.",
    badExamples: [{ code: "* item\n== Next section" }],
    goodExamples: [{ code: "* item\n\n== Next section" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (let index = 1; index < file.lines.length; index += 1) {
        const line = file.lines[index] ?? "";
        if (!isDangerousStructuralLine(line)
          || isLineInProtectedBlock(document, file.file, index + 1)
          || isLineInTableBlock(document, file.file, index + 1)
          || hasDangerousStructuralLineImmediatelyBefore(file.lines, index)
          || !hasUnseparatedListContextBefore(file.lines, index)) {
          continue;
        }

        const lineNumber = index + 1;
        const isSection = isAsciiDocSectionTitleLine(line);
        onError({
          severity: isSection ? "error" : "warning",
          message: isSection
            ? "Section title should be separated from the preceding list"
            : "Structural block start should be separated from the preceding list",
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
          fixHelper: isSection
            ? "Insert one blank line before the section title so it renders as a section instead of list-item text."
            : "Insert one blank line before the structural block start so it renders outside the list.",
        });
      }
    }
  },
};

function isDangerousStructuralLine(line: string): boolean {
  const trimmed = line.trim();
  return isAsciiDocSectionTitleLine(line)
    || isAsciiDocAnchorLine(line)
    || isAsciiDocTitleLine(line)
    || /^image::\S+\[[^\]]*]\s*$/.test(trimmed);
}

function hasUnseparatedListContextBefore(lines: string[], index: number): boolean {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const line = lines[cursor] ?? "";
    const trimmed = line.trim();
    if (trimmed === "") {
      return false;
    }
    if (trimmed === "+") {
      return false;
    }
    if (isListMarkerLine(line)) {
      return true;
    }
  }
  return false;
}

function hasDangerousStructuralLineImmediatelyBefore(lines: string[], index: number): boolean {
  const previous = lines[index - 1] ?? "";
  return previous.trim() !== "" && isDangerousStructuralLine(previous);
}
