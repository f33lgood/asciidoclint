function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export default {
  id: "ORG105",
  alias: "no-duplicate-section-title",
  description: "Section titles should be unique in this documentation set",
  tags: ["organization", "headings"],
  parser: "document",
  docs: { summary: "Example custom navigation rule based on duplicate section titles." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    const seen = new Map<string, any>();
    for (const section of document.sections) {
      const key = slug(section.title);
      if (!key) {
        continue;
      }
      if (seen.has(key)) {
        onError({
          severity: "info",
          message: `Duplicate section title: ${section.title}`,
          range: { start: section.titleRange.start },
        });
      }
      seen.set(key, section);
    }
  },
};
