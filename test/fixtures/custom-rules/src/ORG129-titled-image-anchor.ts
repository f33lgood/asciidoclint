function hasExplicitId(id: string | boolean | undefined): boolean {
  return typeof id === "string" ? id.trim().length > 0 : id === true;
}

export default {
  id: "ORG129",
  alias: "titled-image-anchor",
  description: "Titled images should have explicit anchors",
  tags: ["organization", "image", "references"],
  parser: "document",
  docs: {
    summary: "Example custom rule requiring explicit IDs on titled images.",
    fixability: "no",
    fixHelper: "Add an explicit ID such as [#fig-name], [[fig-name]], [id=fig-name], or id=fig-name on the block image macro.",
  },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const block of document.blocks.filter((entry: any) => entry.type === "image")) {
      if (!block.title || hasExplicitId(block.attributes.id)) {
        continue;
      }
      onError({
        severity: "info",
        message: "Titled image should have an explicit anchor",
        range: { start: { file: block.range.start.file, line: block.range.start.line, column: 1 } },
        fixHelper: "Add an explicit ID only if this image is expected to be referenced.",
      });
    }
  },
};
