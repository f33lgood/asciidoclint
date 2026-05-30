export default {
  id: "ORG113",
  alias: "unordered-list-indent-width",
  description: "Nested unordered lists should use two-space indentation",
  tags: ["organization", "lists", "whitespace"],
  parser: "text",
  docs: { summary: "Example custom unordered-list indentation width rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(/^(\s+)[*+-]\s+\S/);
        if (match && (match[1]?.length ?? 0) % 2 !== 0) {
          onError({ severity: "info", message: "Nested unordered list indentation should be a multiple of two spaces", range: { start: { file: file.file, line: index + 1, column: 1 } } });
        }
      }
    }
  },
};
