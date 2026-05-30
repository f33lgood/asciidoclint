import type { Rule } from "../types.js";

export const AD001: Rule = {
  id: "AD001",
  alias: "heading-level-progression",
  description: "Section headings must not skip levels",
  tags: ["core", "headings"],
  parser: "document",
  docs: {
    summary: "A heading should advance by at most one level from the previous heading.",
    rationale: "Skipped levels usually indicate a broken document hierarchy.",
    fixability: "no",
    fixHelper: "Add the missing intermediate parent section, or reduce the skipped heading marker so the section advances by only one level from the previous section.",
    badExamples: [{ code: "= Title\n\n=== Skipped" }],
    goodExamples: [{ code: "= Title\n\n== Parent\n\n=== Child" }],
  },
  function: ({ parserDiagnostics }, onError) => {
    for (const diagnostic of parserDiagnostics.filter(isOutOfSequenceDiagnostic)) {
      onError({
        severity: "error",
        message: `Skipped section level: ${diagnostic.message}`,
        range: diagnostic.range,
        fixHelper: "Add the missing intermediate parent section, or reduce the skipped heading marker so the section advances by only one level from the previous section.",
      });
    }
  },
};

function isOutOfSequenceDiagnostic(finding: { ruleId?: string; message: string }): boolean {
  return finding.ruleId === "AD000" && /section title out of sequence/i.test(finding.message);
}
