export default {
  id: "ORG119",
  alias: "ordered-list-prefix-style",
  description: "Ordered lists should use organization-preferred dot markers",
  tags: ["organization", "lists"],
  parser: "text",
  docs: { summary: "Example custom ordered-list marker style rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (/^\s*\d+\.\s+\S/.test(line)) {
          onError({ severity: "info", message: "Use . ordered-list markers instead of explicit numbers", range: { start: { file: file.file, line: index + 1, column: 1 } } });
        }
      }
    }
  },
};
