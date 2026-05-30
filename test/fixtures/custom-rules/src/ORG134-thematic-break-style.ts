function isProtectedOrTableLine(document: any, file: string, line: number): boolean {
  return document.blocks.some((block: any) => (
    block.range?.start?.file === file
    && ["listing", "literal", "passthrough", "source", "stem", "diagram", "comment", "table"].includes(block.type)
    && block.range.start.line < line
    && (block.range.end?.line ?? block.range.start.line) > line
  ));
}

export default {
  id: "ORG134",
  alias: "thematic-break-style",
  description: "Thematic breaks should use the organization-preferred AsciiDoc-native marker",
  tags: ["organization", "style", "blocks"],
  parser: "text",
  docs: {
    summary: "Example custom rule preferring ''' over Markdown-compatible thematic break markers.",
    fixability: "safe",
    fixHelper: "Replace the Markdown-compatible thematic break marker with '''.",
  },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const lineNumber = index + 1;
        const trimmed = line.trim();
        if (!["---", "- - -", "***", "* * *"].includes(trimmed) || isProtectedOrTableLine(document, file.file, lineNumber)) {
          continue;
        }
        const column = line.search(/\S/) + 1;
        onError({
          severity: "info",
          message: "Use ''' for thematic breaks in this organization",
          range: {
            start: { file: file.file, line: lineNumber, column },
            end: { file: file.file, line: lineNumber, column: column + trimmed.length },
          },
          fixHelper: "Replace this Markdown-compatible thematic break with '''.",
          fix: {
            applicability: "safe",
            edits: [{
              file: file.file,
              range: {
                start: { file: file.file, line: lineNumber, column },
                end: { file: file.file, line: lineNumber, column: column + trimmed.length },
              },
              replacement: "'''",
            }],
          },
        });
      }
    }
  },
};
