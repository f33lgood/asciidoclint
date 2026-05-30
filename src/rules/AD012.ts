import type { Rule } from "../types.js";

export const AD012: Rule = {
  id: "AD012",
  alias: "diagram-title",
  description: "Diagram blocks should have a title",
  tags: ["core", "diagram"],
  parser: "document",
  docs: {
    summary: "A diagram block should have a preceding .Title line.",
    rationale: "Diagram titles make generated figures understandable and referenceable.",
    fixability: "no",
    fixHelper: "Add a diagram title using .Title immediately before the diagram block metadata, or set title=\"...\" in the diagram attribute list.",
    badExamples: [{ code: "[mermaid]\n----\ngraph LR\n----" }],
    goodExamples: [{ code: ".System flow\n[mermaid]\n----\ngraph LR\n----" }],
  },
  function: ({ document }, onError) => {
    for (const block of document.blocks.filter((entry) => entry.type === "diagram")) {
      if (block.title) {
        continue;
      }
      onError({
        severity: "warning",
        message: "Diagram block should have a title",
        range: { start: block.range.start },
        fixHelper: "Add a .Title line or title=\"...\" metadata to the diagram block.",
      });
    }
  },
};
