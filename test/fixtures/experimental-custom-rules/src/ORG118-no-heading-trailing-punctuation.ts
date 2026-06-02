export default {
  id: "ORG118",
  alias: "no-heading-trailing-punctuation",
  description: "Section titles should not end with punctuation",
  tags: ["organization", "headings", "style"],
  parser: "text",
  docs: { summary: "Example custom heading punctuation rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const section of document.sections) {
      if (/[.,;:!?]$/.test(section.title)) {
        onError({ severity: "info", message: "Section title ends with punctuation", range: { start: section.titleRange.start } });
      }
    }
  },
};
