export default {
  id: "ORG127",
  alias: "no-fake-definition-list",
  description: "Definition-like paragraphs should use AsciiDoc definition-list syntax",
  tags: ["organization", "conversion", "lists"],
  parser: "text",
  docs: { summary: "Example custom conversion-cleanup rule for fake definition lists." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (/^\s*[A-Z][A-Za-z0-9 _/-]{1,40}:\s+\S/.test(line) && !/::/.test(line)) {
          onError({
            severity: "info",
            message: "Use AsciiDoc definition-list syntax instead of a fake definition paragraph",
            range: { start: { file: file.file, line: index + 1, column: 1 } },
          });
        }
      }
    }
  },
};
