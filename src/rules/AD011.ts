import type { Rule } from "../types.js";

export const AD011: Rule = {
  id: "AD011",
  alias: "image-title",
  description: "Block images should have a title",
  tags: ["core", "image"],
  parser: "document",
  docs: {
    summary: "A block image should have a preceding .Title line.",
    rationale: "Image titles preserve figure intent and make generated output easier to navigate.",
    fixability: "no",
    fixHelper: "Add a figure title using .Title immediately before the image, or set title=\"...\" in the block image macro.",
    badExamples: [{ code: "image::diagram.png[Architecture]" }],
    goodExamples: [{ code: ".Architecture overview\nimage::diagram.png[Architecture]" }],
  },
  function: ({ document }, onError) => {
    for (const block of document.blocks.filter((entry) => entry.type === "image")) {
      if (block.title || hasExemptImageRole(block.attributes.role)) {
        continue;
      }
      onError({
        severity: "warning",
        message: "Block image should have a title",
        range: { start: block.range.start },
        fixHelper: "Add a .Title line, [title=\"...\"], or a title attribute to the image macro.",
      });
    }
  },
};

function hasExemptImageRole(role: string | boolean | undefined): boolean {
  return typeof role === "string" && /\bcover-image\b/i.test(role);
}
