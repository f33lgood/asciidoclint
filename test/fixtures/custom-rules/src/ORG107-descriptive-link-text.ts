const vagueText = /^(?:click here|here|link|more|read more)$/i;
const linkPattern = /(?:link:[^\[]+|https?:\/\/\S+)\[([^\]]*)]/g;

export default {
  id: "ORG107",
  alias: "descriptive-link-text",
  description: "Links should use descriptive visible text",
  tags: ["organization", "links", "accessibility"],
  parser: "text",
  docs: { summary: "Example custom accessibility rule for visible link text." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        for (const match of line.matchAll(linkPattern)) {
          if (vagueText.test(match[1]?.trim() ?? "")) {
            onError({
              severity: "info",
              message: "Link text should describe the destination",
              range: { start: { file: file.file, line: index + 1, column: (match.index ?? 0) + 1 } },
            });
          }
        }
      }
    }
  },
};
