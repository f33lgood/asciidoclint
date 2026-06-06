import type { Rule } from "../types.js";
import { isLineInProtectedBlock } from "./utils.js";

const importedAnchorCaptionPattern = /^\s*\[#_(?:Toc|Ref|Hlk)\d+\s+\.anchor\]#{2,6}(Figure|Table)\s+(\d+(?:[-.\u2010-\u2015]\d+)*|[-\u2010-\u2015])?(?:\s*[.:]\s*|\s+)?(\S.*)?$/i;

export const AD055: Rule = {
  id: "AD055",
  alias: "docx-anchor-caption-residue",
  description: "DOCX anchor caption residue should be converted to AsciiDoc titles",
  tags: ["cleanup", "conversion", "docx"],
  parser: "text",
  docs: {
    summary: "Imported anchor-caption residue should not render as visible paragraph text.",
    rationale: "DOCX-to-AsciiDoc conversion can leave bookmark IDs and caption text in one source line. Asciidoctor renders that line as paragraph text instead of a figure or table title.",
    fixability: "no",
    fixHelper: "Replace the generated bookmark with a semantic anchor and convert the caption text to a meaningful .Title line immediately before the corresponding figure or table.",
    badExamples: [{ code: "[#_Toc142906677 .anchor]####Figure 3-1. Overview details" }],
    goodExamples: [{ code: "[#fig-overview-details]\n.Overview details\nimage::overview.png[Overview details]" }],
  },
  function: ({ document }, onError) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(importedAnchorCaptionPattern);
        if (!match || isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }
        const kind = titleCase(match[1] ?? "caption");
        const title = (match[3] ?? "").trim();
        const titleGuidance = title
          ? `.${title}`
          : "a meaningful .Title derived from nearby prose or the corresponding figure/table purpose";
        onError({
          severity: "warning",
          message: `${kind} caption contains DOCX anchor residue`,
          range: { start: { file: file.file, line: index + 1, column: line.search(/\S/) + 1 } },
          fixHelper: `Use a semantic anchor such as [#${kind === "Figure" ? "fig" : "table"}-meaningful-id] and ${titleGuidance} immediately before the corresponding ${kind.toLowerCase()} block; remove the generated _Toc/_Ref bookmark and #### marker. Preserve meaningful caption text when present and do not use the generated ${kind} number as the title.`,
        });
      }
    }
  },
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
