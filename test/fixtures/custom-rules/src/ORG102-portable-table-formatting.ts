function finding(file: string, line: number, message: string, severity = "warning") {
  return { severity, message, range: { start: { file, line, column: 1 } } };
}

export default {
  id: "ORG102",
  alias: "portable-table-formatting",
  description: "Tables should declare organization-preferred formatting attributes",
  tags: ["organization", "table"],
  parser: "text",
  docs: { summary: "Example custom table formatting rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (line.trim() === "|===" && !(file.lines[index - 1] ?? "").includes('options="header"')) {
          onError(finding(file.file, index + 1, "Table should declare organization formatting attributes", "info"));
          break;
        }
      }
    }
  },
};
