export default {
  id: "ORG117",
  alias: "blanks-around-section-title",
  description: "Section titles should be surrounded by blank lines",
  tags: ["organization", "headings", "whitespace"],
  parser: "text",
  docs: { summary: "Example custom heading-spacing rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (!/^=+\s+\S/.test(line) || index === 0) continue;
        const before = file.lines[index - 1] ?? "";
        const after = file.lines[index + 1] ?? "";
        if (before.trim() !== "" || after.trim() !== "") {
          onError({ severity: "info", message: "Section title should be surrounded by blank lines", range: { start: { file: file.file, line: index + 1, column: 1 } } });
        }
      }
    }
  },
};
