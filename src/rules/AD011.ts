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
    fixHelper: "Add a meaningful figure title using .Title immediately before the image, or set title=\"...\" in the block image macro. Derive the title from nearby caption text, section context, image alt text, or the image purpose; do not use generic placeholders such as .Figure or .Image.",
    badExamples: [{ code: "image::diagram.png[Overview]" }],
    goodExamples: [{ code: ".Overview details\nimage::diagram.png[Overview]" }],
  },
  function: ({ document }, onError) => {
    for (const block of document.blocks.filter((entry) => entry.type === "image")) {
      if (hasExemptImageRole(block.attributes.role)) {
        continue;
      }
      if (isPlaceholderImageTitle(block.title)) {
        onError({
          severity: "warning",
          message: "Image title is a generic placeholder",
          range: { start: block.range.start },
          fixHelper: "Replace the placeholder with a meaningful figure title derived from nearby caption text, section context, image alt text, or the image purpose.",
        });
        continue;
      }
      if (block.title) {
        continue;
      }
      onError({
        severity: "warning",
        message: "Block image should have a title",
        range: { start: block.range.start },
        fixHelper: "Add a meaningful .Title line, [title=\"...\"], or title attribute to the image macro; do not use generic placeholders such as .Figure or .Image.",
      });
    }
  },
};

function hasExemptImageRole(role: string | boolean | undefined): boolean {
  return typeof role === "string" && /\bcover-image\b/i.test(role);
}

function isPlaceholderImageTitle(title: string | undefined): boolean {
  return typeof title === "string" && /^(?:image|figure)(?:\s+(?:image|figure))?$/i.test(title.trim());
}
