export default {
  id: "ORG121",
  alias: "proper-names",
  description: "Configured proper names should use preferred capitalization",
  tags: ["organization", "style"],
  parser: "text",
  docs: { summary: "Example custom terminology capitalization rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(/\b(?:examplecorp|asciidoc)\b/);
        if (match?.index !== undefined) {
          onError({ severity: "info", message: "Proper name should use preferred capitalization", range: { start: { file: file.file, line: index + 1, column: match.index + 1 } } });
        }
      }
    }
  },
};
