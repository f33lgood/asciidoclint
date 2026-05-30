import type { Rule } from "../types.js";

export const AD026: Rule = {
  id: "AD026",
  alias: "missing-xref",
  description: "Cross-reference targets should resolve to an anchor or file",
  tags: ["dependencies", "xref"],
  parser: "dependency",
  docs: {
    summary: "xref and shorthand cross references should resolve to a known local anchor or file.",
    badExamples: [{ code: "xref:missing-section[]\n\nSee <<missing-section>>." }],
    goodExamples: [{ code: "[[overview]]\n== Overview\n\nxref:overview[]\n\nSee <<Overview>>." }],
    fixability: "no",
    fixHelper: "Create the referenced anchor/file or fix the xref target.",
  },
  function: ({ dependencies }, onError) => {
    for (const record of dependencies.records) {
      if (record.type === "xref" && record.status === "missing") {
        onError({
          severity: "error",
          message: `Missing xref target: ${record.target}`,
          range: record.range,
          fixHelper: "Create the referenced anchor/file or fix the xref target.",
        });
      }
    }
  },
};
