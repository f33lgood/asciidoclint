export default {
  id: "ORG114",
  alias: "no-multiple-blank-lines",
  description: "Documents should not contain multiple consecutive blank lines",
  tags: ["organization", "whitespace"],
  parser: "text",
  docs: { summary: "Example custom blank-line density rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (let index = 1; index < file.lines.length; index += 1) {
        if ((file.lines[index] ?? "").trim() === "" && (file.lines[index - 1] ?? "").trim() === "") {
          onError({ severity: "info", message: "Multiple consecutive blank lines", range: { start: { file: file.file, line: index + 1, column: 1 } } });
        }
      }
    }
  },
};
