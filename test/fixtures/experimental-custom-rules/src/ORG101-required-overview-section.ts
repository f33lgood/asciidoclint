function finding(file: string, line: number, message: string) {
  return { severity: "warning", message, range: { start: { file, line, column: 1 } } };
}

export default {
  id: "ORG101",
  alias: "required-overview-section",
  description: "Documents in this organization should have an Overview section",
  tags: ["organization", "conformance"],
  parser: "document",
  docs: { summary: "Example custom conformance rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    if (!document.sections.some((section: any) => section.title === "Overview")) {
      onError(finding(document.file, 1, "Missing required Overview section"));
    }
  },
};
