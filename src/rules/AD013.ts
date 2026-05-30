import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

export const AD013: Rule = {
  id: "AD013",
  alias: "standalone-inline-image",
  description: "Standalone image macros should use block image syntax",
  tags: ["core", "image"],
  parser: "text",
  docs: {
    summary: "A line containing only an inline image macro should be written as a block image macro.",
    rationale: "Standalone inline image macros can render with paragraph spacing and caption behavior that differs from figures.",
    fixability: "unsafe",
    fixHelper: "Use image::target[alt] for standalone figures, and reserve image:target[alt] for inline images inside text.",
    badExamples: [{ code: "image:diagram.png[Architecture]" }],
    goodExamples: [{ code: "image::diagram.png[Architecture]" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(/^image:(?!:)(\S.*\[[^\]]*]\s*)$/);
        if (!match || isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        const lineNumber = index + 1;
        onError({
          severity: "warning",
          message: "Standalone image macro should use block image syntax",
          range: { start: { file: file.file, line: lineNumber, column: 1 } },
          fix: {
            applicability: "unsafe",
            edits: [{
              file: file.file,
              range: {
                start: { file: file.file, line: lineNumber, column: 7 },
                end: { file: file.file, line: lineNumber, column: 7 },
              },
              replacement: ":",
            }],
          },
        });
      }
    }
  },
};
