const knownInternalHosts = new Set(["tracker.internal", "docs.internal", "review.internal"]);

function validateUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return `Potentially malformed URL: ${url}`;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return `Potentially malformed URL: ${url}`;
  }
  if (hostname.includes(".")) {
    return /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(hostname) ? undefined : `Potentially malformed URL: ${url}`;
  }
  if (knownInternalHosts.has(hostname)) {
    return undefined;
  }
  return `Unknown internal hostname in URL: ${hostname}`;
}

export default {
  id: "ORG126",
  alias: "external-link-validation",
  description: "External links should have valid offline URL shape and descriptive text",
  tags: ["organization", "links"],
  parser: "text",
  docs: { summary: "Example custom offline external link validation rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    const pattern = /(https?:\/\/[^\[\s]+)(\[[^\]]*])?/g;
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        for (const match of line.matchAll(pattern)) {
          const url = match[1] ?? "";
          const label = match[2];
          const column = (match.index ?? 0) + 1;
          const urlMessage = validateUrl(url);
          if (urlMessage) {
            onError({
              severity: "warning",
              message: urlMessage,
              range: { start: { file: file.file, line: index + 1, column } },
            });
          }
          if (!label || label === "[]") {
            onError({
              severity: "warning",
              message: `External link missing descriptive text: ${url}`,
              range: { start: { file: file.file, line: index + 1, column } },
            });
          }
        }
      }
    }
  },
};
