import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

const docxBookmarkHashResiduePattern = /\[#_(?:Toc|Ref|Hlk)\d+\s+\.anchor\]#{2,6}(?!#)\s*(?!(?:Figure|Table)\b)([^|\n]*)/i;

export const AD058: Rule = {
  id: "AD058",
  alias: "docx-bookmark-hash-residue",
  description: "DOCX bookmark/hash residue should be cleaned up",
  tags: ["cleanup", "conversion", "docx"],
  parser: "text",
  docs: {
    summary: "Imported bookmark and hash residue should not remain in ordinary list items, table cells, or paragraphs.",
    rationale: "DOCX-to-AsciiDoc conversion can leave generated bookmark IDs, the .anchor role, and hash characters in source text. Outside Figure/Table captions, the residue renders as noisy visible text or table-cell content instead of meaningful AsciiDoc structure.",
    fixability: "no",
    fixHelper: "Remove the generated _Toc/_Ref/_Hlk bookmark, .anchor role, and #### marker. Preserve the meaningful text as plain text, a table-cell value, a block title, or a semantic anchor only when it is actually referenced.",
    badExamples: [{ code: "|[#_Toc142906710 .anchor]####Requirement summary |" }],
    goodExamples: [{ code: "|Requirement summary |" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(docxBookmarkHashResiduePattern);
        if (!match || isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        onError({
          severity: "warning",
          message: "Line contains DOCX bookmark/hash residue",
          range: { start: { file: file.file, line: index + 1, column: (match.index ?? 0) + 1 } },
          fixHelper: "Remove the generated bookmark, .anchor role, and #### marker; keep the meaningful text in the appropriate AsciiDoc structure.",
        });
      }
    }
  },
};
