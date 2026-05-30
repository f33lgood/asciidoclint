import fs from "node:fs";
import type { Rule } from "../types.js";
import { isAsciiDocAnchorLine, isAsciiDocAttributeEntryLine, isAsciiDocBlockAttributeLine, isBlockDelimiter, isLineComment, isLineInProtectedBlock } from "./utils.js";

export const AD019: Rule = {
  id: "AD019",
  alias: "content-after-include",
  description: "Text should not be attached directly after include directives",
  tags: ["core", "structure", "includes"],
  parser: "text",
  docs: {
    summary: "A paragraph immediately after an include directive can accidentally attach to included content.",
    rationale: "A section boundary or blank-separated block after an include keeps merged documents predictable.",
    badExamples: [{ code: "include::chapter.adoc[]\nThis paragraph attaches unexpectedly." }],
    goodExamples: [{ code: "include::chapter.adoc[]\n\n== Next Section\n\nThis paragraph is separate." }],
    fixability: "no",
    fixHelper: "Insert a blank line after the include directive or ensure the included file ends with a blank line.",
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (!/^include::[^\[]+\[[^\]]*]\s*$/.test(line.trim()) || isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        const include = document.includes.find((record) => record.range.start.file === file.file && record.range.start.line === index + 1);
        if (include && (include.attributes.tag !== undefined || include.attributes.tags !== undefined || include.attributes.lines !== undefined)) {
          continue;
        }
        if (include?.resolvedTarget && includedFileEndsWithBlankLine(include.resolvedTarget)) {
          continue;
        }
        const next = file.lines[index + 1] ?? "";
        if (
          next.trim() === ""
          || /^include::[^\[]+\[[^\]]*]\s*$/.test(next.trim())
          || isBlockDelimiter(next.trim())
          || isLineComment(next)
          || isAsciiDocAnchorLine(next)
          || isAsciiDocAttributeEntryLine(next)
          || isAsciiDocBlockAttributeLine(next)
        ) {
          continue;
        }
        onError({
          severity: "warning",
          message: "Content immediately after include should start a clear block or section",
          range: { start: { file: file.file, line: index + 2, column: 1 } },
          fixHelper: "Insert a blank line after the include directive or ensure the included file ends with a blank line.",
        });
      }
    }
  },
};

function includedFileEndsWithBlankLine(file: string): boolean {
  try {
    const content = fs.readFileSync(file, "utf8");
    return /\r?\n\s*\r?\n\s*$/.test(content);
  } catch {
    return false;
  }
}
