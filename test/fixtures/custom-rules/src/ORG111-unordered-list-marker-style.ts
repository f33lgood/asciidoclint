export default {
  id: "ORG111",
  alias: "unordered-list-marker-style",
  description: "Unordered lists should use the organization-preferred marker",
  tags: ["organization", "lists"],
  parser: "text",
  docs: { summary: "Example custom list marker style rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (/^\s*[-+]\s+\S/.test(line)) {
          onError({ severity: "info", message: "Use * for unordered list markers", range: { start: { file: file.file, line: index + 1, column: 1 } } });
        }
      }
    }
  },
};
