export type Severity = "error" | "warning" | "info";
export type ParserKind = "text" | "document" | "dependency" | "project";
export type Fixability = "safe" | "unsafe" | "no";
export type FixApplicability = Exclude<Fixability, "no">;

export interface SourcePosition {
  file: string;
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end?: SourcePosition;
}

export interface TextEdit {
  file: string;
  range: SourceRange;
  replacement: string;
}

export interface Fix {
  applicability: FixApplicability;
  edits: TextEdit[];
}

export interface WaiverRecord {
  file: string;
  line: number;
  column: number;
  directive: "disable-next-line" | "disable-block";
  rules: string[];
  reason?: string;
}

export interface LintFinding {
  ruleId: string;
  alias?: string;
  severity: Severity;
  message: string;
  range: SourceRange;
  detail?: string;
  context?: string;
  fixHelper?: string;
  fix?: Fix;
  waived?: true;
  waiver?: WaiverRecord;
}

export interface RuleExample {
  title?: string;
  code: string;
}

export interface RuleDocs {
  summary: string;
  url?: URL;
  rationale?: string;
  badExamples?: RuleExample[];
  goodExamples?: RuleExample[];
  fixability?: Fixability;
  /** Default repair guidance for all findings from this rule. */
  fixHelper?: string;
}

export interface Rule {
  id: string;
  alias?: string;
  description: string;
  tags: string[];
  docs?: RuleDocs;
  parser: ParserKind;
  configSchema?: unknown;
  asynchronous?: boolean;
  function: (params: RuleParams, onError: ReportFinding) => void | Promise<void>;
}

export type ReportFinding = (finding: Omit<LintFinding, "ruleId" | "alias"> & Partial<Pick<LintFinding, "ruleId" | "alias">>) => void;

export interface RuleParams {
  file: string;
  lines: string[];
  document: NormalizedDocument;
  dependencies: DependencyGraph;
  parserDiagnostics: LintFinding[];
  config: unknown;
  version: string;
  helpers: RuleHelpers;
}

export interface NormalizedDocument {
  file: string;
  lines: string[];
  attributes: Record<string, string>;
  sections: SectionNode[];
  blocks: BlockNode[];
  referenceTargets: ReferenceTarget[];
  includes: IncludeRecord[];
  dependencies: DependencyGraph;
  diagnostics: LintFinding[];
  sourceMap: SourceMapRecord[];
  conditionals: ConditionalRecord[];
  files: ParsedFile[];
}

export interface ReferenceTarget {
  id: string;
  file: string;
  aliases?: string[];
  source?: "asciidoctor" | "tolerant";
}

export interface ParsedFile {
  file: string;
  lines: string[];
}

export interface SectionNode {
  kind: "section";
  title: string;
  level: number;
  style?: string;
  sectname?: string;
  source?: "asciidoctor" | "tolerant";
  range: SourceRange;
  titleRange: SourceRange;
  parent?: SectionNode;
  children: SectionNode[];
  blocks: BlockNode[];
}

export interface BlockNode {
  kind: "block";
  type: BlockType;
  style?: string;
  context?: string;
  source?: "asciidoctor" | "tolerant";
  title?: string;
  attributes: Record<string, string | boolean>;
  table?: TableInfo;
  range: SourceRange;
  contentRange?: SourceRange;
  parentSection?: SectionNode;
}

export interface TableInfo {
  columnCount?: number;
  renderedCellCount?: number;
  renderedCellSourceLines?: number[];
}

export type BlockType =
  | "paragraph"
  | "listing"
  | "literal"
  | "source"
  | "example"
  | "sidebar"
  | "quote"
  | "table"
  | "image"
  | "admonition"
  | "passthrough"
  | "stem"
  | "diagram"
  | "comment"
  | "unknown";

export interface IncludeRecord {
  target: string;
  resolvedTarget?: string;
  range: SourceRange;
  status: "resolved" | "missing" | "skipped";
  attributes: Record<string, string | boolean>;
}

export interface DependencyRecord {
  type: "include" | "image" | "xref" | "attachment";
  target: string;
  resolvedTarget?: string;
  range: SourceRange;
  status: "resolved" | "missing" | "skipped";
}

export interface DependencyGraph {
  records: DependencyRecord[];
}

export interface SourceMapRecord {
  expandedLine: number;
  source: SourcePosition;
}

export interface ConditionalRecord {
  directive: "ifdef" | "ifndef";
  attribute: string;
  active: boolean;
  range: SourceRange;
}

export interface RuleHelpers {
  findSections: (document: NormalizedDocument) => SectionNode[];
  findBlocks: (document: NormalizedDocument, type?: BlockType) => BlockNode[];
  isSourceLikeBlock: (block: BlockNode) => boolean;
}

export interface LintOptions {
  configFile?: string;
  format?: "pretty" | "json";
  customRules?: string[];
  cwd?: string;
  homeDir?: string;
  noGlobalConfig?: boolean;
  fix?: boolean;
  unsafeFixes?: boolean;
  parserDiagnostics?: boolean;
  outputDiagnosticsFile?: string;
}

export interface LintResult {
  files: string[];
  findings: LintFinding[];
}
