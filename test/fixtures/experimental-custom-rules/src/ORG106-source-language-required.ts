export default {
  id: "ORG106",
  alias: "source-language-required",
  description: "Source blocks should declare a language in this organization",
  tags: ["organization", "code"],
  parser: "text",
  docs: { summary: "Example custom source-block metadata rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (line.trim() === "[source]") {
          onError({
            severity: "info",
            message: "Source block should declare a language",
            range: { start: { file: file.file, line: index + 1, column: 1 } },
          });
        }
      }
    }
  },
};
