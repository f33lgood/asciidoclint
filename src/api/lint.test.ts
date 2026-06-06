import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { lintFiles } from "./lint.js";
import { parseDocument } from "../parsers/tolerant.js";
import { builtInRules } from "../rules/builtin.js";
import { getVersion } from "../version.js";

const apiFixture = (name: string) => path.resolve("test", "fixtures", "api", name);
const ruleFixture = (rule: string, name: string) => path.resolve("test", "fixtures", "rules", rule, name);
const customRuleFixture = (name: string) => path.resolve("test", "fixtures", "experimental-custom-rules", "src", name);
const customRuleFixtures = () => fs.readdirSync(path.resolve("test", "fixtures", "experimental-custom-rules", "src"))
  .filter((file) => /^ORG\d{3}-.+\.ts$/.test(file))
  .sort()
  .map(customRuleFixture);

describe("lintFiles", () => {
  it("reports structural issues and keeps going after missing dependencies", async () => {
    const result = await lintFiles([apiFixture("structural_errors.adoc")]);
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).toContain("AD000");
    expect(ids).toContain("AD001");
    expect(ids).toContain("AD002");
    expect(ids).toContain("AD003");
    expect(ids).toContain("AD004");
    expect(ids).toContain("AD025");
  });

  it("resolves include targets through document attributes", async () => {
    const result = await lintFiles([apiFixture("master.adoc")]);
    const missingIncludes = result.findings.filter((finding) => finding.ruleId === "AD024");

    expect(missingIncludes.map((finding) => finding.message)).toContain("Missing include target: missing-child.adoc");
    expect(missingIncludes.some((finding) => finding.message.includes("{chapter-file}"))).toBe(false);
  });

  it("reports local AsciiDoc source links and offers an unsafe xref fix", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-local-adoc-link-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "chapter.adoc"), "[#setup]\n== Setup\n");
    fs.writeFileSync(path.join(directory, "datasheet.pdf"), "pdf");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "link:chapter.adoc#setup[Setup]",
      "link:chapter.adoc?rev=1[Source revision]",
      "link:datasheet.pdf[Datasheet]",
      "link:https://example.com/chapter.adoc[External]",
      "xref:chapter.adoc#setup[Setup]",
      "\\link:chapter.adoc[Escaped example]",
      "----",
      "link:chapter.adoc[Literal example]",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD044");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.alias).toBe("local-adoc-link");
    expect(findings[0]?.severity).toBe("warning");
    expect(findings[0]?.fix?.applicability).toBe("unsafe");
    expect(findings[0]?.fix?.edits[0]?.replacement).toBe("xref:");
  });

  it("does not report optional or external include targets as missing local files", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-optional-include-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "include::missing-optional.adoc[opts=optional]",
      "",
      "include::https://example.com/remote.adoc[]",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD024")).toBe(false);
  });

  it("does not report source block content as headings", async () => {
    const result = await lintFiles([apiFixture("included-chapter.adoc")]);
    expect(result.findings.some((finding) => finding.message.includes("syntax inside source block"))).toBe(false);
  });

  it("supports readable aliases in findings", async () => {
    const result = await lintFiles([apiFixture("structure_only.adoc")]);
    const heading = result.findings.find((finding) => finding.ruleId === "AD001");
    expect(heading?.alias).toBe("heading-level-progression");
  });

  it("applies config severity overrides and rule disables", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-config-"));
    const doc = path.join(directory, "bad.adoc");
    const config = path.join(directory, ".asciidoclint", "config.yaml");
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(doc, "= Title\n\n=== Skipped\n");
    fs.writeFileSync(config, "rules:\n  heading-level-progression:\n    severity: error\n  AD002: false\n");

    const result = await lintFiles([doc], { configFile: config, cwd: directory });
    const heading = result.findings.find((finding) => finding.ruleId === "AD001");
    expect(heading?.severity).toBe("error");
    expect(result.findings.some((finding) => finding.ruleId === "AD002")).toBe(false);
  });

  it("allows multiple level-0 sections in book documents", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-book-parts-"));
    const doc = path.join(directory, "book.adoc");
    fs.writeFileSync(doc, ":doctype: book\n\n= Book\n\n= Part One\n\n== Chapter\n\ncontent\n");

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD002")).toBe(false);
  });

  it("wraps Asciidoctor diagnostics for supported Markdown-style section titles", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-markdown-sections-"));
    const skipped = path.join(directory, "skipped.adoc");
    const secondTitle = path.join(directory, "second-title.adoc");
    fs.writeFileSync(skipped, "# Title\n\n### Skipped\n");
    fs.writeFileSync(secondTitle, "# Title\n\n# Second Title\n");

    const skippedResult = await lintFiles([skipped], { cwd: directory });
    const secondTitleResult = await lintFiles([secondTitle], { cwd: directory });

    expect(skippedResult.findings.some((finding) => finding.ruleId === "AD001")).toBe(true);
    expect(secondTitleResult.findings.some((finding) => finding.ruleId === "AD002")).toBe(true);
  });

  it("loads custom rules without modifying asciidoclint source", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-custom-"));
    const doc = path.join(directory, "doc.adoc");
    const rule = path.join(directory, "no-todo.mjs");
    fs.writeFileSync(doc, "= Title\n\nTODO fix this.\n");
    fs.writeFileSync(rule, `export default {
      id: "ORG001",
      alias: "no-todo",
      description: "No TODO markers",
      tags: ["organization"],
      docs: { summary: "TODO markers should not be committed." },
      parser: "text",
      function: (params, onError) => {
        params.lines.forEach((line, index) => {
          const column = line.indexOf("TODO");
          if (column !== -1) {
            onError({
              severity: "warning",
              message: "Remove TODO marker",
              range: { start: { file: params.file, line: index + 1, column: column + 1 } }
            });
          }
        });
      }
    };`);

    const result = await lintFiles([doc], { customRules: [rule], cwd: directory });
    expect(result.findings.some((finding) => finding.ruleId === "ORG001" && finding.alias === "no-todo")).toBe(true);
  });

  it("loads the custom thematic-break style rule and applies safe fixes", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-custom-break-style-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Before",
      "",
      "---",
      "",
      "Middle",
      "",
      "* * *",
      "",
      "----",
      "literal ---",
      "----",
      "",
      "|===",
      "| Cell",
      "a|",
      "---",
      "|===",
      "",
    ].join("\n"));

    const before = await lintFiles([doc], {
      cwd: directory,
      customRules: [customRuleFixture("ORG134-thematic-break-style.ts")],
    });

    expect(before.findings.filter((finding) => finding.ruleId === "ORG134")).toHaveLength(2);
    expect(before.findings.every((finding) => finding.ruleId !== "ORG134" || finding.fix?.applicability === "safe")).toBe(true);

    const after = await lintFiles([doc], {
      cwd: directory,
      customRules: [customRuleFixture("ORG134-thematic-break-style.ts")],
      fix: true,
    });

    expect(after.findings.some((finding) => finding.ruleId === "ORG134")).toBe(false);
    expect(fs.readFileSync(doc, "utf8")).toContain("Before\n\n'''\n\nMiddle\n\n'''");
  });

  it("applies safe fixes and reparses", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-fix-"));
    const doc = path.join(directory, "fix.adoc");
    fs.writeFileSync(doc, "= Title\n\nText immediately before a block\n====\ncontent\n====\n");

    const before = await lintFiles([doc], { cwd: directory });
    expect(before.findings.some((finding) => finding.ruleId === "AD032" && finding.fix?.applicability === "safe")).toBe(true);

    const after = await lintFiles([doc], { cwd: directory, fix: true });
    const fixed = fs.readFileSync(doc, "utf8");
    expect(fixed).toContain("Text immediately before a block\n\n====");
    expect(fixed).toContain("content\n====");
    expect(fixed).not.toContain("content\n\n====");
    expect(after.findings.some((finding) => finding.ruleId === "AD032")).toBe(false);
  });

  it("applies blank-after-block safe fixes", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-after-block-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "= Title\n\n====\ncontent\n====\nText after block\n");

    const before = await lintFiles([doc], { cwd: directory });
    expect(before.findings.some((finding) => finding.ruleId === "AD035" && finding.fix?.applicability === "safe")).toBe(true);

    const after = await lintFiles([doc], { cwd: directory, fix: true });
    expect(fs.readFileSync(doc, "utf8")).toContain("====\n\nText after block");
    expect(after.findings.some((finding) => finding.ruleId === "AD035")).toBe(false);
  });

  it("applies blank-before-list safe fixes and uses the rule fix helper", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-list-fix-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "= Title\n\nParagraph before list\n* item\n");

    const before = await lintFiles([doc], { cwd: directory });
    const finding = before.findings.find((item) => item.ruleId === "AD008");
    expect(finding?.fix?.applicability).toBe("safe");
    expect(finding?.fixHelper).toBe("Insert one blank line before the list marker.");

    const after = await lintFiles([doc], { cwd: directory, fix: true });
    expect(fs.readFileSync(doc, "utf8")).toContain("Paragraph before list\n\n* item");
    expect(after.findings.some((item) => item.ruleId === "AD008")).toBe(false);
  });

  it("applies blank-after-list safe fixes for section titles", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-list-section-fix-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "* Item",
      "== Next section",
      "",
    ].join("\n"));

    const before = await lintFiles([doc], { cwd: directory });
    const finding = before.findings.find((item) => item.ruleId === "AD009");
    expect(finding?.severity).toBe("error");
    expect(finding?.fix?.applicability).toBe("safe");
    expect(finding?.fixHelper).toBe("Insert one blank line before the section title so it renders as a section instead of list-item text.");

    const after = await lintFiles([doc], { cwd: directory, fix: true });
    expect(fs.readFileSync(doc, "utf8")).toContain("* Item\n\n== Next section");
    expect(after.findings.some((item) => item.ruleId === "AD009")).toBe(false);
  });

  it("marks next-line waivers and preserves waiver metadata", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-waiver-next-line-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "// asciidoclint disable-next-line AD023 -- intentional placeholder",
      "== Reserved",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const finding = result.findings.find((item) => item.ruleId === "AD023");

    expect(finding?.waived).toBe(true);
    expect(finding?.waiver).toMatchObject({
      file: doc,
      line: 3,
      column: 1,
      directive: "disable-next-line",
      rules: ["AD023"],
      reason: "intentional placeholder",
    });
  });

  it("marks block waivers and leaves included-file findings active", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-waiver-block-"));
    const doc = path.join(directory, "doc.adoc");
    const chapter = path.join(directory, "chapter.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "// asciidoclint disable-block AD023 -- local placeholders",
      "== Reserved",
      "",
      "== Next",
      "",
      "content",
      "// asciidoclint enable-block AD023",
      "",
      "include::chapter.adoc[]",
      "",
    ].join("\n"));
    fs.writeFileSync(chapter, [
      "== Included Placeholder",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const local = result.findings.find((item) => item.ruleId === "AD023" && item.range.start.file === doc);
    const included = result.findings.find((item) => item.ruleId === "AD023" && item.range.start.file === chapter);

    expect(local?.waived).toBe(true);
    expect(local?.waiver?.directive).toBe("disable-block");
    expect(included?.waived).toBeUndefined();
  });

  it("reports waiver diagnostics and does not allow waiving waiver diagnostics", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-waiver-diagnostics-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "// asciidoclint disable AD023",
      "// asciidoclint disable-next-line",
      "// asciidoclint disable-next-line AD023 AD014",
      "// asciidoclint disable-next-line AD999",
      "// asciidoclint enable-block AD023",
      "// asciidoclint disable-block AD023",
      "== Empty",
      "// asciidoclint enable-block AD034",
      "// asciidoclint disable-next-line ADW01",
      "== Empty Too",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).toContain("ADW01");
    expect(ids).toContain("ADW02");
    expect(ids).toContain("ADW03");
    expect(ids).toContain("ADW04");
    expect(ids).toContain("ADW05");
    expect(ids).toContain("ADW07");
    expect(ids).toContain("ADW08");
    expect(result.findings.find((finding) => finding.ruleId === "ADW08")?.waived).toBeUndefined();
  });

  it("keeps waiver diagnostic aliases aligned with built-in rule metadata", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-waiver-aliases-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "// asciidoclint disable AD023",
      "// asciidoclint disable-next-line",
      "// asciidoclint disable-next-line AD023 AD014",
      "// asciidoclint disable-next-line AD999",
      "// asciidoclint enable-block AD023",
      "// asciidoclint disable-block AD023",
      "== Empty",
      "// asciidoclint enable-block AD034",
      "// asciidoclint disable-next-line ADW01",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const aliasesByRule = new Map(builtInRules.map((rule) => [rule.id, rule.alias]));

    for (const finding of result.findings.filter((item) => item.ruleId.startsWith("ADW"))) {
      expect(finding.alias).toBe(aliasesByRule.get(finding.ruleId));
    }
  });

  it("reports waiver diagnostics even when ADW rules are disabled in config", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-waiver-always-on-"));
    const doc = path.join(directory, "doc.adoc");
    const config = path.join(directory, ".asciidoclint", "config.yaml");
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.writeFileSync(doc, "// asciidoclint enable-block AD023\n");
    fs.writeFileSync(config, "rules:\n  ADW05: false\n");

    const result = await lintFiles([doc], { cwd: directory, configFile: config });
    const finding = result.findings.find((item) => item.ruleId === "ADW05");

    expect(finding?.alias).toBe("unpaired-waiver-enable-block");
  });

  it("reports unpaired disable-block and applies it through EOF", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-waiver-unpaired-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "// asciidoclint disable-block AD023",
      "== Empty",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.find((finding) => finding.ruleId === "AD023")?.waived).toBe(true);
    expect(result.findings.some((finding) => finding.ruleId === "ADW06")).toBe(true);
  });

  it("does not apply fixes for waived findings", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-waiver-fix-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "// asciidoclint disable-next-line AD034 -- generated tabbed content",
      "*\tTabbed list item",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory, fix: true });

    expect(result.findings.find((finding) => finding.ruleId === "AD034")?.waived).toBe(true);
    expect(fs.readFileSync(doc, "utf8")).toContain("*\tTabbed list item");
  });

  it("reports blank-before-block as an error when Asciidoctor can parse the delimiter as a section underline", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-before-block-error-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "= Title\n\nText\n====\ncontent\n====\n");

    const result = await lintFiles([doc], { cwd: directory });
    const finding = result.findings.find((item) => item.ruleId === "AD032");

    expect(finding?.severity).toBe("error");
  });

  it("reports blank-before-block as a warning when spacing is recommended but rendering is not known to change", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-before-block-warning-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "= Title\n\nText\n****\ncontent\n****\n");

    const result = await lintFiles([doc], { cwd: directory });
    const finding = result.findings.find((item) => item.ruleId === "AD032");

    expect(finding?.severity).toBe("warning");
  });

  it("reports spacing around documented delimiter variants", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-delimiter-variants-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Text before sidebar",
      "******",
      "Sidebar content.",
      "******",
      "Text after sidebar",
      "",
      "Text before csv table",
      ",===",
      "A,B",
      ",===",
      "Text after csv table",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD032")).toHaveLength(2);
    expect(result.findings.filter((finding) => finding.ruleId === "AD035")).toHaveLength(2);
  });

  it("loads organization policy rules without making them built-ins", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-org-policy-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "== Details",
      "",
      "- Nonpreferred unordered marker",
      "  ** Child",
      "   ** Misaligned child",
      "   * Odd indentation child",
      "",
      "",
      "Text&nbsp;with entity.",
      "",
      "*Standalone emphasis heading*",
      "",
      "link:https://example.com[click here]",
      "link:https://example.com[ Example ]",
      "",
      "http://tracker/ISSUE-123[]",
      "",
      "https://example.com/raw",
      "",
      "<span>Raw HTML</span>",
      "",
      "$ asciidoclint docs/**/*.adoc",
      "",
      "This is an intentionally long line that exceeds the organization's example source-width limit for maintained documents.",
      "",
      "[source]",
      "----",
      "echo hi",
      "----",
      "",
      ".Diagram",
      "image::diagram.png[Diagram]",
      "",
      "Paragraph before tight heading.",
      "== Tight Heading:",
      "== 1.2 Numbered Heading",
      "Text after tight heading.",
      "",
      "== Details",
      "",
      "1. Explicit number",
      "",
      "Term: Fake definition paragraph.",
      "",
      "examplecorp supports asciidoc workflows.",
      "",
      "[[unused-anchor]]",
      "== Anchored",
      "",
      "This is _important_ and **strong**.",
      "",
      ".Data",
      "|===",
      "| A | B",
      "|===",
      "",
      "== Table of Contents",
      "",
      "xref:intro[]",
      "",
      ".Broken PlantUML",
      "[plantuml]",
      "----",
      "Alice -> Bob",
      "----",
      "",
      "xref:datasheet.pdf[Datasheet]",
    ].join("\n"));
    fs.writeFileSync(path.join(directory, "datasheet.pdf"), "pdf");
    fs.writeFileSync(path.join(directory, "diagram.png"), "png");

    const result = await lintFiles([doc], {
      customRules: customRuleFixtures(),
      cwd: directory,
    });
    const ids = new Set(result.findings.map((finding) => finding.ruleId));

    for (let index = 101; index <= 133; index += 1) {
      expect(ids, `ORG${index} should report on the organization policy fixture`).toContain(`ORG${index}`);
    }
  });

  it("reports missing xrefs and local attachments without flagging valid targets", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-deps-"));
    const doc = path.join(directory, "doc.adoc");
    const child = path.join(directory, "child.adoc");
    const pdf = path.join(directory, "ok.pdf");
    fs.writeFileSync(pdf, "ok");
    fs.writeFileSync(child, "= Child\n\n[[child-anchor]]\n== Child Anchor\n");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[[overview]]",
      "== Overview",
      "",
      "xref:overview[]",
      "xref:Overview[]",
      "<<Overview>>",
      "xref:_child[]",
      "xref:child.adoc#child-anchor[]",
      "xref:missing-anchor[]",
      "<<missing-shorthand>>",
      "xref:missing.adoc[]",
      "link:ok.pdf[Download]",
      "link:missing.pdf[Download]",
      "link:ok.pdf#page=2[Download section]",
      "attachment:missing-ignored.pdf[Not a core AsciiDoc macro]",
      "https://example.com/not-local.pdf",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const messages = result.findings.map((finding) => finding.message);

    expect(messages).toContain("Missing xref target: missing-anchor");
    expect(messages).toContain("Missing xref target: missing-shorthand");
    expect(messages).toContain("Missing xref target: missing.adoc");
    expect(messages).toContain("Missing local link target: missing.pdf");
    expect(messages.some((message) => message.includes("overview"))).toBe(false);
    expect(messages.some((message) => message.includes("Overview"))).toBe(false);
    expect(messages.some((message) => message.includes("_child"))).toBe(false);
    expect(messages.some((message) => message.includes("child-anchor"))).toBe(false);
    expect(messages.some((message) => message.includes("ok.pdf"))).toBe(false);
    expect(messages.some((message) => message.includes("missing-ignored.pdf"))).toBe(false);
  });

  it("uses Asciidoctor catalog IDs for non-section xref targets", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-asciidoctor-xrefs-"));
    fs.writeFileSync(path.join(directory, "existing.png"), "png");
    fs.writeFileSync(path.join(directory, "doc.adoc"), [
      "= Title",
      "",
      "See <<fig-macro>>, <<tab-attrs>>, and <<example-block>>.",
      "",
      "image::existing.png[Overview,title=\"Overview\",id=fig-macro]",
      "",
      "[cols=\"1,1\",id=tab-attrs,title=\"Attrs table\"]",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "[#example-block]",
      ".Example Block",
      "====",
      "Text",
      "====",
      "",
      "See <<missing-catalog-target>>.",
      "",
    ].join("\n"));

    const result = await lintFiles(["doc.adoc"], { cwd: directory });
    const messages = result.findings.map((finding) => finding.message);

    expect(messages).toContain("Missing xref target: missing-catalog-target");
    expect(messages.some((message) => message.includes("fig-macro"))).toBe(false);
    expect(messages.some((message) => message.includes("tab-attrs"))).toBe(false);
    expect(messages.some((message) => message.includes("example-block"))).toBe(false);
  });

  it("resolves image targets through imagesdir", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-imagesdir-"));
    fs.mkdirSync(path.join(directory, "images", "payload"), { recursive: true });
    fs.writeFileSync(path.join(directory, "images", "diagram.svg"), "<svg></svg>");
    fs.writeFileSync(path.join(directory, "images", "payload", "packet.svg"), "<svg></svg>");
    fs.writeFileSync(path.join(directory, "attrs.adoc"), ":imagesdir: images\n");
    fs.writeFileSync(path.join(directory, "doc.adoc"), [
      "= Title",
      "include::attrs.adoc[]",
      "",
      "image::diagram.svg[Diagram]",
      "image::payload/packet.svg[Packet]",
      "",
    ].join("\n"));

    const result = await lintFiles(["doc.adoc"], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD025")).toBe(false);
  });

  it("resolves inline image targets and skips URL image catalogs", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-inline-images-"));
    const doc = path.join(directory, "doc.adoc");
    fs.mkdirSync(path.join(directory, "images"));
    fs.writeFileSync(path.join(directory, "images", "ok.svg"), "<svg></svg>");
    fs.writeFileSync(doc, [
      "= Title",
      ":imagesdir: images",
      "",
      "See image:ok.svg[OK] and image:missing.svg[Missing].",
      "",
      ":imagesdir: https://cdn.example.com/assets",
      "",
      "image::remote.svg[Remote]",
      "See image:remote-inline.svg[Remote inline].",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const missingImages = result.findings.filter((finding) => finding.ruleId === "AD025");

    expect(missingImages.map((finding) => finding.message)).toEqual(["Missing image target: missing.svg"]);
  });

  it("supports config extends presets and ignores", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-extends-"));
    const kept = path.join(directory, "kept.adoc");
    const ignoredDirectory = path.join(directory, "build");
    const ignored = path.join(ignoredDirectory, "ignored.adoc");
    const config = path.join(directory, ".asciidoclint", "config.yaml");
    fs.mkdirSync(path.dirname(config), { recursive: true });
    fs.mkdirSync(ignoredDirectory);
    fs.writeFileSync(kept, "= Title\n\nimage::missing.png[]\n\n=== Skipped\n");
    fs.writeFileSync(ignored, "= Title\n\nimage::ignored-missing.png[]\n");
    fs.writeFileSync(config, [
      "extends:",
      "  - asciidoclint:dependencies",
      "ignores:",
      "  - build/**",
      "",
    ].join("\n"));

    const result = await lintFiles(["**/*.adoc"], { configFile: config, cwd: directory });
    const messages = result.findings.map((finding) => finding.message);

    expect(result.files).toEqual([kept]);
    expect(messages).toContain("Missing image target: missing.png");
    expect(messages.some((message) => message.includes("ignored-missing.png"))).toBe(false);
    expect(result.findings.some((finding) => finding.ruleId === "AD001")).toBe(false);
  });

  it("resolves conditionals and records whether branches are active", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-conditionals-"));
    const inactive = path.join(directory, "inactive.adoc");
    const active = path.join(directory, "active.adoc");
    fs.writeFileSync(inactive, [
      "= Title",
      "",
      "ifdef::draft[]",
      "=== Draft Section",
      "image::missing-draft.png[]",
      "endif::[]",
      "",
    ].join("\n"));
    fs.writeFileSync(active, [
      "= Title",
      ":draft:",
      "",
      "ifdef::draft[]",
      "=== Draft Section",
      "image::missing-draft.png[]",
      "endif::[]",
      "",
    ].join("\n"));

    const inactiveResult = await lintFiles([inactive], { cwd: directory });
    expect(inactiveResult.findings.some((finding) => finding.message.includes("Draft Section"))).toBe(false);
    expect(inactiveResult.findings.some((finding) => finding.message.includes("missing-draft.png"))).toBe(false);

    const activeResult = await lintFiles([active], { cwd: directory });
    expect(activeResult.findings.some((finding) => finding.message.includes("missing-draft.png"))).toBe(true);
  });

  it("populates source maps for root and included files", () => {
    const document = parseDocument(apiFixture("master.adoc"));
    const mappedFiles = new Set(document.sourceMap.map((record) => path.basename(record.source.file)));

    expect(mappedFiles.has("master.adoc")).toBe(true);
    expect(mappedFiles.has("included-chapter.adoc")).toBe(true);
    expect(document.sourceMap.some((record) => path.basename(record.source.file) === "included-chapter.adoc" && record.source.line === 1)).toBe(true);
    expect(document.sourceMap.every((record, index) => record.expandedLine === index + 1)).toBe(true);
  });

  it("records explicit section styles on normalized sections", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-section-styles-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[appendix]",
      "== Reference",
      "",
      "[glossary]",
      "[#glossary]",
      "== Glossary",
      "",
    ].join("\n"));

    const document = parseDocument(doc);

    expect(document.sections.map((section) => [section.title, section.style])).toEqual([
      ["Title", undefined],
      ["Reference", "appendix"],
      ["Glossary", "glossary"],
    ]);
  });

  it("allows a wrapper document to get its document title from the first include", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-wrapper-title-"));
    fs.writeFileSync(path.join(directory, "doc.adoc"), "include::title-page.adoc[]\n\ninclude::chapter.adoc[]\n");
    fs.writeFileSync(path.join(directory, "title-page.adoc"), "= Wrapped Document\n");
    fs.writeFileSync(path.join(directory, "chapter.adoc"), "== Chapter\n");

    const result = await lintFiles(["doc.adoc"], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD006")).toBe(false);
    expect(result.findings.some((finding) => finding.ruleId === "AD005")).toBe(false);
  });

  it("reports included level-0 document titles as errors unless leveloffset makes them sections", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-title-"));
    fs.writeFileSync(path.join(directory, "chapter.adoc"), "= Chapter Title\n\ncontent\n");
    fs.writeFileSync(path.join(directory, "bad.adoc"), "= Root Title\n\ninclude::chapter.adoc[]\n");
    fs.writeFileSync(path.join(directory, "good.adoc"), "= Root Title\n\ninclude::chapter.adoc[leveloffset=+1]\n");

    const bad = await lintFiles(["bad.adoc"], { cwd: directory });
    const good = await lintFiles(["good.adoc"], { cwd: directory });
    const finding = bad.findings.find((item) => item.ruleId === "AD006");

    expect(finding?.severity).toBe("error");
    expect(good.findings.some((item) => item.ruleId === "AD006")).toBe(false);
  });

  it("reports included supported Markdown-style level-0 document titles", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-markdown-title-"));
    fs.writeFileSync(path.join(directory, "chapter.adoc"), "# Chapter Title\n\ncontent\n");
    fs.writeFileSync(path.join(directory, "doc.adoc"), "= Root Title\n\ninclude::chapter.adoc[]\n");

    const result = await lintFiles(["doc.adoc"], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD006")).toBe(true);
  });

  it("allows book documents to include level-0 part files", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-book-include-parts-"));
    fs.writeFileSync(path.join(directory, "part-one.adoc"), "= Part One\n\n== Chapter One\n\ncontent\n");
    fs.writeFileSync(path.join(directory, "part-two.adoc"), "= Part Two\n\n== Chapter Two\n\ncontent\n");
    fs.writeFileSync(path.join(directory, "book.adoc"), [
      ":doctype: book",
      "",
      "= Book Title",
      "",
      "include::part-one.adoc[]",
      "",
      "include::part-two.adoc[]",
      "",
    ].join("\n"));

    const result = await lintFiles(["book.adoc"], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD006")).toBe(false);
  });

  it("allows level-0 appendices in book documents", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-book-appendix-"));
    const doc = path.join(directory, "book.adoc");
    fs.writeFileSync(doc, [
      ":doctype: book",
      "= Book",
      "",
      "= Part One",
      "",
      "== Chapter",
      "",
      "[appendix]",
      "= API Reference",
      "",
      "=== Child",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD020")).toBe(false);
  });

  it("reports appendix placement mismatches documented by Asciidoctor", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-appendix-placement-"));
    const articleLevelZero = path.join(directory, "article-level-zero.adoc");
    const articleNested = path.join(directory, "article-nested.adoc");
    const bookNested = path.join(directory, "book-nested.adoc");
    const blockMarker = path.join(directory, "block-marker.adoc");
    fs.writeFileSync(articleLevelZero, [
      "= Article",
      "",
      "[appendix]",
      "= API Reference",
      "",
    ].join("\n"));
    fs.writeFileSync(articleNested, [
      "= Article",
      "",
      "== Body",
      "",
      "[appendix]",
      "=== Nested Appendix",
      "",
    ].join("\n"));
    fs.writeFileSync(bookNested, [
      "= Book",
      ":doctype: book",
      "",
      "== Chapter",
      "",
      "[appendix]",
      "=== Nested Appendix",
      "",
    ].join("\n"));
    fs.writeFileSync(blockMarker, [
      "= Article",
      "",
      "[appendix]",
      "----",
      "Block",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([articleLevelZero, articleNested, bookNested, blockMarker], { cwd: directory });
    const messages = result.findings.filter((finding) => finding.ruleId === "AD020").map((finding) => finding.message);

    expect(messages).toContain("Article appendix should use a level-1 section heading");
    expect(messages.filter((message) => message === "Article appendix should use a level-1 section heading")).toHaveLength(2);
    expect(messages).toContain("Book appendix should use a level-0 or level-1 section heading, not a nested subsection");
    expect(messages).toContain("[appendix] should apply to a section heading");
  });

  it("allows documented article and book appendix section levels", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-appendix-valid-"));
    const article = path.join(directory, "article.adoc");
    const book = path.join(directory, "book.adoc");
    const anchored = path.join(directory, "anchored.adoc");
    const modular = path.join(directory, "modular.adoc");
    const appendix = path.join(directory, "appendix.adoc");
    fs.writeFileSync(article, [
      "= Article",
      "",
      "== Body",
      "",
      "[appendix]",
      "== API Reference",
      "",
      "=== Child",
      "",
    ].join("\n"));
    fs.writeFileSync(book, [
      "= Book",
      ":doctype: book",
      "",
      "= Part One",
      "",
      "== Chapter",
      "",
      "[appendix]",
      "= Part Appendix",
      "",
      "=== Child",
      "",
      "[appendix]",
      "== Chapter Appendix",
      "",
      "=== Child",
      "",
    ].join("\n"));
    fs.writeFileSync(anchored, [
      "= Article",
      "",
      "[appendix]",
      "",
      "[[api-reference]]",
      "== API Reference",
      "",
    ].join("\n"));
    fs.writeFileSync(modular, [
      "= Article",
      "",
      "[appendix]",
      "include::appendix.adoc[]",
      "",
    ].join("\n"));
    fs.writeFileSync(appendix, [
      "[[api-reference]]",
      "== API Reference",
      "",
    ].join("\n"));

    const result = await lintFiles([article, book, anchored, modular], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD020")).toBe(false);
  });

  it("reports preface placement mismatches documented by Asciidoctor", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-preface-placement-"));
    const article = path.join(directory, "article.adoc");
    const bookAfterChapter = path.join(directory, "book-after-chapter.adoc");
    const partAfterChapter = path.join(directory, "part-after-chapter.adoc");
    const nestedPreface = path.join(directory, "nested-preface.adoc");
    const blockMarker = path.join(directory, "block-marker.adoc");
    fs.writeFileSync(article, [
      "= Article",
      ":sectnums:",
      "",
      "[preface#notices]",
      "== Notices",
      "",
      "== Body",
      "",
    ].join("\n"));
    fs.writeFileSync(bookAfterChapter, [
      "= Book",
      ":doctype: book",
      ":sectnums:",
      "",
      "== Chapter",
      "",
      "[preface]",
      "== Preface",
      "",
    ].join("\n"));
    fs.writeFileSync(partAfterChapter, [
      "= Book",
      ":doctype: book",
      ":sectnums:",
      "",
      "= Part One",
      "",
      "== Chapter",
      "",
      "[preface]",
      "== Part Preface",
      "",
    ].join("\n"));
    fs.writeFileSync(nestedPreface, [
      "= Book",
      ":doctype: book",
      ":sectnums:",
      "",
      "== Chapter",
      "",
      "[preface]",
      "=== Nested Preface",
      "",
    ].join("\n"));
    fs.writeFileSync(blockMarker, [
      "= Book",
      ":doctype: book",
      "",
      "[preface]",
      "====",
      "Block",
      "====",
      "",
    ].join("\n"));

    const result = await lintFiles([article, bookAfterChapter, partAfterChapter, nestedPreface, blockMarker], { cwd: directory });
    const messages = result.findings.filter((finding) => finding.ruleId === "AD046").map((finding) => finding.message);

    expect(messages).toContain("Preface section is documented for book doctype, not article documents");
    expect(messages).toContain("Book preface should appear before normal chapters");
    expect(messages).toContain("Part preface should be the first section in its part");
    expect(messages).toContain("Preface section should be level 0 or level 1, not a nested subsection");
    expect(messages).toContain("[preface] should apply to a section heading");
  });

  it("allows documented book and part preface placement", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-preface-valid-"));
    const doc = path.join(directory, "book.adoc");
    const modularDoc = path.join(directory, "modular-book.adoc");
    const partPreface = path.join(directory, "part-preface.adoc");
    const multiplePrefaces = path.join(directory, "multiple-prefaces.adoc");
    const anchoredPreface = path.join(directory, "anchored-preface.adoc");
    fs.writeFileSync(doc, [
      "= Book",
      ":doctype: book",
      ":sectnums:",
      "",
      "[preface]",
      "== Preface",
      "",
      "=== Preface Subsection",
      "",
      "== Chapter",
      "",
      "= Part One",
      "",
      "[preface]",
      "== Part Preface",
      "",
      "== Part Chapter",
      "",
    ].join("\n"));
    fs.writeFileSync(modularDoc, [
      "= Book",
      ":doctype: book",
      "",
      "= Part One",
      "",
      "include::part-preface.adoc[]",
      "",
      "== Part Chapter",
      "",
    ].join("\n"));
    fs.writeFileSync(partPreface, [
      "[preface#part-preface]",
      "== Part Preface",
      "",
      "Part introduction.",
      "",
    ].join("\n"));
    fs.writeFileSync(multiplePrefaces, [
      "= Book",
      ":doctype: book",
      "",
      "[preface]",
      "== Revision History",
      "",
      "[preface]",
      "== Authors",
      "",
      "== Chapter",
      "",
    ].join("\n"));
    fs.writeFileSync(anchoredPreface, [
      "= Book",
      ":doctype: book",
      "",
      "[preface]",
      "",
      "[[revision-history]]",
      "== Revision History",
      "",
      "== Chapter",
      "",
    ].join("\n"));

    const result = await lintFiles([doc, modularDoc, multiplePrefaces, anchoredPreface], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD046")).toBe(false);
  });

  it("reports special section placement mismatches documented by Asciidoctor", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-special-section-placement-"));
    const article = path.join(directory, "article.adoc");
    const book = path.join(directory, "book.adoc");
    fs.writeFileSync(article, [
      "= Article",
      "",
      "== Body",
      "",
      "[abstract]",
      "=== Nested Abstract",
      "",
      "[bibliography]",
      "Reference paragraph.",
      "",
      "[glossary]",
      "=== Nested Glossary",
      "",
      "[index]",
      "=== Nested Index",
      "",
      "[acknowledgments]",
      "== Thanks",
      "",
      "[dedication]",
      "== Dedication",
      "",
      "[colophon]",
      "== Colophon",
      "",
    ].join("\n"));
    fs.writeFileSync(book, [
      "= Book",
      ":doctype: book",
      "",
      "= Part One",
      "",
      "== Chapter",
      "",
      "[partintro]",
      "Late part introduction.",
      "",
      "[acknowledgments]",
      "=== Nested Thanks",
      "",
      "[dedication]",
      "----",
      "Block",
      "----",
      "",
      "[colophon]",
      "=== Nested Colophon",
      "",
    ].join("\n"));

    const result = await lintFiles([article, book], { cwd: directory });
    const messagesByRule = new Map<string, string[]>();
    for (const finding of result.findings) {
      messagesByRule.set(finding.ruleId, [...(messagesByRule.get(finding.ruleId) ?? []), finding.message]);
    }

    expect(messagesByRule.get("AD047")).toContain("Article abstract should use a level-1 section heading");
    expect(messagesByRule.get("AD048")).toContain("[bibliography] should apply to a section heading");
    expect(messagesByRule.get("AD049")).toContain("Article glossary should use a level-1 section heading");
    expect(messagesByRule.get("AD050")).toContain("Article index should use a level-1 section heading");
    expect(messagesByRule.get("AD051")).toContain("[partintro] should appear before the first section in its part");
    expect(messagesByRule.get("AD052")).toContain("Acknowledgments section is documented for book doctype, not article documents");
    expect(messagesByRule.get("AD052")).toContain("Book acknowledgments should use a level-0 or level-1 section heading, not a nested subsection");
    expect(messagesByRule.get("AD053")).toContain("Dedication section is documented for book doctype, not article documents");
    expect(messagesByRule.get("AD053")).toContain("[dedication] should apply to a section heading");
    expect(messagesByRule.get("AD054")).toContain("Colophon section is documented for book doctype, not article documents");
    expect(messagesByRule.get("AD054")).toContain("Book colophon should use a level-0 or level-1 section heading, not a nested subsection");
  });

  it("reports special section edge cases that Asciidoctor accepts permissively", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-special-section-edge-cases-"));
    const article = path.join(directory, "article.adoc");
    const book = path.join(directory, "book.adoc");
    fs.writeFileSync(article, [
      "= Article",
      "",
      "== Body",
      "",
      "[abstract]",
      "== Late Abstract",
      "",
      "[bibliography]",
      "= References",
      "",
      "[partintro]",
      "Article part intro.",
      "",
    ].join("\n"));
    fs.writeFileSync(book, [
      "= Book",
      ":doctype: book",
      "",
      "[abstract]",
      "== Abstract",
      "",
      "[glossary]",
      "----",
      "Terms",
      "----",
      "",
      "[index]",
      "----",
      "Index entries",
      "----",
      "",
      "= Part One",
      "",
      "[partintro]",
      "== Section-shaped Part Intro",
      "",
      "== Chapter",
      "",
    ].join("\n"));

    const result = await lintFiles([article, book], { cwd: directory });
    const messagesByRule = new Map<string, string[]>();
    for (const finding of result.findings) {
      messagesByRule.set(finding.ruleId, [...(messagesByRule.get(finding.ruleId) ?? []), finding.message]);
    }

    expect(messagesByRule.get("AD047")).toContain("Article abstract should appear before normal body sections");
    expect(messagesByRule.get("AD047")).toContain("Abstract section is documented for article doctype, not book documents");
    expect(messagesByRule.get("AD048")).toContain("Article bibliography should use a level-1 or nested section heading");
    expect(messagesByRule.get("AD049")).toContain("[glossary] should apply to a section heading");
    expect(messagesByRule.get("AD050")).toContain("[index] should apply to a section heading");
    expect(messagesByRule.get("AD051")).toContain("[partintro] should appear inside a book part");
    expect(messagesByRule.get("AD051")).toContain("[partintro] should apply to a block inside a book part, not a section heading");
  });

  it("allows documented special section placements", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-special-section-valid-"));
    const article = path.join(directory, "article.adoc");
    const book = path.join(directory, "book.adoc");
    fs.writeFileSync(article, [
      "= Article",
      "",
      "[abstract]",
      "== Abstract",
      "",
      "Summary.",
      "",
      "== Body",
      "",
      "[bibliography]",
      "=== Scoped References",
      "",
      "* [[[ref]]] Reference.",
      "",
      "[glossary]",
      "== Glossary",
      "",
      "term:: Definition.",
      "",
      "[index]",
      "== Index",
      "",
    ].join("\n"));
    fs.writeFileSync(book, [
      "= Book",
      ":doctype: book",
      "",
      "[dedication]",
      "== Dedication",
      "",
      "[acknowledgments]",
      "== Acknowledgments",
      "",
      "= Part One",
      "",
      "[partintro]",
      "Part introduction.",
      "",
      "== Chapter",
      "",
      "[colophon]",
      "== Colophon",
      "",
    ].join("\n"));

    const result = await lintFiles([article, book], { cwd: directory });
    const specialRuleIds = new Set(["AD047", "AD048", "AD049", "AD050", "AD051", "AD052", "AD053", "AD054"]);

    expect(result.findings.some((finding) => specialRuleIds.has(finding.ruleId))).toBe(false);
  });

  it("allows documented special section multipart and nested-content forms", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-special-section-valid-forms-"));
    const article = path.join(directory, "article.adoc");
    const book = path.join(directory, "book.adoc");
    fs.writeFileSync(article, [
      "= Article",
      "",
      "[abstract#summary]",
      "== Abstract",
      "",
      "Summary.",
      "",
      "== Body",
      "",
      "[bibliography]",
      "=== Section References",
      "",
      "* [[[section-ref]]] Section reference.",
      "",
      "[glossary#terms]",
      "",
      "[[glossary-anchor]]",
      "== Glossary",
      "",
      "term:: Definition.",
      "",
      "[index#idx]",
      "== Index",
      "",
    ].join("\n"));
    fs.writeFileSync(book, [
      "= Book",
      ":doctype: book",
      "",
      "[dedication]",
      "= Dedication",
      "",
      "For the team.",
      "",
      "[acknowledgments]",
      "= Acknowledgments",
      "",
      "Thanks.",
      "",
      "= Part One",
      "",
      "[partintro]",
      "--",
      "Part introduction.",
      "--",
      "",
      "== Chapter",
      "",
      "[glossary]",
      "= Glossary",
      "",
      "term:: Definition.",
      "",
      "[index]",
      "= Index",
      "",
      "[colophon]",
      "= Colophon",
      "",
      "Production notes.",
      "",
    ].join("\n"));

    const result = await lintFiles([article, book], { cwd: directory });
    const specialRuleIds = new Set(["AD047", "AD048", "AD049", "AD050", "AD051", "AD052", "AD053", "AD054"]);

    expect(result.findings.some((finding) => specialRuleIds.has(finding.ruleId))).toBe(false);
  });

  it("does not apply generic list, inline, block-spacing, or cell-count checks to table cell content", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-context-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Open Issues",
      "[cols=\"25%,50%,25%\",options=\"header\"]",
      "|===",
      "| Issue | Description | Status",
      "| Feature Area a|",
      "* Item inside an AsciiDoc table cell | Closed",
      "| Rowspan .2+|Item A +",
      "Item B",
      "| Description",
      "|===",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).not.toContain("AD004");
    expect(ids).not.toContain("AD008");
    expect(ids).not.toContain("AD032");
    expect(ids).not.toContain("AD041");
  });

  it("does not treat consecutive table cell lines as cell-count errors", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-cell-stream-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Cells",
      "[cols=\"1,1\"]",
      "|===",
      "| one",
      "| two",
      "| three",
      "| four",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD004")).toBe(false);
  });

  it("allows table rows with explicit row and column spans", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-spans-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Spans",
      "[cols=\"1,1,1\"]",
      "|===",
      "| A 2+| B spans two columns",
      "",
      ".2+| C spans two rows | D | E",
      "| F | G",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD004")).toBe(false);
  });

  it("reports table source cells omitted from rendered output", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-omitted-cell-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Cells",
      "[cols=\"1,1\"]",
      "|===",
      "| one | two | omitted",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const finding = result.findings.find((item) => item.ruleId === "AD004");

    expect(finding?.message).toContain("did not render");
  });

  it("reports incomplete nested alternate-separator table rows", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-nested-table-omitted-cell-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[cols=\"1,1\"]",
      "|===",
      "2+a|",
      "[cols=\",\",options=\"header\"]",
      "!===",
      "!Name !Value",
      "a!",
      "Only one cell in the final row",
      "!===",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const finding = result.findings.find((item) => item.ruleId === "AD004");

    expect(finding?.range.start.line).toBe(9);
    expect(finding?.message).toContain("Nested table row has 1 cell but declares 2 columns");
  });

  it("reports incomplete nested alternate-separator table rows with compact column counts", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-nested-table-compact-cols-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[cols=\"1\"]",
      "|===",
      "a|",
      "[cols=\"2*\"]",
      "!===",
      "! only one",
      "!===",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const finding = result.findings.find((item) => item.ruleId === "AD004");

    expect(finding?.range.start.line).toBe(8);
    expect(finding?.message).toContain("Nested table row has 1 cell but declares 2 columns");
  });

  it("handles nested list markers and escaped table pipes without false positives", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-list-table-syntax-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "* Parent item",
      "** Nested item with *valid inline* formatting",
      "* Math expression 64+96 + 256 + 128 bits is text, not formatting",
      "* Math expression 128 * 4 = 512 is text, not formatting",
      "* Description: buffer size is 16 blocks * 128 bits = 2048 bits.",
      "* Formula: Q = d*P = floor(d / r) * (r*P) + (d mod r) * P.",
      "* Compute *_result_* = *_x_* * *_y_* mod *_m_*.",
      "* Compute *_A_* = *_s * B_* with the engine.",
      "* Sibling item",
      "",
      "* Item with explicit continuation +",
      "attached text",
      "",
      "[cols=\"50%,50%\"]",
      "|===",
      "|Formula A |function(value) = expression(input \\|\\| suffix, output)",
      "|===",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).not.toContain("AD004");
    expect(ids).not.toContain("AD008");
    expect(ids).not.toContain("AD041");
  });

  it("resolves shorthand xrefs against the expanded include tree and inline anchors", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-expanded-xrefs-"));
    fs.writeFileSync(path.join(directory, "doc.adoc"), [
      "= Title",
      "",
      "See <<later-anchor>> and <<inline-anchor>>.",
      "",
      "include::chapter.adoc[]",
    ].join("\n"));
    fs.writeFileSync(path.join(directory, "chapter.adoc"), [
      "[[later-anchor]]",
      "== Later",
      "",
      ". [[inline-anchor]]https://example.com[Inline Anchor]",
    ].join("\n"));

    const result = await lintFiles(["doc.adoc"], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD026")).toBe(false);
  });

  it("resolves block IDs that include additional attributes", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-block-id-attrs-"));
    fs.writeFileSync(path.join(directory, "doc.adoc"), [
      "= Title",
      "",
      "See <<Example_Component_for_Generic_Field>>.",
      "",
      ".Example Component",
      "[#Example_Component_for_Generic_Field,align=center]",
      "image::image.png[Example Component]",
      "",
    ].join("\n"));
    fs.writeFileSync(path.join(directory, "image.png"), "png");

    const result = await lintFiles(["doc.adoc"], { cwd: directory });
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).not.toContain("AD026");
  });

  it("does not collect cross references from line comments", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-comment-xref-"));
    fs.writeFileSync(path.join(directory, "doc.adoc"), [
      "= Title",
      "",
      "// See <<missing-anchor>>.",
    ].join("\n"));

    const result = await lintFiles(["doc.adoc"], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD026")).toBe(false);
  });

  it("does not lint rendered-content rules inside block comments", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-block-comment-"));
    fs.writeFileSync(path.join(directory, "doc.adoc"), [
      "= Title",
      "",
      "////",
      "[#commented_table]",
      ".Commented Table",
      "[cols=\"1,1\",options=\"header\"]",
      "|===",
      "| A | B",
      "| Value | Value with ++<++ residue | <<missing-anchor>> | image::missing.png[]",
      "Commented text with a hard\ttab and trailing spaces  ",
      "|===",
      "# Markdown heading inside a comment",
      "* List item inside a comment",
      "attached paragraph inside a comment",
      "////",
      "",
      "== Rendered Section",
      "",
      "Content.",
    ].join("\n"));

    const result = await lintFiles(["doc.adoc"], { cwd: directory });
    const commentLineFindings = result.findings.filter((finding) => (
      finding.range.start.line > 3 && finding.range.start.line < 15
    ));

    expect(commentLineFindings.map((finding) => finding.ruleId)).toEqual([]);
  });

  it("does not lint rendered-content rules inside alternate comment blocks and paragraphs", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-comment-style-"));
    fs.writeFileSync(path.join(directory, "doc.adoc"), [
      "= Title",
      "",
      "[comment]",
      "--",
      "|===",
      "| A | B | C",
      "|===",
      "<<missing-open-block-anchor>>",
      "--",
      "",
      "[comment]",
      "Comment paragraph with a hard\ttab and trailing spaces  ",
      "paragraph with ++<++ residue and <<missing-paragraph-anchor>>",
      "",
      "== Rendered Section",
      "",
      "Content.",
    ].join("\n"));

    const result = await lintFiles(["doc.adoc"], { cwd: directory });
    const commentLineFindings = result.findings.filter((finding) => (
      (finding.range.start.line > 3 && finding.range.start.line < 9)
      || (finding.range.start.line > 11 && finding.range.start.line < 14)
    ));

    expect(commentLineFindings.map((finding) => finding.ruleId)).toEqual([]);
  });

  it("validates section progression in expanded include order", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-expanded-headings-"));
    fs.writeFileSync(path.join(directory, "doc.adoc"), [
      "= Title",
      "",
      "== Unit Description",
      "",
      "=== Engines",
      "",
      "include::engine.adoc[]",
    ].join("\n"));
    fs.writeFileSync(path.join(directory, "engine.adoc"), "==== Included Component\n");

    const result = await lintFiles(["doc.adoc"], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD001")).toBe(false);
  });

  it("covers generic reference-derived gaps with dedicated fixtures", async () => {
    const result = await lintFiles([ruleFixture("AD029-markdown-link-image-residue", "bad.adoc")]);
    const markdownFindings = result.findings.filter((finding) => finding.ruleId === "AD029");
    const messages = markdownFindings.map((finding) => finding.message);

    expect(result.findings.some((finding) => finding.ruleId === "AD006")).toBe(true);
    expect(messages).toContain("Markdown link syntax renders as text in AsciiDoc");
    expect(messages).toContain("Markdown image syntax renders as text in AsciiDoc");
    expect(messages).toContain("Reversed Markdown link residue renders as text in AsciiDoc");
    expect(markdownFindings).toHaveLength(3);
    expect(markdownFindings.every((finding) => finding.fix?.applicability === "unsafe")).toBe(true);
    expect(messages.some((message) => message.includes("heading"))).toBe(false);
    expect(messages.some((message) => message.includes("fenced"))).toBe(false);
    expect(messages.some((message) => message.includes("inside source"))).toBe(false);
  });

  it("applies unsafe fixes for Markdown link and image residue", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-markdown-residue-fix-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "See [Overview](overview.adoc).",
      "",
      "![Diagram](diagram.png)",
      "",
      "Inline ![Icon](icon.png) marker.",
      "",
      "(https://example.com)[Example]",
      "",
    ].join("\n"));

    await lintFiles([doc], { cwd: directory, fix: true, unsafeFixes: true });

    expect(fs.readFileSync(doc, "utf8")).toContain("See xref:overview.adoc[Overview].");
    expect(fs.readFileSync(doc, "utf8")).toContain("image::diagram.png[Diagram]");
    expect(fs.readFileSync(doc, "utf8")).toContain("Inline image:icon.png[Icon] marker.");
    expect(fs.readFileSync(doc, "utf8")).toContain("link:https://example.com[Example]");
  });

  it("reports missing document titles", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-title-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "== Overview\n\nContent.\n");

    const result = await lintFiles([doc], { cwd: directory });
    const finding = result.findings.find((item) => item.ruleId === "AD005");

    expect(finding?.severity).toBe("info");
  });

  it("allows explicit title attributes as document titles", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-title-attribute-"));
    const titleDoc = path.join(directory, "title.adoc");
    const doctitleDoc = path.join(directory, "doctitle.adoc");
    fs.writeFileSync(titleDoc, ":title: Attribute Title\n\n== Overview\n\nContent.\n");
    fs.writeFileSync(doctitleDoc, ":doctitle: Attribute Title\n\n== Overview\n\nContent.\n");

    const titleResult = await lintFiles([titleDoc], { cwd: directory });
    const doctitleResult = await lintFiles([doctitleDoc], { cwd: directory });

    expect(titleResult.findings.some((finding) => finding.ruleId === "AD005")).toBe(false);
    expect(doctitleResult.findings.some((finding) => finding.ruleId === "AD005")).toBe(false);
  });

  it("accepts supported Markdown-style level-0 headings as explicit document titles", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-markdown-title-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "# Product Guide\n\n## Overview\n\nContent.\n");

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD005")).toBe(false);
  });

  it("treats the first level-0 title in a book as the explicit document title", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-book-title-"));
    const doc = path.join(directory, "book.adoc");
    fs.writeFileSync(doc, ":doctype: book\n\n= Product Guide\n\n= Part One\n");

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD005")).toBe(false);
  });

  it("reports headings deeper than Asciidoctor's supported depth", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-depth-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "= Title\n\n======= Too Deep\n");

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD007")).toBe(true);
  });

  it("reports unsupported Markdown-style heading depth and ignores protected blocks", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-markdown-heading-depth-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "####### Too Deep",
      "",
      "----",
      "======= Not a heading in source",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD007");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.range.start.line).toBe(3);
  });

  it("applies hard-tab safe fixes", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-tabs-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "= Title\n\n*\tTabbed\titem\n");

    const before = await lintFiles([doc], { cwd: directory });
    expect(before.findings.filter((finding) => finding.ruleId === "AD034")).toHaveLength(2);

    const after = await lintFiles([doc], { cwd: directory, fix: true });
    expect(fs.readFileSync(doc, "utf8")).toBe("= Title\n\n* Tabbed item\n");
    expect(after.findings.some((finding) => finding.ruleId === "AD034")).toBe(false);
  });

  it("does not report hard tabs inside protected blocks or table bodies", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-tabs-exempt-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "----",
      "const value\t= 1;",
      "----",
      "",
      "[%header,format=tsv]",
      "|===",
      "Name\tValue",
      "Alpha\t1",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD034")).toBe(false);
  });

  it("writes diagnostics artifacts for editor import", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-diagnostics-artifact-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "= Title\n\n=== Skipped\n");

    const result = await lintFiles(["doc.adoc"], {
      cwd: directory,
      outputDiagnosticsFile: ".asciidoclint/diagnostics.json",
    });
    const artifact = JSON.parse(fs.readFileSync(path.join(directory, ".asciidoclint", "diagnostics.json"), "utf8"));

    expect(result.findings.some((finding) => finding.ruleId === "AD001")).toBe(true);
    expect(artifact).toMatchObject({
      version: 1,
      source: "asciidoclint",
      cwd: directory,
      fingerprint: {
        tool: {
          name: "asciidoclint",
          version: getVersion(),
        },
        command: {
          targets: ["doc.adoc"],
        },
      },
    });
    expect(artifact.fingerprint.files).toHaveLength(1);
    expect(artifact.fingerprint.files[0].file).toBe(doc);
    expect(artifact.findings.some((finding: { ruleId: string }) => finding.ruleId === "AD001")).toBe(true);
  });

  it("allows soft-wrapped list item text and reports missing list spacing", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-lists-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Paragraph before list",
      "* item",
      "attached paragraph",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD008")).toBe(true);
  });

  it.each([
    ["unordered asterisk", "* item"],
    ["unordered hyphen", "- item"],
    ["nested unordered asterisk", "** item"],
    ["implicit ordered", ". item"],
    ["nested implicit ordered", ".. item"],
    ["explicit ordered", "1. item"],
    ["description double colon", "Term:: description"],
    ["description triple colon", "Term::: description"],
    ["description quadruple colon", "Term:::: description"],
    ["description semicolon", "Term;; description"],
  ])("reports missing blank before %s list markers", async (_name, marker) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-list-marker-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Paragraph before list",
      marker,
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD008")).toBe(true);
  });

  it("allows sibling list items after soft-wrapped item text", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-soft-wrapped-list-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "* First item continues onto",
      "the next source line.",
      "* Second item.",
      ". Third ordered item continues onto",
      "the next source line.",
      ". Fourth ordered item.",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD008")).toBe(false);
  });

  it("allows list style attributes immediately after a delimited block", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-block-list-attribute-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "____",
      "Quoted instruction.",
      "____",
      "[loweralpha]",
      ". Follow-up item.",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD035")).toBe(false);
  });

  it("allows line comments immediately after a delimited block", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-block-comment-follow-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "|===",
      "| A | B",
      "|===",
      "// end::table[]",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD035")).toBe(false);
  });

  it("allows conditionals immediately after a delimited block", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-block-conditional-follow-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "ifdef::backend-html5[]",
      "|===",
      "| A | B",
      "|===",
      "endif::[]",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD035")).toBe(false);
  });

  it("allows anchors, titles, and nonbreaking-space spacers immediately after a delimited block", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-block-follow-structural-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "====",
      "Example content.",
      "====",
      "[[next-block]]",
      ".Next Table",
      "|===",
      "| A | B",
      "|===",
      "{nbsp}",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD035")).toBe(false);
  });

  it("does not report block spacing for delimited blocks inside table cells", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-cell-block-spacing-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Rows",
      "[cols=\"1,1\"]",
      "|===",
      "| Name a|",
      "----",
      "code",
      "----",
      "Text in the same table cell.",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD035")).toBe(false);
  });

  it("allows lists in AsciiDoc table cells", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-cell-list-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Rows",
      "[cols=\"1,1\"]",
      "|===",
      "| Name | Details a|",
      "* First item",
      "* Second item",
      "",
      "a| Text before the list:",
      ". First ordered item",
      "",
      "| Other a|",
      "* Third item",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD008")).toBe(false);
  });

  it("does not lint non-AsciiDoc files included in source blocks as AsciiDoc sources", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-source-include-"));
    const doc = path.join(directory, "doc.adoc");
    const source = path.join(directory, "example.txt");
    fs.writeFileSync(source, "line with trailing spaces  \n");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Example",
      "[source]",
      "----",
      "include::example.txt[]",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.range.start.file === source)).toBe(false);
  });

  it("allows list style attribute lines immediately before list items", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-list-attributes-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[arabic]",
      ". First item",
      ". Second item",
      "[loweralpha]",
      ".. Nested item",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).not.toContain("AD008");
  });

  it("allows indented nested list items without blank lines", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-nested-list-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "* Engine Disable Error",
      "  - Trigger:",
      "    Receive request.",
      "  - Action:",
      "    Drop request.",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).not.toContain("AD008");
  });

  it("allows sibling list items after continuation content", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-list-continuation-sibling-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ". First reference",
      "+",
      "https://example.com/first",
      ". Second reference",
      "+",
      "https://example.com/second",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).not.toContain("AD008");
  });

  it("reports missing titles for tables, images, and diagrams", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-titles-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "|===",
      "| A | B",
      "|===",
      "",
      "image::existing.png[Existing]",
      "",
      "[mermaid]",
      "----",
      "graph LR",
      "----",
      "",
      ".Titled table",
      "|===",
      "| A | B",
      "|===",
      "",
      ".Overview table",
      "|===",
      "| A | B",
      "|===",
      "",
      "[title=\"Attribute titled table\"]",
      "|===",
      "| A | B",
      "|===",
      "",
      ".Titled image",
      "image::existing.png[Existing]",
      "",
      ".Image pipeline",
      "image::existing.png[Existing]",
      "",
      "[title=\"Attribute titled image\"]",
      "image::existing.png[Existing]",
      "",
      "image::existing.png[Existing,title=\"Macro titled image\"]",
      "",
      ".Titled diagram",
      "[mermaid]",
      "----",
      "graph LR",
      "----",
      "",
      ".Diagram flow",
      "[mermaid]",
      "----",
      "graph LR",
      "----",
      "",
      "[title=\"Attribute Titled Diagram\"]",
      "[wavedrom,,svg]",
      "....",
      "{reg: [{bits: 1, name: 'EN'}]}",
      "....",
      "",
      "[wavedrom,title=\"Same-line Attribute Titled Diagram\",format=svg]",
      "....",
      "{reg: [{bits: 1, name: 'EN'}]}",
      "....",
      "",
    ].join("\n"));
    fs.writeFileSync(path.join(directory, "existing.png"), "png");

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD010")).toHaveLength(1);
    expect(result.findings.filter((finding) => finding.ruleId === "AD011")).toHaveLength(1);
    expect(result.findings.filter((finding) => finding.ruleId === "AD012")).toHaveLength(1);
  });

  it("recognizes diagram styles from Asciidoctor Diagram when checking titles", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-diagram-styles-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[ditaa]",
      "----",
      "+---+",
      "----",
      "",
      "[svgbob,title=\"Titled SVG Bob\"]",
      "....",
      "o-->x",
      "....",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD012");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.range.start.line).toBe(4);
  });

  it("does not require a figure title for cover images", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-cover-image-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "image::cover.png[Cover,role=cover-image]",
      "",
    ].join("\n"));
    fs.writeFileSync(path.join(directory, "cover.png"), "png");

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD011")).toHaveLength(0);
  });

  it("allows image alt text containing equality operators", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-image-alt-equals-"));
    const doc = path.join(directory, "doc.adoc");
    fs.mkdirSync(path.join(directory, "images"));
    fs.writeFileSync(path.join(directory, "images", "rule.svg"), "<svg></svg>");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".KWrap Rule",
      "image::images/rule.svg[KWrap Rule source cloneable==1,align=center]",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain("AD028");
  });

  it("reports explicitly empty and generated placeholder alt text for block and inline images", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-empty-image-alt-"));
    const doc = path.join(directory, "doc.adoc");
    for (const image of ["diagram.png", "play.png", "empty.png", "generated.png", "positional.png", "generic.png", "inline.png", "derived.png", "sized.png", "pause.png"]) {
      fs.writeFileSync(path.join(directory, image), "png");
    }
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "image::diagram.png[alt=\"\"]",
      "",
      "Click image:play.png[\"\"] to start.",
      "",
      "Click image:empty.png[alt=\" \"] to stop.",
      "",
      "image::generated.png[Diagram Description automatically generated with medium confidence]",
      "",
      "image::positional.png[align=center,Text Description automatically generated,width=480]",
      "",
      "image::generic.png[A screenshot of a computer Description automatically generated with medium confidence]",
      "",
      "Click image:inline.png[Application Description automatically generated] here.",
      "",
      "image::derived.png[]",
      "",
      "Click image:sized.png[,20,20] here.",
      "",
      "Click image:pause.png[title=Pause] here.",
      "",
      "// image::comment.png[Diagram Description automatically generated]",
      "// Click image:comment-inline.png[\"\"] here.",
      "",
      "[comment]",
      "image::comment-paragraph.png[Diagram Description automatically generated]",
      "",
      "----",
      "image:literal.png[\"\"]",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD028");

    expect(findings.map((finding) => finding.range.start.line)).toEqual([3, 5, 7, 9, 11, 13, 15]);
    expect(findings[0]?.fixHelper).toContain("image::target.png");
    expect(findings[1]?.fixHelper).toContain("image:target.png");
    expect(findings.slice(3).every((finding) => finding.message.includes("imported"))).toBe(true);
    expect(findings.map((finding) => finding.range.start.line)).not.toContain(23);
    expect(findings.map((finding) => finding.range.start.line)).not.toContain(24);
    expect(findings.map((finding) => finding.range.start.line)).not.toContain(27);
  });

  it("reports DOCX anchor caption residue without flagging semantic anchors", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-docx-anchor-caption-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[#_Toc142906677 .anchor]####Figure 3-1. Overview Diagram.",
      "",
      "[#_Ref123031614 .anchor]####Table -. Status Code.",
      "",
      "[#_Toc142906678 .anchor]####Table 1: Capability List",
      "",
      "[#_Toc142906679 .anchor]####Table 2\u20111: Signal List",
      "",
      "[#_Toc142906680 .anchor]####Figure 6.20",
      "",
      "[#fig-overview]",
      ".Overview",
      "image::overview.png[Overview]",
      "",
      "----",
      "[#_Toc142906677 .anchor]####Figure 3-1. Literal",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD055");

    expect(findings.map((finding) => finding.range.start.line)).toEqual([3, 5, 7, 9, 11]);
    expect(findings[0]?.message).toContain("Figure caption");
    expect(findings[1]?.fixHelper).toContain("semantic anchor");
    expect(findings[2]?.fixHelper).toContain(".Capability List");
    expect(findings[3]?.fixHelper).toContain(".Signal List");
    expect(findings[4]?.fixHelper).toContain("meaningful .Title");
    expect(findings[4]?.fixHelper).not.toContain(".20");
  });

  it("reports blank list continuation residue that captures following content", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-blank-list-continuation-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[arabic]",
      ".. {blank}",
      "+",
      "",
      "== Captured heading",
      "",
      "[arabic, start=3]",
      ". {blank}",
      "+",
      "",
      "Captured paragraph.",
      "",
      "[arabic]",
      ". Real item",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD056");

    expect(findings.map((finding) => [finding.range.start.line, finding.severity])).toEqual([[3, "error"], [9, "warning"]]);
    expect(findings[0]?.message).toContain("section heading");
  });

  it("reports structural lines swallowed by preceding list content", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-blank-after-list-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "* Item",
      "== Captured section",
      "",
      "* Wrapped item",
      "continued text",
      "=== Captured subsection",
      "",
      "* Figure item",
      ".Figure title",
      "image::diagram.png[Diagram]",
      "",
      "* Anchored item",
      "[#fig-captured]",
      "image::diagram.png[Diagram]",
      "",
      "* Image item",
      "image::diagram.png[Diagram]",
      "",
      ". Parent:",
      "[loweralpha]",
      ".. Child",
      "",
      "* Intentional continuation",
      "+",
      ".Attached title",
      "image::diagram.png[Diagram]",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD009");

    expect(findings.map((finding) => [finding.range.start.line, finding.severity, finding.message])).toEqual([
      [4, "error", "Section title should be separated from the preceding list"],
      [8, "error", "Section title should be separated from the preceding list"],
      [11, "warning", "Structural block start should be separated from the preceding list"],
      [15, "warning", "Structural block start should be separated from the preceding list"],
      [19, "warning", "Structural block start should be separated from the preceding list"],
    ]);
  });

  it("reports semantic anchors attached to the wrong block type", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-semantic-anchor-target-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "diagram.png"), "png");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[#fig-detached]",
      ".Detached figure",
      "",
      "Paragraph text.",
      "",
      "[#fig-attached]",
      ".Attached figure",
      "image::diagram.png[Attached figure]",
      "",
      "[#table-detached]",
      ".Detached table",
      "",
      "image::diagram.png[Not a table]",
      "",
      "[#table-attached]",
      ".Attached table",
      "[cols=\"1,1\"]",
      "|===",
      "| A | B",
      "|===",
      "",
      "[#note-general]",
      ".General anchor",
      "Paragraph.",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD057");

    expect(findings.map((finding) => finding.range.start.line)).toEqual([3, 12]);
    expect(findings[0]?.message).toContain("Figure anchor");
    expect(findings[1]?.message).toContain("Table anchor");
  });

  it("reports generic DOCX bookmark hash residue without duplicating caption residue", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-docx-anchor-heading-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "|===",
      "|[#_Toc142906710 .anchor]####Requirement summary |",
      "|===",
      "",
      ". [#_Toc142906711 .anchor]####Glossary",
      "",
      "[#_Toc142906712 .anchor]####Figure 1. Diagram",
      "",
      "[#semantic-anchor]####Not DOCX residue",
      "",
      "----",
      "|[#_Toc142906713 .anchor]####Literal |",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const genericFindings = result.findings.filter((finding) => finding.ruleId === "AD058");
    const captionFindings = result.findings.filter((finding) => finding.ruleId === "AD055");

    expect(genericFindings.map((finding) => finding.range.start.line)).toEqual([4, 7]);
    expect(captionFindings.map((finding) => finding.range.start.line)).toEqual([9]);
  });

  it("reports DOCX-converted nested tables that reuse the containing separator", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-docx-nested-table-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[cols=\"1,1\"]",
      "|===",
      "|Name a|",
      "Context:",
      "",
      "[cols=\"1,1\"]",
      "|===",
      "|Nested |Broken",
      "|===",
      "",
      "|===",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD059");

    expect(findings.map((finding) => [finding.range.start.line, finding.message])).toEqual([
      [9, "Nested table appears to use the same separator as its containing table"],
    ]);
    expect(findings[0]?.fixHelper).toContain("alternate separator");
  });

  it("allows nested tables that use alternate separators", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-valid-nested-table-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[cols=\"1,1\"]",
      "|===",
      "|Name a|",
      "",
      "[cols=\"1,1\"]",
      "!===",
      "!Nested !Valid",
      "!===",
      "",
      "|===",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD059")).toHaveLength(0);
  });

  it("reports nested table structures deeper than three total levels", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-deep-nested-table-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[cols=\"1,1\"]",
      "|===",
      "|Outer a|",
      "",
      "[cols=\"1,1\"]",
      "!===",
      "!Level two a!",
      "",
      "[cols=\"1,1\"]",
      ",===",
      ",Level three a,",
      "",
      "[cols=\"1,1\"]",
      ":===",
      ":Level four :Too deep",
      ":===",
      ",===",
      "!===",
      "|===",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD059");

    expect(findings.map((finding) => [finding.range.start.line, finding.message])).toEqual([
      [16, "Nested table depth exceeds three table levels"],
    ]);
  });

  it("reports generic placeholder titles on titled tables, images, and diagrams", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-placeholder-titles-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "diagram.png"), "png");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Table Table",
      "|===",
      "| A | B",
      "|===",
      "",
      ".Register table",
      "|===",
      "| A | B",
      "|===",
      "",
      ".Table stakes",
      "|===",
      "| A | B",
      "|===",
      "",
      ".Figure",
      "image::diagram.png[Diagram]",
      "",
      ".Figure layout",
      "image::diagram.png[Diagram]",
      "",
      ".Overview",
      "image::diagram.png[Overview]",
      "",
      ".Diagram",
      "[mermaid]",
      "----",
      "graph LR",
      "----",
      "",
      ".Diagram sequence",
      "[mermaid]",
      "----",
      "graph LR",
      "----",
      "",
      ".System flow",
      "[mermaid]",
      "----",
      "graph LR",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const relevant = result.findings.filter((finding) => ["AD010", "AD011", "AD012"].includes(finding.ruleId));

    expect(relevant.map((finding) => [finding.ruleId, finding.message])).toEqual([
      ["AD010", "Table title is a generic placeholder"],
      ["AD011", "Image title is a generic placeholder"],
      ["AD012", "Diagram title is a generic placeholder"],
    ]);
    expect(relevant.every((finding) => finding.fixHelper?.includes("meaningful"))).toBe(true);
  });

  it("reports figure, table, include, appendix, and diagram structure issues", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-structure-gaps-"));
    const doc = path.join(directory, "doc.adoc");
    const child = path.join(directory, "child.adoc");
    fs.writeFileSync(child, "= Child\n");
    fs.writeFileSync(path.join(directory, "existing.png"), "png");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Figure 1: Overview",
      "image::existing.png[Overview]",
      "",
      ".Titled image without anchor",
      "image::existing.png[Overview]",
      "",
      "[[fig-unreferenced]]",
      ".Anchored image without reference",
      "image::existing.png[Overview]",
      "",
      "image:existing.png[Overview]",
      "",
      "Table 1: Registers",
      "|===",
      "| Name | Value",
      "|===",
      "",
      ".Titled table without anchor",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "[[tab-unreferenced]]",
      ".Anchored table without reference",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "include::child.adoc[]",
      "Paragraph immediately after include.",
      "",
      "[appendix]",
      "= API Reference",
      "",
      ".Broken PlantUML",
      "[plantuml]",
      "----",
      "Alice -> Bob",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const ids = new Set(result.findings.map((finding) => finding.ruleId));

    expect(ids).toContain("AD013");
    expect(ids).toContain("AD016");
    expect(ids).toContain("AD017");
    expect(ids).toContain("AD019");
    expect(ids).toContain("AD020");
    expect(ids).not.toContain("AD021");
  });

  it("supports custom policy rules for titled image and table anchors", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-block-anchor-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "existing.png"), "png");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Titled image without anchor",
      "image::existing.png[Overview]",
      "",
      "[#fig-hash]",
      ".Hash image",
      "image::existing.png[Overview]",
      "",
      "[[fig-anchor]]",
      ".Anchor image",
      "image::existing.png[Overview]",
      "",
      "[id=fig-longhand]",
      ".Longhand image",
      "image::existing.png[Overview]",
      "",
      "image::existing.png[Overview,title=\"Macro image\",id=fig-macro]",
      "",
      ".Titled table without anchor",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "[#tab-hash]",
      ".Hash table",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "[[tab-anchor]]",
      ".Anchor table",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "[id=tab-longhand]",
      ".Longhand table",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "[cols=\"1,1\",id=tab-attrs,title=\"Attrs table\"]",
      "|===",
      "| Name | Value",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], {
      cwd: directory,
      customRules: [
        customRuleFixture("ORG129-titled-image-anchor.ts"),
        customRuleFixture("ORG130-titled-table-anchor.ts"),
      ],
    });

    expect(result.findings.filter((finding) => finding.ruleId === "ORG129")).toHaveLength(1);
    expect(result.findings.filter((finding) => finding.ruleId === "ORG130")).toHaveLength(1);
  });

  it("reports imported figure captions before or after images and diagrams", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-figure-caption-residue-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "existing.png"), "png");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Figure 1: Before image",
      "image::existing.png[Before]",
      "",
      "Figure -: Placeholder image",
      "image::existing.png[Placeholder]",
      "",
      "image::existing.png[After]",
      "Figure 2: After image",
      "",
      "Figure 3: Before diagram",
      "[plantuml]",
      "----",
      "Alice -> Bob",
      "----",
      "",
      "Figure 3\u20111. Numbered dash figure",
      "image::existing.png[Numbered dash]",
      "",
      "[plantuml]",
      "----",
      "Alice -> Bob",
      "----",
      "Figure 4: After diagram",
      "",
      ".Correct image title",
      "image::existing.png[Correct]",
      "",
      ".Correct diagram title",
      "[plantuml]",
      "----",
      "Alice -> Bob",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD016");

    expect(findings.map((finding) => finding.range.start.line)).toEqual([3, 6, 10, 12, 18, 25]);
    expect(findings.filter((finding) => finding.range.start.line === 3)).toHaveLength(1);
    expect(findings[0]?.fixHelper).toContain(".Before image");
    expect(findings[1]?.fixHelper).toContain(".Placeholder image");
    expect(findings[2]?.fixHelper).toContain(".After image");
    expect(findings[3]?.fixHelper).toContain(".Before diagram");
    expect(findings[4]?.fixHelper).toContain(".Numbered dash figure");
    expect(findings[5]?.fixHelper).toContain(".After diagram");
  });

  it("does not search across intervening lines for imported figure captions", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-figure-caption-gap-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "existing.png"), "png");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Figure 1: Separated by blank",
      "",
      "image::existing.png[Separated]",
      "",
      "Figure 2: Separated by anchor",
      "[#fig-separated]",
      "image::existing.png[Separated]",
      "",
      "Figure 3: Separated by attributes",
      "[role=wide]",
      "[plantuml]",
      "----",
      "Alice -> Bob",
      "----",
      "",
      "A paragraph mentions Figure 4: Overview",
      "image::existing.png[Not adjacent caption]",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD016")).toHaveLength(0);
  });

  it("reports imported table captions before or after tables", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-caption-residue-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Table 1: Before table",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "Table -: Placeholder table",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "Table 2\u20111. Numbered dash table",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "|===",
      "| Name | Value",
      "|===",
      "Table 2: After table",
      "",
      ".Correct table title",
      "|===",
      "| Name | Value",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD017");

    expect(findings.map((finding) => finding.range.start.line)).toEqual([3, 8, 13, 21]);
    expect(findings[0]?.fixHelper).toContain(".Before table");
    expect(findings[1]?.fixHelper).toContain(".Placeholder table");
    expect(findings[2]?.fixHelper).toContain(".Numbered dash table");
    expect(findings[3]?.fixHelper).toContain(".After table");
  });

  it("does not search across intervening lines for imported table captions", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-caption-gap-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Table 1: Separated by blank",
      "",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "Table 2: Separated by anchor",
      "[#tab-separated]",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "Table 3: Separated by attributes",
      "[cols=\"1,1\"]",
      "|===",
      "| Name | Value",
      "|===",
      "",
      "A paragraph mentions Table 4: Register map",
      "|===",
      "| Name | Value",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD017")).toHaveLength(0);
  });

  it("reports only standalone inline image paragraphs and offers an unsafe block-image fix", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-standalone-inline-image-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "image:https://example.com/diagram.svg[Overview]",
      "",
      "See image:diagram.png[Overview] inline.",
      "",
      "image:linux.png[Linux,150,150,float=\"right\"]",
      "You can find Linux everywhere these days.",
      "",
      " image:literal.png[Literal]",
      "",
      "----",
      "image:source.png[Source]",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD013");

    expect(findings).toHaveLength(2);
    expect(findings[0]?.range.start.line).toBe(3);
    expect(findings[1]?.range.start.line).toBe(7);
    expect(findings[0]?.fix?.applicability).toBe("unsafe");
    expect(findings[1]?.fix?.applicability).toBe("unsafe");
  });

  it("does not scan past WaveDrom literal blocks into later source listings", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-wavedrom-source-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Wave",
      "[wavedrom,format=svg]",
      "....",
      "{ signal: [{ name: 'clk', wave: 'p.....' }] }",
      "....",
      "",
      "[source,verilog]",
      "----",
      "assign valid = ready;",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD021")).toBe(false);
  });

  it("resolves local includes before checking WaveDrom diagram content", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-wavedrom-include-"));
    const doc = path.join(directory, "doc.adoc");
    fs.mkdirSync(path.join(directory, "diagrams"));
    fs.writeFileSync(path.join(directory, "diagrams", "wave.json"), "{ signal: [{ name: 'clk', wave: 'p.....' }] }");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Wave",
      "[wavedrom,format=svg]",
      "....",
      "include::diagrams/wave.json[]",
      "....",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD021")).toBe(false);
  });

  it("does not report include-following content when the next line is a block delimiter", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-block-"));
    const doc = path.join(directory, "doc.adoc");
    const child = path.join(directory, "child.adoc");
    fs.writeFileSync(child, "included text\n");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "include::child.adoc[]",
      "++++",
      "<div></div>",
      "++++",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD019")).toBe(false);
  });

  it("allows document attributes immediately after an include", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-attributes-"));
    const doc = path.join(directory, "doc.adoc");
    const child = path.join(directory, "child.adoc");
    fs.writeFileSync(child, ":included-attr: value\n");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "include::child.adoc[]",
      ":toc: macro",
      ":toc-title: Table of Contents",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD019")).toBe(false);
  });

  it("does not report consecutive include directives when the included file lacks a trailing blank", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-boundary-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "child-one.adoc"), "included paragraph");
    fs.writeFileSync(path.join(directory, "child-two.adoc"), "second paragraph");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "include::child-one.adoc[]",
      "include::child-one.adoc[]",
      "include::child-two.adoc[]",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD019")).toBe(false);
  });

  it("does not report include-following line comments", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-comment-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "child.adoc"), "included paragraph");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "include::child.adoc[]",
      "// tag boundary",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD019")).toBe(false);
  });

  it("reports include-following sections when the included file lacks a trailing blank", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-section-boundary-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "child.adoc"), "included paragraph");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "include::child.adoc[]",
      "== Next Section",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD019");

    expect(findings.map((finding) => finding.range.start.line)).toEqual([4]);
  });

  it("does not report punctuation passthrough residue in line comments", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-passthrough-comment-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "// converted++_++filename.docx",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD039")).toBe(false);
  });

  it("does not report include-following content when the included file provides the separator", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-trailing-blank-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(path.join(directory, "child.adoc"), "included paragraph\n\n");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "include::child.adoc[]",
      "== Next Section",
      "",
      "include::child.adoc[]",
      "following paragraph",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD019")).toBe(false);
  });

  it("allows delimited blocks immediately after section titles", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-heading-block-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "== Overview",
      "****",
      "Sidebar content.",
      "****",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD032")).toBe(false);
  });

  it("reports conversion cleanup residue outside protected blocks", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-cleanup-gaps-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "*",
      "___",
      "A ++|++ B",
      "| A | B |",
      "|---|---|",
      "link:https://example.com[link:https://nested.example[Nested]]",
      "xref:target.adoc[xref:other.adoc[Other]]",
      "link:https://example.com[++<span>Example</span>++]",
      "",
      "[source]",
      "----",
      "*",
      "___",
      "A ++|++ B",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD036")).toHaveLength(1);
    expect(result.findings.filter((finding) => finding.ruleId === "AD037")).toHaveLength(1);
    expect(result.findings.filter((finding) => finding.ruleId === "AD039")).toHaveLength(1);
    expect(result.findings.filter((finding) => finding.ruleId === "AD030")).toHaveLength(1);
    expect(result.findings.filter((finding) => finding.ruleId === "AD031")).toHaveLength(2);
    expect(result.findings.filter((finding) => finding.ruleId === "AD040")).toHaveLength(1);
  });

  it("reports standalone list marker residue variants and skips tables", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-list-marker-residue-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "*",
      "**",
      "-",
      ".",
      "..",
      "10.",
      "",
      ". {empty}",
      "+",
      "----",
      "attached block",
      "----",
      "",
      "|===",
      "| Marker",
      "a|",
      "*",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD036")).toHaveLength(6);
  });

  it("reports three-underscore underline residue and allows quote delimiters", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-underline-residue-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "Important",
      "___",
      "",
      "____",
      "Quote content.",
      "____",
      "",
      "______",
      "Nested quote delimiter length.",
      "______",
      "",
      "|===",
      "| Cell",
      "a|",
      "___",
      "|===",
      "",
      "----",
      "___",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD037")).toHaveLength(1);
  });

  it("does not report plain URL text or protected block content as nested link text", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-nested-link-text-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "link:https://example.com[https://nested.example]",
      "",
      "[source]",
      "----",
      "link:https://example.com[link:https://nested.example[Nested]]",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD031")).toHaveLength(0);
  });

  it("does not report Markdown-compatible syntax or dash rows inside AsciiDoc tables as Markdown residue", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-markdown-compatibility-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "## Markdown-compatible Section",
      "",
      "```ruby",
      "puts 1",
      "```",
      "",
      "> Markdown-compatible quote",
      "",
      "---",
      "",
      "|===",
      "| A | B",
      "|---|---|",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD029")).toHaveLength(0);
    expect(result.findings.filter((finding) => finding.ruleId === "AD030")).toHaveLength(0);
  });

  it("reports mixed AsciiDoc and Markdown-compatible heading styles across includes", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-markdown-heading-mix-"));
    const doc = path.join(directory, "doc.adoc");
    const child = path.join(directory, "child.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "== Overview",
      "",
      "include::child.adoc[]",
      "",
    ].join("\n"));
    fs.writeFileSync(child, "## Child Section\n");

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD045");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.alias).toBe("markdown-heading-mix");
    expect(findings[0]?.severity).toBe("info");
    expect(findings[0]?.range.start.file).toBe(child);
    expect(findings[0]?.fix?.applicability).toBe("unsafe");
    expect(findings[0]?.fix?.edits[0]?.replacement).toBe("==");
  });

  it("allows consistently Markdown-compatible heading style", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-markdown-heading-only-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "# Title",
      "",
      "## Overview",
      "",
      "### Details",
      "",
      "Text.",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD045")).toBe(false);
  });

  it("does not report inline formatting spacing inside inline macro content", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-inline-macro-formatting-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "* Example: compute latexmath:[\\mathbf{(m * r^e)^d \\ mod \\ n}], then continue.",
      "* Example: `Latency = (Input Units + Output Units) * 2`.",
      "* *`GENERIC_REGISTER_SIZE`*: Defines the protected data granularity.",
      "",
      "```",
      "L1_Start_Address = L0_Start_Address + ROOT_CTR_NUM * (ARITY ^ LEVELS)",
      "```",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD041")).toBe(false);
  });

  it("reports malformed constrained inline formatting and allows valid unconstrained pairs", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-inline-formatting-spacing-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "This is * important * text.",
      "This is _ important _ text.",
      "This is `+ code +` text.",
      "This is ** important ** text.",
      "This is __ important __ text.",
      "Use * x + y * in formula text.",
      "// This is * important * inside a comment.",
      "",
      "[comment]",
      "This is _ important _ inside a comment paragraph.",
      "",
      "----",
      "This is * important * inside a listing.",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD041");

    expect(findings.map((finding) => finding.range.start.line)).toEqual([3, 4, 5]);
    expect(findings.every((finding) => finding.fixHelper?.includes("Move spaces outside"))).toBe(true);
  });

  it("does not report valid quote or passthrough delimiters as conversion residue", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-valid-delimiters-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "____",
      "Quoted paragraph.",
      "____",
      "",
      "[latexmath]",
      "++++",
      "x = y + z",
      "++++",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).not.toContain("AD037");
    expect(ids).not.toContain("AD039");
  });

  it("reports safe punctuation passthrough residue and applies safe fixes", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-pipe-passthrough-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "DEVICE++_++STATUS and PORT++[++0-3++]++",
      "A ++|++ B ++<++ 2 ++>++ 1",
      "all-natural++*++ text",
      "dev++{conf}++",
      "link:++https://example.org/now_this__link_works.html++[]",
      "The text +++<del>strike this</del>+++ is marked as deleted.",
      "",
      "++[++source++]++",
      "",
      "|===",
      "| Cell",
      "a|",
      "A ++|++ B",
      "| signal++_++name",
      "|===",
      "",
      "----",
      "A ++|++ B",
      "----",
      "",
    ].join("\n"));

    const before = await lintFiles([doc], { cwd: directory });
    const findings = before.findings.filter((finding) => finding.ruleId === "AD039");

    expect(findings).toHaveLength(7);
    expect(findings.every((finding) => finding.fix?.applicability === "safe")).toBe(true);

    const after = await lintFiles([doc], { cwd: directory, fix: true });

    expect(after.findings.some((finding) => finding.ruleId === "AD039")).toBe(false);
    const fixed = fs.readFileSync(doc, "utf8");
    expect(fixed).toContain("DEVICE_STATUS and PORT[0-3]");
    expect(fixed).toContain("A | B < 2 > 1");
    expect(fixed).toContain("++[++source++]++");
    expect(fixed).toContain("A ++|++ B");
    expect(fixed).toContain("| signal_name");
  });

  it("reports raw markup residue in link labels without overlapping punctuation passthrough cleanup", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-link-label-residue-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[#target]",
      "== Target",
      "",
      "link:https://example.com[++<span>Example</span>++]",
      "xref:target[<em>Target</em>]",
      "link:https://example.com[DEVICE++_++STATUS]",
      "link:https://example.com[all-natural++*++]",
      "// link:https://example.com[++<span>Comment</span>++]",
      "",
      "[comment]",
      "link:https://example.com[++<span>Hidden</span>++]",
      "",
      "----",
      "link:https://example.com[++<span>Code</span>++]",
      "----",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.filter((finding) => finding.ruleId === "AD040")).toHaveLength(2);
    expect(result.findings.filter((finding) => finding.ruleId === "AD039")).toHaveLength(1);
  });

  it("allows delimited blocks attached to list items with continuation markers", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-list-continuation-block-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ". First step",
      "+",
      "____",
      "Attached quote.",
      "____",
      ". Second step",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const ids = result.findings.map((finding) => finding.ruleId);

    expect(ids).not.toContain("AD032");
    expect(ids).not.toContain("AD035");
  });

  it("does not treat table delimiters after table cell lines as new untitled tables", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-nested-table-cell-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[cols=\"1\"]",
      "|===",
      "a|",
      "[cols=\"1\"]",
      "|===",
      "| Nested cell",
      "|===",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const lineNineFindings = result.findings.filter((finding) => finding.range.start.line === 9);

    expect(lineNineFindings.map((finding) => finding.ruleId)).not.toContain("AD010");
    expect(lineNineFindings.map((finding) => finding.ruleId)).not.toContain("AD032");
  });

  it("does not report table-title on closing delimiters after table cell content", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-close-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[#operation_errors]",
      ".Operation Error Types",
      "[cols=\",,,\",options=\"header\"]",
      "|===",
      "| Error Type | Operation | Check Condition | Check By",
      "| ILLEGAL_OPERAND | Operation |",
      "* First condition",
      "* Second condition",
      "| Core",
      "",
      "| EXCEED_LIMIT | Operation | See related bound +",
      "| Core",
      "",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const closingLineFindings = result.findings.filter((finding) => finding.range.start.line === 16);

    expect(closingLineFindings.map((finding) => finding.ruleId)).not.toContain("AD010");
    expect(closingLineFindings.map((finding) => finding.ruleId)).not.toContain("AD032");
  });

  it("accepts block titles separated from table attributes by a blank line", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-table-title-attribute-gap-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      ".Features_List",
      "",
      "[cols=\"43%,9%,17%,13%,18%\",options=\"header\",]",
      "|===",
      "| Feature | ID | Status | Definition | Section",
      "| Example | | | |",
      "|===",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.map((finding) => finding.ruleId)).not.toContain("AD010");
  });

  it("reports circular include and empty section issues", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-gaps-"));
    const doc = path.join(directory, "doc.adoc");
    const child = path.join(directory, "child.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "include::child.adoc[]",
      "",
      "== Empty",
      "",
      "== Next",
      "",
      "text",
      "",
    ].join("\n"));
    fs.writeFileSync(child, "include::doc.adoc[]\n");

    const result = await lintFiles([doc], { cwd: directory });
    const ids = new Set(result.findings.map((finding) => finding.ruleId));

    expect(ids).toContain("AD022");
    expect(ids).toContain("AD023");
  });

  it("reports empty sections and allows container sections with children", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-empty-section-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "== Empty",
      "",
      "== Container",
      "",
      "=== Child",
      "",
      "Content.",
      "",
      "== Body",
      "",
      "Content.",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD023");

    expect(findings).toHaveLength(1);
    expect(findings[0]?.alias).toBe("empty-section");
    expect(findings[0]?.severity).toBe("info");
    expect(findings[0]?.range.start.line).toBe(3);
  });

  it("reports circular includes through attribute-resolved include targets", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-cycle-attrs-"));
    const doc = path.join(directory, "doc.adoc");
    const child = path.join(directory, "child.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      ":child-file: child.adoc",
      "",
      "include::{child-file}[]",
      "",
    ].join("\n"));
    fs.writeFileSync(child, "include::doc.adoc[]\n");

    const result = await lintFiles([doc], { cwd: directory });
    const finding = result.findings.find((item) => item.ruleId === "AD022");

    expect(finding?.alias).toBe("circular-include");
    expect(finding?.severity).toBe("error");
    expect(finding?.range.start.file).toBe(child);
    expect(finding?.range.start.line).toBe(1);
    expect(finding?.detail).toContain("doc.adoc");
    expect(finding?.detail).toContain("child.adoc");
  });

  it("does not enforce a house-style maximum include depth", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-depth-"));
    for (let index = 0; index <= 6; index += 1) {
      const file = path.join(directory, index === 0 ? "doc.adoc" : `part${index}.adoc`);
      const next = index < 6 ? `include::part${index + 1}.adoc[]\n` : "== Leaf\n\ntext\n";
      fs.writeFileSync(file, index === 0 ? `= Title\n\n${next}` : next);
    }

    const result = await lintFiles([path.join(directory, "doc.adoc")], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD022")).toBe(false);
  });

  it("does not follow include-like text inside non-AsciiDoc include targets", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-include-non-adoc-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, "= Title\n\ninclude::data.csv[]\n");
    fs.writeFileSync(path.join(directory, "data.csv"), "name,value\nfake,include::doc.adoc[]\n");

    const result = await lintFiles([doc], { cwd: directory });

    expect(result.findings.some((finding) => finding.ruleId === "AD022")).toBe(false);
  });

  it("requires explicit text only for interdocument xrefs", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-interdocument-xref-text-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      "[#overview]",
      "== Overview",
      "",
      "See xref:overview[] and <<overview,>>.",
      "See link:chapter.adoc[] and https://example.org[].",
      "See xref:chapter.adoc[Chapter] and xref:chapter.adoc#overview[Overview,window=_blank].",
      "See xref:chapter.adoc[] and xref:chapter.adoc#overview[window=_blank].",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD042");

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.range.start.line)).toEqual([9, 9]);
    expect(findings.every((finding) => finding.alias === "interdocument-xref-text")).toBe(true);
  });

  it("reports indented section-title-looking lines outside protected blocks", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "asciidoclint-indented-section-title-"));
    const doc = path.join(directory, "doc.adoc");
    fs.writeFileSync(doc, [
      "= Title",
      "",
      " == Intended Section",
      "",
      " ## Intended Markdown-Compatible Section",
      "",
      "----",
      " == Literal Example",
      " ## Literal Markdown-Compatible Example",
      "----",
      "",
      "== Actual Section",
      "",
      "Text.",
      "",
    ].join("\n"));

    const result = await lintFiles([doc], { cwd: directory });
    const findings = result.findings.filter((finding) => finding.ruleId === "AD043");

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.range.start.line)).toEqual([3, 5]);
    expect(findings.every((finding) => finding.severity === "warning")).toBe(true);
  });
});
