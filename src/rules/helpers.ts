import type { BlockNode, BlockType, NormalizedDocument, RuleHelpers, SectionNode } from "../types.js";

export const helpers: RuleHelpers = {
  findSections(document: NormalizedDocument): SectionNode[] {
    return document.sections;
  },
  findBlocks(document: NormalizedDocument, type?: BlockType): BlockNode[] {
    return type ? document.blocks.filter((block) => block.type === type) : document.blocks;
  },
  isSourceLikeBlock(block: BlockNode): boolean {
    return ["source", "listing", "literal", "passthrough", "stem"].includes(block.type);
  },
};

