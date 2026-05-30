export default {
  id: "ORG116",
  alias: "commands-show-output",
  description: "Shell prompts should be avoided unless command output is shown",
  tags: ["organization", "code"],
  parser: "text",
  docs: { summary: "Example custom command transcript style rule." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        if (/^\s*\$\s+\S/.test(line)) {
          onError({ severity: "info", message: "Avoid shell prompt markers in command examples", range: { start: { file: file.file, line: index + 1, column: 1 } } });
        }
      }
    }
  },
};
