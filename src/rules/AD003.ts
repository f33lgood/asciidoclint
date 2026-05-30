import type { Rule } from "../types.js";

export const AD003: Rule = {
  id: "AD003",
  alias: "unterminated-block",
  description: "Delimited blocks should have matching closing delimiters",
  tags: ["core", "blocks"],
  parser: "document",
  docs: {
    summary: "A delimited block should be closed with the matching delimiter required by Asciidoctor.",
    rationale: "Unterminated blocks can cause large portions of a document to render as the wrong block type.",
    fixability: "no",
    fixHelper: "Add the missing closing delimiter that matches the opener. The correct location depends on where the block content should end.",
    badExamples: [{ code: "====\ncontent" }],
    goodExamples: [{ code: "====\ncontent\n====" }],
  },
  function: ({ parserDiagnostics }, onError) => {
    for (const diagnostic of parserDiagnostics.filter(isUnterminatedBlockDiagnostic)) {
      onError({
        severity: "error",
        message: `Unterminated delimited block: ${diagnostic.message}`,
        range: diagnostic.range,
        fixHelper: "Add the matching closing delimiter for the block.",
      });
    }
  },
};

function isUnterminatedBlockDiagnostic(finding: { ruleId?: string; message: string }): boolean {
  return finding.ruleId === "AD000" && /unterminated .*block/i.test(finding.message);
}
