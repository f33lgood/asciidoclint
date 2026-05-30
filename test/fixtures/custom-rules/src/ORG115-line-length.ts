export default {
  id: "ORG115",
  alias: "line-length",
  description: "Lines should stay within the organization line-length limit",
  tags: ["organization", "formatting"],
  parser: "text",
  docs: { summary: "Example custom line-length rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (line.length > 100) {
          onError({ severity: "info", message: "Line exceeds 100 characters", range: { start: { file: file.file, line: index + 1, column: 101 } } });
        }
      }
    }
  },
};
