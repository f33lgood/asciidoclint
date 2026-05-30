import { describe, expect, it } from "vitest";
import { helpers } from "./helpers.js";
import { blockDelimiterType, isBlockDelimiter, isListMarkerResidueLine, isUnderlineResidueLine } from "./utils.js";
import type { BlockNode, NormalizedDocument } from "../types.js";

const sourceBlock: BlockNode = {
  kind: "block",
  type: "source",
  attributes: {},
  range: { start: { file: "doc.adoc", line: 1, column: 1 } },
};

const imageBlock: BlockNode = {
  kind: "block",
  type: "image",
  attributes: {},
  range: { start: { file: "doc.adoc", line: 3, column: 1 } },
};

const document = {
  sections: [{ title: "Overview" }],
  blocks: [sourceBlock, imageBlock],
} as NormalizedDocument;

describe("rule helpers", () => {
  it("returns sections and filters blocks by type", () => {
    expect(helpers.findSections(document)).toEqual(document.sections);
    expect(helpers.findBlocks(document)).toEqual(document.blocks);
    expect(helpers.findBlocks(document, "image")).toEqual([imageBlock]);
  });

  it("detects source-like blocks", () => {
    expect(helpers.isSourceLikeBlock(sourceBlock)).toBe(true);
    expect(helpers.isSourceLikeBlock(imageBlock)).toBe(false);
  });

  it("recognizes documented structural delimiter variants", () => {
    expect(blockDelimiterType("======")).toBe("example");
    expect(blockDelimiterType("------")).toBe("listing");
    expect(blockDelimiterType("......")).toBe("literal");
    expect(blockDelimiterType("++++++")).toBe("passthrough");
    expect(blockDelimiterType("______")).toBe("quote");
    expect(blockDelimiterType("******")).toBe("sidebar");
    expect(blockDelimiterType("//////")).toBe("comment");
    expect(blockDelimiterType("--")).toBe("unknown");
    expect(blockDelimiterType(",===")).toBe("table");
    expect(blockDelimiterType(":====")).toBe("table");
    expect(blockDelimiterType("!===")).toBe("table");
    expect(isBlockDelimiter("---")).toBe(false);
  });

  it("recognizes marker-only list residue without confusing block delimiters", () => {
    expect(isListMarkerResidueLine("*")).toBe(true);
    expect(isListMarkerResidueLine("**")).toBe(true);
    expect(isListMarkerResidueLine("-")).toBe(true);
    expect(isListMarkerResidueLine(".")).toBe(true);
    expect(isListMarkerResidueLine("..")).toBe(true);
    expect(isListMarkerResidueLine("10.")).toBe(true);
    expect(isListMarkerResidueLine("* item")).toBe(false);
    expect(isListMarkerResidueLine(". {empty}")).toBe(false);
    expect(isListMarkerResidueLine("....")).toBe(false);
    expect(isListMarkerResidueLine("----")).toBe(false);
  });

  it("recognizes only three-underscore underline residue", () => {
    expect(isUnderlineResidueLine("___")).toBe(true);
    expect(isUnderlineResidueLine(" ___ ")).toBe(true);
    expect(isUnderlineResidueLine("__")).toBe(false);
    expect(isUnderlineResidueLine("____")).toBe(false);
    expect(isUnderlineResidueLine("______")).toBe(false);
  });
});
