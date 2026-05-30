function finding(file: string, line: number, message: string, severity = "warning") {
  return { severity, message, range: { start: { file, line, column: 1 } } };
}

export default {
  id: "ORG103",
  alias: "image-align-center",
  description: "Images should use organization-preferred center alignment",
  tags: ["organization", "image"],
  parser: "text",
  docs: { summary: "Example custom image alignment rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (line.trim().startsWith("image::") && !/\balign\s*=\s*"?center"?/.test(line)) {
          onError(finding(file.file, index + 1, "Image should declare center alignment", "info"));
        }
      }
    }
  },
};
