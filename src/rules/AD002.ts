import type { Rule } from "../types.js";

export const AD002: Rule = {
  id: "AD002",
  alias: "single-document-title",
  description: "Article documents should have only one level-0 title",
  tags: ["core", "headings"],
  parser: "document",
  docs: {
    summary: "Only book documents may have multiple level-0 sections.",
    fixability: "no",
    fixHelper: "In article documents, change the extra level-0 heading to the appropriate section level, or change the document to :doctype: book only when the extra level-0 headings are intended to be book parts.",
    badExamples: [{ code: "= Title\n\n= Second Title" }],
    goodExamples: [
      { code: "= Title\n\n== Section" },
      { code: ":doctype: book\n\n= Book\n\n= Part One\n\n== Chapter" },
    ],
  },
  function: ({ parserDiagnostics }, onError) => {
    for (const diagnostic of parserDiagnostics.filter(isExtraLevelZeroDiagnostic)) {
      onError({
        severity: "error",
        message: "Multiple level-0 document titles found",
        range: diagnostic.range,
        fixHelper: "In article documents, change the extra level-0 heading to the appropriate section level, or change the document to :doctype: book only when the extra level-0 headings are intended to be book parts.",
      });
    }
  },
};

function isExtraLevelZeroDiagnostic(finding: { ruleId?: string; message: string }): boolean {
  return finding.ruleId === "AD000" && /level 0 sections can only be used when doctype is book/i.test(finding.message);
}
