export default {
  id: "ORG110",
  alias: "no-bare-url",
  description: "Bare URLs should use explicit link text",
  tags: ["organization", "links", "accessibility"],
  parser: "text",
  docs: { summary: "Example custom rule for teams that require descriptive text for URLs." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(/(^|\s)https?:\/\/\S+/);
        if (match?.index !== undefined) {
          onError({
            severity: "info",
            message: "Bare URL should use link:url[text] syntax",
            range: { start: { file: file.file, line: index + 1, column: match.index + 1 } },
          });
        }
      }
    }
  },
};
