export default {
  id: "ORG120",
  alias: "no-space-in-link-text",
  description: "Link text should not start or end with spaces",
  tags: ["organization", "links", "whitespace"],
  parser: "text",
  docs: { summary: "Example custom link-text whitespace rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const match = line.match(/(?:link|xref):[^\[]+\[(?:\s+[^\]]*|[^\]]*\s+)]|<<[^,>]+,\s+[^>]*>>|<<[^,>]+,[^>]*\s+>>/);
        if (match?.index !== undefined) {
          onError({ severity: "info", message: "Link text has leading or trailing spaces", range: { start: { file: file.file, line: index + 1, column: match.index + 1 } } });
        }
      }
    }
  },
};
