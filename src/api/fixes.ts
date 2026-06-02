import fs from "node:fs";
import type { FixApplicability, LintFinding, TextEdit } from "../types.js";

export interface FixSummary {
  applied: number;
  skipped: number;
}

export function applyFixes(findings: LintFinding[], unsafeFixes: boolean): FixSummary {
  const allowed: FixApplicability[] = unsafeFixes ? ["safe", "unsafe"] : ["safe"];
  const edits = findings.flatMap((finding) => {
    if (finding.waived || !finding.fix || !allowed.includes(finding.fix.applicability)) {
      return [];
    }
    return finding.fix.edits;
  });

  const byFile = new Map<string, TextEdit[]>();
  for (const edit of edits) {
    const list = byFile.get(edit.file) ?? [];
    list.push(edit);
    byFile.set(edit.file, list);
  }

  let applied = 0;
  let skipped = 0;
  for (const [file, fileEdits] of byFile.entries()) {
    const text = fs.readFileSync(file, "utf8");
    const normalized = fileEdits.map((edit) => ({
      edit,
      start: offsetFor(text, edit.range.start.line, edit.range.start.column),
      end: offsetFor(text, edit.range.end?.line ?? edit.range.start.line, edit.range.end?.column ?? edit.range.start.column),
    })).sort((a, b) => b.start - a.start);

    const accepted: typeof normalized = [];
    for (const candidate of normalized) {
      const overlaps = accepted.some((existing) => rangesOverlap(candidate.start, candidate.end, existing.start, existing.end));
      if (overlaps) {
        skipped += 1;
      } else {
        accepted.push(candidate);
      }
    }

    let output = text;
    for (const { edit, start, end } of accepted) {
      output = `${output.slice(0, start)}${edit.replacement}${output.slice(end)}`;
      applied += 1;
    }
    if (output !== text) {
      fs.writeFileSync(file, output);
    }
  }

  return { applied, skipped };
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function offsetFor(text: string, line: number, column: number): number {
  let offset = 0;
  let currentLine = 1;
  while (currentLine < line && offset < text.length) {
    const next = text.indexOf("\n", offset);
    if (next === -1) {
      return text.length;
    }
    offset = next + 1;
    currentLine += 1;
  }
  return Math.min(offset + Math.max(column - 1, 0), text.length);
}
