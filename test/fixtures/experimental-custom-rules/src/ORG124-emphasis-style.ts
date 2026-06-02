export default {
  id: "ORG124",
  alias: "emphasis-style",
  description: "Emphasis should use organization-preferred markers",
  tags: ["organization", "inline", "style"],
  parser: "text",
  docs: { summary: "Example custom inline emphasis style rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(/(^|\s)_[^_\s][^_]*_\b/);
        if (match?.index !== undefined) {
          onError({ severity: "info", message: "Use * markers for emphasis in this organization", range: { start: { file: file.file, line: index + 1, column: match.index + 1 } } });
        }
      }
    }
  },
};
