const xrefPattern = /xref:([^\s\[]+\.[A-Za-z0-9]+(?:[?#][^\s\[]*)?)\[[^\]]*]/g;
const asciidocExtensions = /\.(?:adoc|asciidoc|asc)(?:[?#].*)?$/i;

export default {
  id: "ORG133",
  alias: "non-adoc-xref",
  description: "Experimental non-AsciiDoc local files should use link instead of xref",
  tags: ["organization", "xref", "links"],
  parser: "text",
  docs: { summary: "Example custom semantic xref/link convention rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        for (const match of line.matchAll(xrefPattern)) {
          const target = match[1] ?? "";
          if (isExternalTarget(target) || asciidocExtensions.test(target)) {
            continue;
          }
          const column = (match.index ?? 0) + 1;
          onError({
            severity: "info",
            message: `Non-AsciiDoc local file xref could use link: ${target}`,
            range: { start: { file: file.file, line: index + 1, column } },
            fixHelper: "Use link: for local non-AsciiDoc files when no AsciiDoc cross-reference semantics are needed.",
          });
        }
      }
    }
  },
};

function isExternalTarget(target: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("mailto:");
}
