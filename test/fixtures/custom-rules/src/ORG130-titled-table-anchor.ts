function hasExplicitId(id: string | boolean | undefined): boolean {
  return typeof id === "string" ? id.trim().length > 0 : id === true;
}

export default {
  id: "ORG130",
  alias: "titled-table-anchor",
  description: "Titled tables should have explicit anchors",
  tags: ["organization", "table", "references"],
  parser: "document",
  docs: {
    summary: "Example custom rule requiring explicit IDs on titled tables.",
    fixability: "no",
    fixHelper: "Add an explicit ID such as [#tab-name], [[tab-name]], [id=tab-name], or id=tab-name in the table attribute list.",
  },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const block of document.blocks.filter((entry: any) => entry.type === "table")) {
      if (!block.title || hasExplicitId(block.attributes.id)) {
        continue;
      }
      onError({
        severity: "info",
        message: "Titled table should have an explicit anchor",
        range: { start: { file: block.range.start.file, line: block.range.start.line, column: 1 } },
        fixHelper: "Add an explicit ID only if this table is expected to be referenced.",
      });
    }
  },
};
