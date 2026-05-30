export default {
  id: "ORG109",
  alias: "no-inline-html",
  description: "Raw inline HTML should not be used in this organization",
  tags: ["organization", "html", "conversion"],
  parser: "text",
  docs: { summary: "Example custom rule for teams that disallow raw HTML in AsciiDoc." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(/<\/?[a-z][^>]*>/i);
        if (match?.index !== undefined) {
          onError({
            severity: "info",
            message: "Raw inline HTML should be replaced with AsciiDoc syntax",
            range: { start: { file: file.file, line: index + 1, column: match.index + 1 } },
          });
        }
      }
    }
  },
};
