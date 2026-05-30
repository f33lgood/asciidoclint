export default {
  id: "ORG112",
  alias: "list-indent-consistency",
  description: "List items at the same marker depth should use consistent indentation",
  tags: ["organization", "lists", "whitespace"],
  parser: "text",
  docs: { summary: "Example custom list indentation rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      const indentByMarker = new Map<string, number>();
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(/^(\s*)([*.-]+)\s+\S/);
        if (!match) continue;
        const marker = match[2] ?? "";
        const indent = (match[1] ?? "").length;
        const expected = indentByMarker.get(marker);
        if (expected === undefined) {
          indentByMarker.set(marker, indent);
        } else if (expected !== indent) {
          onError({ severity: "info", message: "List indentation is inconsistent for this marker depth", range: { start: { file: file.file, line: index + 1, column: 1 } } });
        }
      }
    }
  },
};
