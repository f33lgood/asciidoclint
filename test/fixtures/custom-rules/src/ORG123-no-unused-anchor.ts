export default {
  id: "ORG123",
  alias: "no-unused-anchor",
  description: "Explicit anchors should be referenced",
  tags: ["organization", "links", "references"],
  parser: "text",
  docs: { summary: "Example custom unused-reference rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      const anchors: { id: string; line: number }[] = [];
      const refs = new Set<string>();
      for (const [index, line] of file.lines.entries()) {
        const anchor = line.match(/^\[\[([^\]]+)]]\s*$|^\[#([^\]]+)]\s*$/);
        if (anchor) anchors.push({ id: anchor[1] ?? anchor[2] ?? "", line: index + 1 });
        for (const ref of line.matchAll(/xref:([^\[#\]]+)?#?([^\[]+)\[[^\]]*]|<<([^,>\s]+)(?:,[^>]*)?>>/g)) {
          refs.add(ref[2] ?? ref[3] ?? "");
        }
      }
      for (const anchor of anchors) {
        if (anchor.id && !refs.has(anchor.id)) {
          onError({ severity: "info", message: `Anchor is not referenced: ${anchor.id}`, range: { start: { file: file.file, line: anchor.line, column: 1 } } });
        }
      }
    }
  },
};
