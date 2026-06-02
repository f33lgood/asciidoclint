export default {
  id: "ORG125",
  alias: "strong-style",
  description: "Strong text should use organization-preferred markers",
  tags: ["organization", "inline", "style"],
  parser: "text",
  docs: { summary: "Example custom strong text style rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(/\*\*[^*\s][^*]*\*\*/);
        if (match?.index !== undefined) {
          onError({ severity: "info", message: "Use constrained *strong* markers in this organization", range: { start: { file: file.file, line: index + 1, column: match.index + 1 } } });
        }
      }
    }
  },
};
