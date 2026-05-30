export default {
  id: "ORG122",
  alias: "single-trailing-newline",
  description: "Files should end with a single newline",
  tags: ["organization", "whitespace"],
  parser: "text",
  docs: { summary: "Example custom final-newline formatting rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      if (file.lines[file.lines.length - 1] !== "") {
        onError({ severity: "info", message: "File should end with a newline", range: { start: { file: file.file, line: file.lines.length, column: (file.lines[file.lines.length - 1] ?? "").length + 1 } } });
      }
    }
  },
};
