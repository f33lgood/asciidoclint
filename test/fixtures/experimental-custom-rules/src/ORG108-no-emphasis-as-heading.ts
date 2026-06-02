export default {
  id: "ORG108",
  alias: "no-emphasis-as-heading",
  description: "Standalone emphasized text should not be used as a heading",
  tags: ["organization", "headings", "conversion"],
  parser: "text",
  docs: { summary: "Example custom conversion-cleanup rule for heading-like emphasis." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (/^\s*(?:\*[^*]+\*|_[^_]+_)\s*$/.test(line)) {
          onError({
            severity: "info",
            message: "Use an AsciiDoc section title instead of standalone emphasis",
            range: { start: { file: file.file, line: index + 1, column: 1 } },
          });
        }
      }
    }
  },
};
