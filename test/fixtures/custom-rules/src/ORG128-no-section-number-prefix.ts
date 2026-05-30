export default {
  id: "ORG128",
  alias: "no-section-number-prefix",
  description: "Section titles should not contain literal generated-number prefixes",
  tags: ["organization", "conversion", "headings"],
  parser: "text",
  docs: { summary: "Example custom conversion-cleanup rule for literal section-number prefixes." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const section of document.sections) {
      if (/^\d+(?:\.\d+)*\.?\s+\S/.test(section.title)) {
        onError({
          severity: "info",
          message: "Remove literal section numbering from the title",
          range: { start: section.titleRange.start },
        });
      }
    }
  },
};
