import asciidoctorFactory from "asciidoctor";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { builtInRules } from "./builtin.js";

const asciidoctor = (asciidoctorFactory as unknown as () => any)();

function render(source: string): string {
  const logger = asciidoctor.MemoryLogger.create();
  asciidoctor.LoggerManager.setLogger(logger);
  return String(asciidoctor.convert(source, {
    safe: "unsafe",
    backend: "html5",
    standalone: false,
  }));
}

function renderDocument(source: string, baseDir: string): { converted: boolean; html: string; severities: string[] } {
  const logger = asciidoctor.MemoryLogger.create();
  asciidoctor.LoggerManager.setLogger(logger);
  let html = "";
  let converted = false;
  const renderableSource = source.split(/^\s*\/\/\s+\S+\.adoc\s*$/m)[0] ?? source;
  try {
    html = String(asciidoctor.convert(completeDocument(renderableSource), {
      safe: "unsafe",
      backend: "html5",
      standalone: false,
      base_dir: baseDir,
      to_file: false,
    }));
    converted = true;
  } catch {
    // The logger captures parser/render diagnostics; callers assert on severity.
  }
  return {
    converted,
    html,
    severities: logger.getMessages().map((message: any) => String(message.getSeverity?.() ?? "WARN").toUpperCase()),
  };
}

function completeDocument(source: string): string {
  if (/^(:[^:\n]+:.*\n)+\s*=+\s+\S/m.test(source) || /^=+\s+\S/m.test(source) || /^include::/m.test(source)) {
    return source;
  }
  return `= Example\n\n${source}`;
}

function makeExampleBaseDir(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-rule-examples-"));
  for (const file of ["diagram.png", "overview.png", "image.png", "datasheet.pdf"]) {
    fs.writeFileSync(path.join(directory, file), "fixture");
  }
  fs.writeFileSync(path.join(directory, "chapter.adoc"), "== Chapter\n\nIncluded content.\n");
  fs.writeFileSync(path.join(directory, "appendix.adoc"), "== Appendix\n\nIncluded appendix.\n");
  fs.writeFileSync(path.join(directory, "title-page.adoc"), "= Product Guide\n");
  fs.writeFileSync(path.join(directory, "part-one.adoc"), "= Part One\n\n== Chapter One\n\nIncluded content.\n");
  return directory;
}

describe("AsciiDoc rendering facts behind built-in rules", () => {
  it("shows that unterminated listing blocks consume following section syntax", () => {
    const html = render("= Title\n\n----\n== Intended Section\n");

    expect(html).toContain("listingblock");
    expect(html).toContain("== Intended Section");
    expect(html).not.toContain("<h2");
  });

  it("shows that plain figure captions are paragraphs, not block titles", () => {
    const bad = render("= Title\n\nFigure 1: Overview\nimage::diagram.png[Overview]\n");
    const good = render("= Title\n\n.Overview\nimage::diagram.png[Overview]\n");
    const doubled = render("= Title\n\n.Figure 1. Overview\nimage::diagram.png[Overview]\n");

    expect(bad).toContain("<p>Figure 1: Overview");
    expect(bad).toContain("image::diagram.png[Overview]</p>");
    expect(bad).not.toContain('<div class="title">Figure 1: Overview</div>');
    expect(good).toContain('<div class="title">Figure 1. Overview</div>');
    expect(doubled).toContain('<div class="title">Figure 1. Figure 1. Overview</div>');
  });

  it("shows that plain table captions are paragraphs, not table titles", () => {
    const bad = render("= Title\n\nTable 1: Registers\n|===\n| Name | Value\n|===\n");
    const good = render("= Title\n\n.Registers\n|===\n| Name | Value\n|===\n");
    const doubled = render("= Title\n\n.Table 1. Registers\n|===\n| Name | Value\n|===\n");

    expect(bad).toContain("<p>Table 1: Registers</p>");
    expect(good).toContain('<caption class="title">Table 1. Registers</caption>');
    expect(doubled).toContain('<caption class="title">Table 1. Table 1. Registers</caption>');
  });

  it("shows that Asciidoctor allows table cells to flow across source lines", () => {
    const html = render("= Title\n\n[cols=\"1,1\"]\n|===\n| one\n| two\n| three\n| four\n|===\n");

    expect(html).toContain("<table");
    expect(html).toContain("<p class=\"tableblock\">one</p>");
    expect(html).toContain("<p class=\"tableblock\">two</p>");
    expect(html).toContain("<p class=\"tableblock\">three</p>");
    expect(html).toContain("<p class=\"tableblock\">four</p>");
  });

  it("shows that Asciidoctor silently omits incomplete table rows", () => {
    const html = render("= Title\n\n[cols=\"1,1\"]\n|===\n| one | two | omitted\n|===\n");

    expect(html).toContain("<table");
    expect(html).toContain("<p class=\"tableblock\">one</p>");
    expect(html).toContain("<p class=\"tableblock\">two</p>");
    expect(html).not.toContain("omitted");
  });

  it("shows that unsupported heading depths render as paragraph text", () => {
    const html = render("= Title\n\n======= Too Deep\n\ntext\n");

    expect(html).toContain("<p>======= Too Deep</p>");
    expect(html).not.toContain("<h7");
    expect(html).not.toContain("sect6");
  });

  it("shows that unseparated list content consumes following structural lines", () => {
    const section = render("= Title\n\n* item\n== Intended Section\n");
    const titledImage = render("= Title\n\n* item\n.Figure title\nimage::diagram.png[Diagram]\n");
    const separated = render("= Title\n\n* item\n\n== Intended Section\n");

    expect(section).toContain("<p>item\n== Intended Section</p>");
    expect(section).not.toContain("<h2");
    expect(titledImage).toContain("<p>item\n.Figure title\nimage::diagram.png[Diagram]</p>");
    expect(titledImage).not.toContain("<img");
    expect(separated).toContain("<h2");
    expect(separated).not.toContain("== Intended Section</p>");
  });

  it("shows that Markdown tables, links, and images render as plain content in AsciiDoc", () => {
    const html = render("= Title\n\n| A | B |\n|---|---|\n\n[Example](https://example.com)\n\n![Alt](image.png)\n");

    expect(html).toContain("|---|---|");
    expect(html).toContain("[Example](");
    expect(html).toContain('class="bare"');
    expect(html).toContain("![Alt](image.png)");
    expect(html).not.toContain("<table");
    expect(html).not.toContain("<img");
  });

  it("shows that Asciidoctor accepts Markdown-compatible headings and fenced code", () => {
    const document = asciidoctor.load("= Title\n\n## Markdown-compatible Section\n\n```ruby\nputs 1\n```\n", {
      safe: "unsafe",
    });

    const sections = document.findBy({ context: "section" });
    const listings = document.findBy({ context: "listing" });

    expect(sections.some((section: any) => section.getTitle() === "Markdown-compatible Section")).toBe(true);
    expect(listings[0]?.getStyle()).toBe("source");
    expect(listings[0]?.getSource()).toBe("puts 1");
  });

  it("shows that generated table of contents follows the real section tree", () => {
    const html = render("= Title\n:toc:\n\n== First\n\n== Second\n");

    expect(html).toContain("toc");
    expect(html).toContain("First");
    expect(html).toContain("Second");
  });

  it("shows that empty sections render as visible headings with generated IDs", () => {
    const html = render("= Title\n\n== Empty\n\n== Next\n\nText.\n");

    expect(html).toContain('<h2 id="_empty">Empty</h2>');
    expect(html).toContain('<div class="sectionbody">');
    expect(html).toContain('<h2 id="_next">Next</h2>');
  });

  it("renders every documented built-in rule example through Asciidoctor", () => {
    const baseDir = makeExampleBaseDir();

    for (const rule of builtInRules) {
      const examples = [...(rule.docs?.badExamples ?? []), ...(rule.docs?.goodExamples ?? [])];
      expect(examples.length, `${rule.id} should have examples`).toBeGreaterThan(0);

      for (const example of examples) {
        const result = renderDocument(example.code, baseDir);
        expect(result.converted || result.severities.length, `${rule.id} example should be accepted by Asciidoctor`).toBeTruthy();
        if ((rule.docs?.goodExamples ?? []).includes(example)) {
          expect(result.severities, `${rule.id} good example should not emit Asciidoctor errors`).not.toContain("ERROR");
        }
      }
    }
  });
});
