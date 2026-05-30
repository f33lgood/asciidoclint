export default {
  id: "ORG131",
  alias: "no-manual-toc",
  description: "Manual tables of contents should use generated TOCs",
  tags: ["organization", "structure", "toc"],
  parser: "text",
  docs: {
    summary: "Example custom rule requiring Asciidoctor-generated tables of contents.",
    fixability: "no",
    fixHelper: "Replace the manual TOC section with :toc: in the document header or :toc: macro plus toc::[] at the intended location.",
  },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (!/^=+\s+Table of Contents\s*$/i.test(line.trim())) {
          continue;
        }
        const nearby = file.lines.slice(index + 1, index + 8).join("\n");
        if (!/(xref:|<<[^>]+>>)/.test(nearby)) {
          continue;
        }
        onError({
          severity: "info",
          message: "Manual table of contents should use an Asciidoctor-generated TOC",
          range: { start: { file: file.file, line: index + 1, column: 1 } },
          fixHelper: "Use :toc: for a generated TOC, or :toc: macro with toc::[] when the TOC must appear at a specific location.",
        });
      }
    }
  },
};
