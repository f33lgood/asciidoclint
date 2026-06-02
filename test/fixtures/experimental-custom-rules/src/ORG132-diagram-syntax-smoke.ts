import fs from "node:fs";
import path from "node:path";

const mermaidStarts = /^(?:graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|requirementDiagram|C4Context)\b/;

export default {
  id: "ORG132",
  alias: "diagram-syntax-smoke",
  description: "Experimental diagram blocks should pass lightweight organization syntax smoke checks",
  tags: ["organization", "diagram"],
  parser: "text",
  docs: { summary: "Example custom rule for lightweight diagram syntax smoke checks." },
  function: ({ document }: any, onError: (finding: unknown) => void) => {
    for (const file of document.files) {
      for (const [index, line] of file.lines.entries()) {
        const style = line.trim().match(/^\[([^,\]]+)/)?.[1]?.toLowerCase();
        if (!style || !isSupportedDiagramStyle(style) || isLineInProtectedBlock(document, file.file, index + 1)) {
          continue;
        }

        const delimiterIndex = index + 1;
        const delimiter = file.lines[delimiterIndex]?.trim();
        if (delimiter !== "----" && delimiter !== "....") {
          continue;
        }

        const closeIndex = findNextLine(file.lines, delimiterIndex + 1, delimiter);
        if (closeIndex === undefined) {
          continue;
        }

        const rawContentLines = file.lines.slice(delimiterIndex + 1, closeIndex);
        const content = resolveDiagramContentIncludes(rawContentLines, file.file);
        const firstContentLine = rawContentLines.find((entry: string) => entry.trim() !== "")?.trim() ?? "";

        if (style === "plantuml" && (!/@startuml\b/i.test(content) || !/@enduml\b/i.test(content))) {
          report(onError, file.file, delimiterIndex + 2, "PlantUML diagram should include @startuml and @enduml");
        }
        if (style === "mermaid" && firstContentLine && !mermaidStarts.test(firstContentLine)) {
          report(onError, file.file, delimiterIndex + 2, "Mermaid diagram should start with a recognized diagram type");
        }
        if (style === "wavedrom" && (!/^\s*[{[]/.test(content) || !/[}\]]\s*$/.test(content))) {
          report(onError, file.file, delimiterIndex + 2, "WaveDrom diagram should start and end with an object or array");
        }
      }
    }
  },
};

function isSupportedDiagramStyle(style: string): boolean {
  return style === "plantuml" || style === "mermaid" || style === "wavedrom";
}

function findNextLine(lines: string[], startIndex: number, delimiter: string): number | undefined {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (lines[index]?.trim() === delimiter) {
      return index;
    }
  }
  return undefined;
}

function resolveDiagramContentIncludes(lines: string[], file: string): string {
  return lines.map((line) => {
    const include = line.trim().match(/^include::([^[]+)\[/);
    if (!include) {
      return line;
    }
    const target = include[1] ?? "";
    if (path.isAbsolute(target) || target.includes("://")) {
      return line;
    }
    const resolved = path.resolve(path.dirname(file), target);
    try {
      return fs.readFileSync(resolved, "utf8");
    } catch {
      return line;
    }
  }).join("\n");
}

function isLineInProtectedBlock(document: any, file: string, line: number): boolean {
  return document.blocks?.some((block: any) => block.file === file
    && line >= block.startLine
    && line <= block.endLine
    && (block.type === "listing" || block.type === "literal" || block.type === "comment"));
}

function report(onError: (finding: unknown) => void, file: string, line: number, message: string): void {
  onError({
    severity: "warning",
    message,
    range: { start: { file, line, column: 1 } },
    fixability: "no",
    fixHelper: "Run the diagram's real renderer or parser, then update the diagram source according to that engine's diagnostic.",
  });
}
