function finding(file: string, line: number, message: string) {
  return { severity: "warning", message, range: { start: { file, line, column: 1 } } };
}

export default {
  id: "ORG104",
  alias: "no-html-entities",
  description: "Avoid raw HTML entities in organization documentation",
  tags: ["organization", "conversion"],
  parser: "text",
  docs: { summary: "Example custom HTML entity cleanup rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (/&(?:nbsp|amp|lt|gt|quot);/.test(line)) {
          onError(finding(file.file, index + 1, "HTML entity should be replaced with intended AsciiDoc text"));
        }
      }
    }
  },
};
