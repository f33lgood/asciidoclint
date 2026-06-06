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
    fixHelper: "Add a meaningful diagram title using .Title immediately before the diagram block metadata, or set title=\"...\" in the diagram attribute list. Derive the title from nearby caption text, section context, or the diagram purpose; do not use generic placeholders such as .Diagram.",
    badExamples: [{ code: "[mermaid]\n----\ngraph LR\n----" }],
    goodExamples: [{ code: ".System flow\n[mermaid]\n----\ngraph LR\n----" }],
  },
  function: ({ document }, onError) => {
    for (const block of document.blocks.filter((entry) => entry.type === "diagram")) {
      if (isPlaceholderDiagramTitle(block.title)) {
        onError({
          severity: "warning",
          message: "Diagram title is a generic placeholder",
          range: { start: block.range.start },
          fixHelper: "Replace the placeholder with a meaningful diagram title derived from nearby caption text, section context, or the diagram purpose.",
        });
        continue;
      }
      if (block.title) {
        continue;
      }
      onError({
        severity: "warning",
        message: "Diagram block should have a title",
        range: { start: block.range.start },
        fixHelper: "Add a meaningful .Title line or title=\"...\" metadata to the diagram block; do not use generic placeholders such as .Diagram.",
      });
    }
  },
};

function isPlaceholderDiagramTitle(title: string | undefined): boolean {
  return typeof title === "string" && /^(?:diagram|diagram\s+diagram)$/i.test(title.trim());
}
