# asciidoclint Architecture

Date: 2026-05-27

Status: draft for review

## Goal

`asciidoclint` should be a next-generation AsciiDoc linter that combines:

- Asciidoctor-compatible syntax and render diagnostics.
- Structure analysis, include/source mapping, dependency checks, and safe/unsafe
  auto-fix handling.
- Library-first packaging, custom rules, typed APIs, AI-agent skill workflows,
  and editor/CI adoption model.
- Declarative schema-backed document conformance where that is useful, without
  making schema validation the whole linter.

The linter should report as much useful information as possible in one run. A
missing include, missing image, or parser diagnostic should be a finding, not an
early process failure that hides later findings.

## Non-Goals

- Replace Asciidoctor as the semantic baseline.
- Build a prose/style checker like Vale.
- Clone another markup linter's language-specific parser or rule set.
- Depend on one organization-specific rule pack for the generic linter core.
- Treat external tools as implementation bases.

## Design Principles

1. Library first, CLI second.
2. Parser adapters behind a stable internal model.
3. Every finding has normalized source location, severity, stable rule ID,
   optional readable alias, and optional fix metadata.
4. Dependency validation and parser diagnostics are first-class findings.
5. Rule packs are separable: core AsciiDoc, document-policy, organization
   policy, and conversion-cleanup rules.
6. Fixes are explicit about safety: safe, unsafe, or suggestion-only.

## Rule Severity and Scope

Until the first AsciiDoc Language Specification is ratified, asciidoclint treats
the Asciidoctor documentation and Asciidoctor implementation as the language
baseline. Built-in syntax and structure rules should be judged against that
baseline first, then against asciidoclint's own recommendations.

Built-in rules can use `error` when at least one of these is true:

- Asciidoctor reports an error for the construct.
- Asciidoctor parses or renders the source differently from the likely author
  intent.
- A local dependency needed by the rendered document is missing, such as an
  include, image, xref target, or attachment.
- The document outline or include graph is not trustworthy, such as circular
  includes or invalid section progression that changes the logical structure.

Built-in rules can use `warning` when at least one of these is true:

- The source violates an Asciidoctor-documented recommendation or recommended
  practice.
- Asciidoctor accepts the source, but the output is likely incomplete,
  inaccessible, confusing, or fragile for common technical-document workflows.
- The rule catches common conversion residue that would render visibly or lose
  the intended link, image, table, block, or inline formatting.

Built-in rules should use `info` sparingly. `info` is appropriate only for
asciidoclint-maintained guidance that is broadly useful but not directly
required or recommended by Asciidoctor and not likely to change rendered
meaning. Generic editor hygiene and organization house style should usually not
be built in at all.

Custom rules may use any severity, but they should document the authority behind
that severity:

- `error` for organization release gates, required publication contracts, or
  project-specific rendering/dependency failures.
- `warning` for organization quality requirements that should be fixed before
  publishing but do not make the document unusable.
- `info` for style, editorial consistency, migration hints, and exploratory
  checks.

Rule ID ranges do not encode severity or necessity. All built-in rules use the
`AD###` namespace; custom packs should use their own three-letter namespace such
as `ORG###`. Severity belongs in rule metadata, documentation, and configuration,
not in the numeric ID range.

## High-Level Architecture

```text
          CLI / API / AI Skill / VS Code / CI
                         |
                 Config Loader
                         |
                 Lint Orchestrator
        +----------------+----------------+
        |                |                |
 Parser Adapters   Dependency Graph   Rule Registry
        |                |                |
 Diagnostic      Include/image/link    Rule Packs
 Normalizer      resolution            + plugins
        |                |                |
        +----------------+----------------+
                         |
              Normalized Document Model
                         |
                Finding + Fix Engine
                         |
    Terminal / JSON / Skill Summary / Editor Diagnostics
```

## Runtime Choice

The recommended implementation language is TypeScript on Node.js.

This supports npm distribution, custom-rule packages, generated types, AI-agent
skills, editor integrations, GitHub Actions, pre-commit hooks, browser demos,
and language-server reuse. `asciidoclint` should start simple: one repository
can publish the Node.js package, an installable skill, and a VS Code/Cursor
extension, while keeping the lint engine shared. The parser baseline should remain
Asciidoctor-compatible and hidden behind adapters.

Start as a single TypeScript package for the engine and CLI. Add the VS
Code/Cursor extension as a workspace package when editor diagnostics become a
release target. Split other packages only when the CLI, rule packs, or extension
become painful to maintain in one package.

Initial package shape:

```text
src/
  api/                    # lint() API and public types
  cli/                    # CLI wrapper
  formatters/             # terminal and JSON output
  parsers/                # parser adapters
  rules/                  # built-in generic rules

skills/
  asciidoclint/            # installable AI-agent skill

packages/
  vscode-asciidoclint/     # VS Code/Cursor extension wrapper
```

Future workspace shape, if needed:

```text
packages/
  asciidoclint/           # shared engine, public API, CLI, built-in rules
  asciidoclint-skill/     # optional skill-only package, if split later
  vscode-asciidoclint/    # VS Code/Cursor extension wrapper
  asciidoclint-rules/     # optional published rule packs, if needed
```

## Repository Organization

Use a rule layout adapted for AsciiDoc's project-oriented fixtures:

```text
docs/
  rules/
    AD001.md
    AD002.md
    ...

skills/
  asciidoclint/
    SKILL.md
    references/
      result-schema.md
      ai-fix-policy.md

src/
  api/
    lint.ts
    lint.test.ts
  cli/
  formatters/
  parsers/
  rules/
    builtin.ts             # ordered built-in registry only
    AD001.ts
    AD002.ts
    ...
    AD043.ts
    helpers.ts
    registry.ts
    rule-examples.test.ts  # generated one-test-per-rule examples

test/
  fixtures/
    custom-rules/
      docs/
        ORG101-required-overview-section.md
        ORG102-portable-table-formatting.md
      src/
        ORG101-required-overview-section.ts
        ORG102-portable-table-formatting.ts
    rules/
      AD029-markdown-link-image-residue/
        bad.adoc
        included-with-title.adoc
```

The `test/fixtures/custom-rules/ORG###` rules are experimental fixtures. They
demonstrate how custom policies can be loaded and documented, but they are not
official `asciidoclint` extensions and should not be treated as a recommended
policy pack.

Use one rule per file by default, with built-in implementations directly under
`src/rules/AD###.ts`. Do not split built-ins into category directories; the
single `AD###` namespace plus tags already carries the category information, and
the flat layout mirrors `docs/rules/AD###.md`. Group multiple rules in one file
only when they share the same implementation and differ only by metadata or a
small parameter. `src/rules/builtin.ts` should stay registry glue; rule behavior
belongs in the per-rule module.

Keep fast implementation tests next to the code, such as `src/api/lint.test.ts`
and `src/rules/registry.test.ts`. Every built-in rule should have at least one
dedicated bad-example test and one dedicated good-example test. The current
prototype does this through `src/rules/rule-examples.test.ts`, which iterates the
built-in registry and runs each rule's documented examples with only that rule
enabled. More complex rules can still add a focused `src/rules/AD###.test.ts`.

Keep reusable lint examples under `test/fixtures/`, because AsciiDoc examples
often need include trees, images, attachments, and source-map expectations.

Rule-specific fixture directories should use:

```text
test/fixtures/rules/<RULE-ID>-<alias>/
  bad.adoc
  good.adoc          # when the rule has a compact positive example
  config.yaml        # optional, only when the rule has config
  fixed.adoc         # optional, only when the rule has a safe fix
```

Rules that need multiple files can use nested `bad/` and `good/` directories.
The current prototype has only the dedicated `AD029-markdown-link-image-residue` fixture;
most rule examples are still inline in rule metadata and docs pages.

## Parser Adapters

Parser adapters provide native diagnostics and normalized structural data.

### Specification and Implementation Baseline

AsciiDoc has an active language specification effort. The public AsciiDoc site
states that the AsciiDoc Language specification is managed by the Eclipse
AsciiDoc Language project and the AsciiDoc Working Group, and that specification
development is underway. Treat the specification project as the language
authority:

- Public language site: <https://asciidoc.org>
- Specification project: <https://gitlab.eclipse.org/eclipse/asciidoc-lang/asciidoc-lang>
- Published language docs: <https://docs.asciidoctor.org/asciidoc/latest/>

For executable behavior, `asciidoclint` uses Asciidoctor.js as the practical
golden implementation. Asciidoctor is the mature implementation most users
expect, and the published AsciiDoc language docs are maintained in the
Asciidoctor documentation set. At this point, the project should not assume
there is a second comparably mature, specification-complete implementation that
can serve as an equal parser oracle. If such an implementation becomes available,
it should be added as an optional adapter, not used to fork rule semantics.

The precedence is:

1. The active AsciiDoc language specification when it is precise and applicable.
2. Asciidoctor.js behavior as the executable baseline for parser and rendering
   semantics.
3. `asciidoclint` tolerant parsing only for recovery, dependency analysis,
   source maps, fix planning, and cases where the renderer does not expose the
   needed structural span.

If Asciidoctor.js can produce the syntax or structure fact directly, the
tolerant parser must not duplicate that parsing logic as an equal authority.
Specific `AD###` rules may wrap native `AD000/asciidoctor-diagnostic` findings
to provide stable rule IDs, richer documentation, severity policy, and fix
metadata, but the underlying syntax judgment should still come from
Asciidoctor.js.

`asciidoclint` is intentionally built as Asciidoctor.js plus its own rule
engine. Asciidoctor remains the semantic baseline for what AsciiDoc means, while
`asciidoclint` adds stable rule IDs, documentation, configuration, dependency
checks, source mapping, custom rules, and fix metadata. This is the right split:
do not reimplement the renderer's parser when the renderer can already identify
syntax/rendering diagnostics, but do not stop at renderer diagnostics because a
renderer is not a complete project linter.

Concise parser summary:

- `src/parsers/asciidoctor.ts` wraps Asciidoctor.js. It is the semantic parser
  and practical golden implementation for AsciiDoc behavior. Use it for parser
  diagnostics, rendering-sensitive decisions, and authoritative structural spans
  such as tables and other grammar-heavy blocks.
- `src/parsers/tolerant.ts` is a recovery source scanner, not a second AsciiDoc
  implementation. It keeps linting useful for incomplete or broken documents by
  collecting includes, attributes, conditionals, comments, source maps,
  dependency records, fallback block spans, and fix-planning context.
- When the two disagree on AsciiDoc semantics, Asciidoctor.js wins. The tolerant
  scanner only fills gaps where Asciidoctor.js does not expose enough source
  information or cannot produce a usable span.
- Do not add tolerant-parser diagnostics for syntax errors that Asciidoctor.js
  already reports. Instead, map the native `AD000` diagnostic to a stable
  specific rule when a documented rule ID is useful.

### Parser Ownership for Rules

Every rule must declare, in implementation notes or tests, who owns the grammar
decision for the construct it checks.

Prefer Asciidoctor-owned parsing. If Asciidoctor.js exposes the needed fact
through native diagnostics, the AST, converted output, source locations, or
normalized spans, the rule should rely on that result and treat Asciidoctor.js as
the complete AsciiDoc grammar implementation for that construct. Examples
include native parser diagnostics, section level semantics, and table spans once
the normalized model has Asciidoctor-backed table data.

Use source scanning only when Asciidoctor.js cannot expose the failed author
intent after parsing or when the linter needs pre-parse source context. AD008 is
the model case: without a required blank line, a would-be list marker is parsed
as paragraph text, so the Asciidoctor AST no longer contains a list block to
inspect.

Any source scanner that recognizes AsciiDoc syntax must prove variant coverage:

- Cite the Asciidoctor or language documentation used as the grammar source.
- Enumerate the supported syntax variants in the rule documentation.
- Add tests for each supported variant and for documented exclusions.
- Keep helper functions narrow and shared when multiple rules need the same
  syntax recognition.

If a scanner cannot cover all documented variants for the broad grammar term,
narrow the rule name and message to the subset it actually supports or move the
rule to a custom/example policy pack. For example, a rule may check "description
list markers" only if it covers the documented description list delimiters it
claims to support; otherwise it must not claim generic list coverage.

Rule authors must not treat "looks like Markdown" as a built-in error by
itself. Asciidoctor supports optional Markdown-compatible syntax, including
Markdown-style headings and fenced code blocks. Built-in rules should flag
narrow rendered-output problems, such as Markdown link/image residue that
Asciidoctor leaves as paragraph text. Preferences such as "always use `=`
section titles" or "always use `----` source blocks" belong in custom policy
rules because they are house style, not AsciiDoc correctness.

Diagram language syntax is not core AsciiDoc grammar. Asciidoctor and
Asciidoctor.js can identify diagram blocks and expose their style/title/source
location, while Asciidoctor Diagram or external engines such as PlantUML,
Mermaid, WaveDrom, or Kroki own diagram-language validation. Built-in rules may
check generic diagram block structure, such as `AD012/diagram-title`, but
engine-specific syntax smoke checks belong in custom rules or CI renderer
integration. The repository keeps `ORG132/diagram-syntax-smoke` only as an
experimental custom-rule fixture to demonstrate that pattern.

Initial adapters:

| Adapter | Use |
|---|---|
| `asciidoctor-js` | Primary semantic parser because it fits Node/editor/browser use and avoids requiring Ruby in the first implementation. It provides native diagnostics and authoritative structural spans where available, starting with table blocks. |
| `tolerant-structure` | Lightweight recovery parser for broken documents, dependency scanning, comments, conditionals, source maps, and fix planning. It remains the fallback when Asciidoctor cannot produce a structural span. |


Later optional adapter:

| Adapter | Use |
|---|---|
| `asciidoctor-j` | JVM integration and parity checks for schema-heavy use cases. |

Adapters produce:

- Parser diagnostics.
- Document attributes and resolved options.
- Sections and block spans.
- Include expansion records.
- Conditional-resolution records.
- Source maps from expanded lines back to original files.

Native parser warnings must be captured and normalized into findings. They must
not live only in stderr. Asciidoctor adapter findings use
`AD000/asciidoctor-diagnostic`; the severity mirrors the native Asciidoctor
diagnostic. `AD000` is not a normal configurable rule. It is the stable wrapper
for native parser/render diagnostics.

In both the CLI and editor extension, `AD000` should be produced by the same
`asciidoclint` engine call as all other findings. The extension packages
Asciidoctor.js as a normal runtime dependency instead of bundling the Opal
runtime into the extension JavaScript, so parser diagnostics follow the same
path as built-in and custom rule diagnostics.

Asciidoctor.js is a moving dependency, so its exact diagnostic catalog should
not be copied into this repository as a fixed rule list. The architecture should
assume the native diagnostic set can change across Asciidoctor.js versions. That
means some overlap between `AD000` diagnostics and specific `AD###` rules is
expected and acceptable.

Overlap is handled by intent:

- `AD000` preserves the renderer's native finding exactly enough for users to
  know what Asciidoctor reported.
- Specific `AD###` rules provide stable asciidoclint semantics, docs, aliases,
  examples, severities, configuration, and fixes where useful.
- A specific `AD###` rule may intentionally cover the same source construct as
  an Asciidoctor diagnostic when asciidoclint needs a stable contract or richer
  remediation.
- Tests should prove that every Asciidoctor baseline issue in fixtures is
  surfaced by asciidoclint as either `AD000` or a specific `AD###` finding.

Ruby Asciidoctor should not be required for the first CI path. Use
Asciidoctor.js for normal lint tests, and run Ruby Asciidoctor only in an
optional parity job.

## Normalized Model

The normalized model is the linter's main internal data structure. It should
hide parser/runtime differences and give rules a stable view of an AsciiDoc
project.

Rule authors do not always need to understand it:

- Simple text rules can use `params.lines` and helper functions only.
- Dependency rules can use `params.dependencies`.
- Most custom structural rules should use high-level helpers such as
  `findSections()`, `findBlocks()`, and `isInSourceLikeBlock()`.
- Advanced rules can inspect the full normalized model when helpers are not
  enough.

The model should be stable enough for custom rules, but small enough that users
are not forced to learn an entire Asciidoctor AST.

For grammar-heavy constructs, normalized blocks should prefer Asciidoctor.js
spans over delimiter guessing. Tables are the first required case: table start
lines, titles, IDs, and ranges come from Asciidoctor.js when available, then
replace the tolerant parser's table blocks for those files. The tolerant parser
still supplies fallback blocks for invalid documents and supplies document-wide
data that Asciidoctor does not expose in the small normalized shape.

```ts
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

export interface ParsedFile {
  file: string;
  lines: string[];
}

export interface SectionNode {
  kind: "section";
  title: string;
  level: number;
  range: SourceRange;
  titleRange: SourceRange;
  parent?: SectionNode;
  children: SectionNode[];
  blocks: BlockNode[];
}

export interface BlockNode {
  kind: "block";
  type:
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
  style?: string;
  title?: string;
  attributes: Record<string, string | boolean>;
  range: SourceRange;
  contentRange?: SourceRange;
  parentSection?: SectionNode;
}

export interface ReferenceTarget {
  id: string;
  file: string;
  aliases?: string[];
  source?: "asciidoctor" | "tolerant";
}

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

export interface ConditionalRecord {
  directive: "ifdef" | "ifndef";
  attribute: string;
  active: boolean;
  range: SourceRange;
}

export interface SourcePosition {
  file: string;
  line: number;
  column: number;
}

export interface SourceRange {
  start: SourcePosition;
  end?: SourcePosition;
}

export interface LintFinding {
  ruleId: string;
  alias?: string;
  severity: "error" | "warning" | "info";
  message: string;
  range: SourceRange;
  detail?: string;
  context?: string;
  fixHelper?: string;
  fix?: Fix;
}

export interface Fix {
  applicability: "safe" | "unsafe";
  edits: TextEdit[];
}
```

`referenceTargets` is the normalized set of anchors and IDs available for
xrefs. Asciidoctor-derived catalog refs are authoritative where available. The
tolerant parser contributes fallback targets for source forms that are needed
before or outside Asciidoctor catalog extraction. `AD026/missing-xref` uses
source scanning to collect `xref:target[]` and `<<target>>` occurrences with
precise locations, then resolves them against this target set plus the project
file graph. This avoids relying only on Asciidoctor's INFO-level xref
validation, which is useful evidence but intentionally limited and does not
provide precise source locations for every occurrence.

The model should keep these datasets separate:

- Parser diagnostics.
- Dependency findings.
- Rule findings.
- Source-map records.
- Expanded document content.
- Original per-file source content.

That separation prevents dependency preflight from masking later lint findings.

## Rule API

Rules should be plain TypeScript objects with AsciiDoc-specific parser data and
config schemas.

```ts
export interface Rule {
  id: string;
  alias?: string;
  description: string;
  tags: string[];
  docs?: RuleDocs;
  parser: "document" | "text" | "dependency" | "project";
  configSchema?: JSONSchema;
  asynchronous?: boolean;
  function: (params: RuleParams, onError: ReportFinding) => void | Promise<void>;
}

export interface RuleDocs {
  summary: string;
  url?: URL;
  rationale?: string;
  badExamples?: RuleExample[];
  goodExamples?: RuleExample[];
  fixability?: "safe" | "unsafe" | "no";
  fixHelper?: string;
}

export interface RuleExample {
  title?: string;
  code: string;
}
```

Minimal custom rule example:

```ts
import type { Rule } from "asciidoclint";

export default {
  id: "ORG001",
  alias: "no-todo",
  description: "TODO markers must not be committed",
  tags: ["organization", "content"],
  docs: {
    summary: "Use tracked issues instead of TODO markers in committed docs.",
    badExamples: [{ code: "This section needs TODO cleanup." }],
    goodExamples: [{ code: "This section links to issue PROJ-123." }],
  },
  parser: "text",
  function: (params, onError) => {
    params.lines.forEach((line, index) => {
      const column = line.indexOf("TODO");
      if (column !== -1) {
        onError({
          ruleId: "ORG001",
          message: "Remove TODO marker or convert it to a tracked issue",
          range: {
            start: {
              file: params.file,
              line: index + 1,
              column: column + 1,
            },
          },
        });
      }
    });
  },
} satisfies Rule;
```

Rule implementation checklist:

- Use one file per rule: `AD###.ts` for built-ins or `ORG###-alias.ts` for
  custom packs. Grouped files are harder to review, test, document, and map to
  rule IDs.
- Export one plain `Rule` object or a default rule object from each file.
- Keep `id`, `alias`, `description`, `tags`, `parser`, and `docs.summary`
  present. Built-ins and publishable custom rules must also include
  `docs.rationale`, at least one bad example, and at least one good example.
- Pick the narrowest parser surface: `text` for line/pattern rules,
  `document` for section/block rules, `dependency` for include/image/xref
  target rules, and `project` only when one-file context is insufficient.
- Report precise source ranges. At minimum provide file, line, and column for
  the start of the problem.
- Choose severity from the `Rule Severity and Scope` policy. Built-ins must tie
  `error` and `warning` to Asciidoctor behavior, Asciidoctor documentation, or a
  broadly applicable document-quality failure. Custom rules must document the
  organization or project authority behind their severity.
- If a rule can fix content, declare fix safety and add tests for safe/unsafe
  behavior.

Rule authors should not need to understand the whole parser. Simple rules can
use `parser: "text"` and inspect lines. Structure-aware rules can use
`parser: "document"` and inspect normalized sections, blocks, tables, images,
includes, and source ranges.

Rule params:

```ts
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
```

`id` is the primary stable identifier for output, baselines, suppressions, and
cross-version compatibility. `alias` is the readable name for humans. A rule
should have at most one alias to avoid ambiguity. Users may reference either the
id or alias in configuration, suppressions, `--explain`, and CLI filters.

Example: `id: "ORG001"` and `alias: "no-todo"` lets users configure either
`ORG001: true` or `no-todo: true`, while reports can show both as
`ORG001/no-todo`.

Rules may be loaded from:

- Built-in rule packs.
- Local JavaScript/TypeScript modules.
- npm packages or package subpaths.
- Local paths for repo-specific rules.

Example configuration for a local custom rule:

```yaml
customRules:
  - ./lint-rules/ORG001-no-todo.ts
  - ./lint-rules/ORG002-section-policy.ts
  - "@example/asciidoclint-rule-pack"

rules:
  ORG001: true
  # no-todo: true # Equivalent alias for ORG001; use one form, not both.
```

Use one extension style per project. TypeScript is the recommended authoring
format because types make AI-generated and human-authored rules easier to
validate. Published rule packs should ship JavaScript. Local `.ts` rules work in
the current source/test path where the runtime has TypeScript module support.

Custom rules must be loadable without modifying `asciidoclint` source. The
loader accepts local files, package names, and arrays exported by rule packs. A
rule pack can export:

```ts
export default [noTodoRule, sectionPolicyRule];
```

Rule IDs and aliases should be stable and namespaced when needed:

- `AD001` / `heading-level-progression` for a generic AsciiDoc structure rule.
- `AD024` / `missing-include` for dependency/include/reference validation.
- `ABC001` / `image-alt-text` or `ORG001` / `no-todo` for organization packs.

The registry must reject duplicate IDs and duplicate aliases across all loaded
built-in and custom rules. It should also reject aliases that collide with any
rule ID.

## Rule Documentation

Rule documentation should be part of the rule metadata, not only separate files.
This makes rule meaning easy to retrieve for humans, CLI output, editor
extensions, and AI tools.

Each rule should provide both inline metadata and, for built-ins or example
custom packs, a per-rule document. The per-rule document must use this shape:

````markdown
# AD001 - heading-level-progression

Tags: headings, structure
Severity: warning

Description: Section headings must not skip levels.

Necessity: Explain why this rule exists without relying only on another linter.
For built-ins, tie the rule to rendered AsciiDoc output, dependency integrity,
navigation structure, accessibility, or a baseline technical-document quality
contract. For custom rules, explain the organization or template policy.

Rationale: Explain why the rule belongs in its chosen pack. For example, say
why it is generic enough for built-ins or why it stays custom because it is
style, branding, template, or publication policy.

Bad:

What's wrong: Explain the exact defect in the bad example.

```asciidoc
= Title

=== Skipped Section
```

Good:

Expected: Explain the expected syntax or structure and why it satisfies the
rule.

```asciidoc
= Title

== Section
```

Implementation note: Name the parser surface used, the important normalized
model fields or text patterns, configuration behavior, and any known limits.
````

Required documentation fields:

- primary ID and at most one alias in the heading;
- tags and default severity;
- `Description`;
- `Necessity`;
- `Rationale`;
- `Bad` example plus `What's wrong`;
- `Good` example plus `Expected`;
- configuration schema and examples when configurable;
- fix safety and fix examples when fixable;
- `Implementation note`.

Built-in rules can still have full Markdown/AsciiDoc documentation pages, but
those pages should be generated from or validated against the rule metadata so
the code and docs do not drift. Custom rule packages should ship the same
metadata inline, plus optional external docs. The repository's example custom
pack keeps executable rules in `test/fixtures/custom-rules/src/` and matching
docs in `test/fixtures/custom-rules/docs/`; tests enforce that every custom
fixture has this documentation shape.

CLI/API examples:

```bash
asciidoclint --list-rules
asciidoclint --explain AD001
asciidoclint --explain heading-level-progression
asciidoclint --explain no-todo --format json
```

`--explain` should show the rule description, rationale, examples,
configuration schema, and fix behavior. JSON output should expose the same
metadata so editors and AI assistants can explain findings without scraping
documentation pages.

## AI Skill Distribution

`asciidoclint` should ship an installable AI-agent skill in the repository:

```text
skills/
  asciidoclint/
    SKILL.md
    references/
      result-schema.md
      ai-fix-policy.md
```

The skill is an orchestration layer over the deterministic npm package. It
should not replace the CLI or embed a separate lint engine. Its responsibilities
are:

- Interpret natural language requests such as "lint this AsciiDoc", "summarize
  findings", "apply safe fixes", "apply unsafe fixes", and "use AI to repair the
  remaining issues".
- Resolve the tool in this order: workspace `node_modules/.bin/asciidoclint`,
  `npx asciidoclint`, then `npx -y asciidoclint@latest`.
- Run `--format json` for machine-readable results.
- Run `--fix` for deterministic safe fixes.
- Run `--fix --unsafe` only when the user explicitly requests unsafe fixes.
- Use `fixHelper`, rule metadata, finding details, and local source context for
  AI-assisted repairs that do not have deterministic edits.
- Rerun lint after edits and summarize fixed and remaining findings.

The primary skill install path should follow the open skills ecosystem:

```bash
npx skills add f33lgood/asciidoclint --skill asciidoclint -a codex -g
```

Repo-maintenance skills under `.agents/skills` should be marked
`metadata.internal: true` so normal discovery exposes only the public
`asciidoclint` skill. With that organization, the shorter form also installs the
public skill:

```bash
npx skills add f33lgood/asciidoclint
```

The npm package should also expose a convenience installer:

```bash
npx asciidoclint install-skill
```

This command copies the bundled `skills/asciidoclint` directory into
`$CODEX_HOME/skills/asciidoclint` or `~/.codex/skills/asciidoclint`. It should
also support `--project` for `.codex/skills/asciidoclint`, `--dest` for explicit
test or custom install roots, and `--force` to replace an existing skill. This
keeps npm-package installs version-aligned with the skill that was published in
the same package.

LLM calls should remain outside the core npm package initially. The package
stays deterministic and offline-friendly; the skill uses the surrounding agent
to perform AI-assisted edits, inspect diffs, rerun lint, and report results.

## AI-Authored Rules

The rule API should be simple enough for AI tools to generate built-in rules or
project-local custom rules, but strict enough to catch conflicts and incomplete
metadata before linting starts.

The project should provide a scaffold command:

```bash
asciidoclint init-rule --pack my-org --id ORG001 --alias no-todo
```

The command should create:

```text
lint-rules/ORG001-no-todo.ts
lint-rules/ORG001-no-todo.test.ts
lint-rules/fixtures/ORG001-no-todo/bad.adoc
lint-rules/fixtures/ORG001-no-todo/good.adoc
```

Generated or hand-written rules must pass registry validation:

- `id` is required and unique across all loaded built-in and custom rules.
- `alias` is optional, but if present it must be unique and must not collide with
  any rule ID.
- A rule can have at most one alias.
- `description` and `docs.summary` are required.
- At least one bad example and one good example are required for publishable
  rule packs.
- `configSchema` is required when the rule accepts configuration.
- Fixable rules must declare fix safety and provide fix tests.

Validation commands:

```bash
asciidoclint --validate-rules
asciidoclint --list-rules --format json
```

This gives AI agents a deterministic loop: generate a rule, run rule validation,
run fixture tests, and revise until the rule registry has no conflicts and the
examples pass.

## Rule Packs

Built-in packs:

| Pack | Built-in ID namespace | Purpose |
|---|---|---|
| `core` | `AD###` | Common AsciiDoc syntax-adjacent structure checks: heading progression, duplicate document title, unterminated blocks, source-block protection. |
| `dependencies` | `AD###` | Includes, images, xrefs, attachments, and attribute-resolved paths. |
| `accessibility` | `AD###` | Baseline accessibility checks that have low false-positive risk, such as explicitly empty image alt text. |
| `policy` | `AD###` | Generic document-policy checks that are not pure syntax or dependency validation. |
| `cleanup` | `AD###` | Conversion artifact cleanup and low-risk whitespace normalization. |

Do not add a built-in prefix for every new idea. Built-ins all use the reserved
`AD###` namespace, and their responsibility is expressed by pack and tags.
Company, product, or template-specific rules should use a custom three-letter
prefix such as `ORG` or `ABC` and load through `customRules`.

Pack annotations are useful for:

- Grouping rules without creating more built-in ID namespaces.
- Applying default rule sets such as `asciidoclint:recommended` or
  `asciidoclint:dependencies`.
- Filtering output and documentation by category.
- Letting users enable or disable a whole class of rules.
- Helping AI tools choose the right rule category while preserving the single
  built-in `AD###` namespace.

Optional organization packs should live outside the generic core. Company-specific
rules should stay in an organization policy pack unless the behavior is a broad
AsciiDoc expectation, such as not linting source block content as prose or
reporting missing include targets.

Organization packs should declare their prefix reservation, for example:

```ts
export const rulePack = {
  name: "my-org",
  prefix: "ORG",
  rules: [noTodoRule, sectionPolicyRule],
};
```

## Configuration

Configuration should support rule toggles plus schema-backed conformance.

Example:

```yaml
extends:
  - asciidoclint:recommended

customRules:
  - ./lint-rules/ORG101-required-overview-section.js
  - ./lint-rules/ORG102-portable-table-formatting.js

rules:
  AD001: true # Alias: heading-level-progression.
  AD024:
    severity: error
  ORG101:
    severity: warning

ignores:
  - build/**
```

Configuration validation should use JSON Schema so invalid rule configuration is
reported before linting begins. The current prototype supports rule toggles,
severity overrides, presets, ignores, and custom rule paths; full per-rule
`configSchema` validation is still future work.

The conformance schema should start small and be easy to map from examples:

- Required and optional section hierarchy.
- Allowed block types per section.
- Required block occurrence counts.
- Basic title and attribute patterns.
- Block ordering where order is semantically important.

Conformance checks such as required sections should start as custom rules or a
separate conformance pack. They are not generic built-in syntax/structure rules.

Do not promise direct compatibility with external conformance schemas in v1. A
later importer can translate a useful subset if teams already have existing
configs.

## Fix Engine

Make fix safety part of the public API.

| Applicability | Meaning | Default behavior |
|---|---|---|
| `safe` | Text edit should not change rendered meaning. | Applied by `--fix`. |
| `unsafe` | Edit may alter document structure, paths, or rendered output. | Applied only by `--fix --unsafe`. |

Use `fixability` in rule documentation and metadata:

| Fixability | Meaning |
|---|---|
| `safe` | The rule can emit deterministic safe edits. |
| `unsafe` | The rule can emit edits, but they require explicit opt-in. |
| `no` | The rule cannot be fixed automatically by asciidoclint. |

Use `fixHelper` for the human/AI repair instruction. Rule docs define the
default helper for that rule. A finding may override it only when the concrete
location has more specific repair guidance, such as a computed heading marker,
missing target path, or include context. The lint API resolves this as:

```ts
finding.fixHelper ?? rule.docs?.fixHelper
```

A finding with a `fix` contains actual machine-applicable edits; a finding
without `fix` can still carry resolved `fixHelper` to explain how to repair the
issue manually. There is no separate `help` field in the public API; keeping one
helper concept prevents drift.

Fix application must:

- Group edits by original source file, not expanded temp files.
- Detect overlapping edits.
- Reparse after fixing when structural edits are applied.
- Refuse edits that cross protected blocks unless the rule explicitly marks them
  safe for that block type.

## CLI

Initial commands:

```bash
asciidoclint "**/*.adoc"
asciidoclint --format json docs/index.adoc
asciidoclint --fix docs/index.adoc
asciidoclint --fix --unsafe docs/index.adoc
asciidoclint --config .asciidoclint.yaml docs/
```

Formats:

- Pretty terminal output.
- JSON.
- SARIF for GitHub code scanning, low priority until there is a concrete need.
- JUnit for CI systems that prefer test reports, low priority until there is a
  concrete need.

Expected pretty terminal output:

```text
docs/index.adoc:12:1 AD001/heading-level-progression error Skipped section level: expected level 2 after level 1, found level 3
  === Details
  fix helper: Change this heading to "==" or add the missing parent section.

docs/index.adoc:37:8 AD024/missing-include error Missing include target: chapters/setup.adoc
  include::chapters/setup.adoc[]
          ^^^^^^^^^^^^^^^^^^^

docs/figures.adoc:21:1 AD028/image-alt-text warning Image is missing alt text: architecture.png
  image::architecture.png[alt=""]

3 findings: 2 errors, 1 warning
1 unsafe fix available; run with --fix --unsafe to apply it
```

Output rules:

- Use one primary line per finding:
  `file:line:column rule-id[/alias] severity message`.
- Show context only when it clarifies the problem.
- Summarize safe and unsafe fix availability after the findings.
- Print a summary grouped by severity and fix applicability.
- Keep terminal output deterministic so snapshots are easy to test.

Exit codes:

| Code | Meaning |
|---:|---|
| 0 | No error findings. |
| 1 | One or more error findings. |
| 2 | Configuration, plugin loading, or runtime error. |

## VS Code/Cursor Extension

The project should publish a VS Code extension in addition to the Node.js
package. Cursor can consume VS Code-compatible extensions, so the same extension
is the expected editor integration path.

Package identity:

- Node package: `asciidoclint`.
- VS Code/Open VSX extension ID: `f33lgood.asciidoclint`.

The extension must not reimplement linting rules. It should call the shared
`asciidoclint` API directly when bundled in the workspace, or execute the
workspace/local CLI as a fallback. The rule registry, configuration loader,
custom rule loader, normalized model, document graph, and fix engine remain in
the Node package.

AsciiDoc editor integration must be document-aware. Markdown linters can treat a
single source file as the primary context. AsciiDoc projects often use a root
document with `include::` children, and many rules are only correct when a
fragment is evaluated inside its owning document. The extension should therefore
lint document graphs, not independent files, by default.

### Document Graph Model

On folder open, and again when include directives or config files change, the
extension should build a lightweight graph:

```text
root document
  include::chapter-1.adoc[]
  include::chapter-2.adoc[]
    include::section-2-1.adoc[]
```

Root documents are discovered by evidence, not by linting every `.adoc` file as
an independent document:

- Explicit `documents` entries in `.asciidoclint.yaml`.
- Files that are not included by any other AsciiDoc file in the workspace.
- Files with a level-0 document title.
- Common names such as `index.adoc`, `master.adoc`, and `README.adoc` are used
  automatically when present.
- If no configured or conventional root exists and multiple top-level AsciiDoc
  files are present, the editor prompts the user to select the document root for
  the current workspace lint/fix run.

Project config can make the document set explicit:

```yaml
documents:
  - index.adoc
  - guides/user-guide.adoc

ignores:
  - build/**
  - output/**
  - vendor/**

editor:
  defaultScope: document
  lintOnSave: true
```

Symlinked directories should not be followed by default. Users can opt into that
later with an explicit setting if a project intentionally keeps document roots
behind symlinks.

### Lint Scopes

The editor should expose three scopes:

| Scope | Meaning | Default use |
|---|---|---|
| Current File | Lint only the active file with local text/dependency rules where possible. | Quick manual check and files not owned by a graph. |
| Current Document | Find the root document(s) that include the active file and lint those document graphs. | Default on save for included fragments and root docs. |
| Workspace Documents | Lint configured or selected root document graphs. | Default workspace command. |

An advanced/debug command can lint every AsciiDoc file as a separate root, but
that is not the normal workspace behavior because it produces duplicate work and
fragment-context false positives.

### File Change Behavior

The editor integration separates two kinds of work:

- **Graph traversal**: discover roots, include edges, and ownership. This can run
  quietly because it should not publish diagnostics by itself.
- **Lint execution**: run rules and update diagnostics. This should happen only
  from save, explicit commands, fixes, or imported CLI artifacts.

Lint-trigger events:

| Event | Lint? | Diagnostic update? | Notes |
|---|---:|---:|---|
| Workspace open / extension activation | No | Import artifact only | Import `.asciidoclint/diagnostics.json` when present and enabled. |
| Open, click, focus, or Problems navigation | No | No | Navigation must not replace diagnostics. |
| Unsaved text edit / typing | No | No | AsciiDoc lint is document-context work; wait for save or command. |
| Save AsciiDoc file with `asciidoclint.run: "onSave"` | Yes | Yes | Rebuild or refresh graph first, then lint the affected document scope. |
| Save AsciiDoc file with `asciidoclint.run: "manual"` | No | No | Graph may still refresh quietly. |
| `asciidoclint: Lint Workspace Documents` | Yes | Yes | Manual root-document scope. |
| `asciidoclint: Fix Workspace (Safe)` | Yes | Yes | Apply safe fixes to workspace document targets, save dirty AsciiDoc files first, refresh graph, then update diagnostics. |
| Diagnostics artifact create/change | No | Yes | Import external CLI result and check fingerprint freshness. |
| Diagnostics artifact delete | No | Clear imported diagnostics | Provides a clean editor state. |
| `asciidoclint: Clear Diagnostics` | No | Clear diagnostics | Manual cleanup only. |

Graph-traversal events:

| Event | Traverse graph? | Lint as a side effect? | Notes |
|---|---:|---:|---|
| Workspace open / extension activation | Yes | No | Build quietly so document ownership is available. |
| `asciidoclint: Rebuild Document Graph` | Yes | No | Manual graph refresh for debugging or stale state. |
| AsciiDoc file create/delete/rename | Yes | No | Root and include ownership may have changed. |
| AsciiDoc file save | Yes | Maybe | Save can also lint when `run` is `onSave`. |
| Config file create/change/delete | Yes | No | `documents`, ignores, rule config, and custom rules may affect scope/fingerprints. |
| Diagnostics artifact create/change/delete | No | No | Artifact import uses its own fingerprint; it does not alter the source graph. |
| Open, click, focus, Problems navigation, or typing | No | No | These are editor navigation/editing events, not durable project changes. |

When graph traversal determines that a saved file has changed:

- If it is a root document, re-lint that document graph.
- If it is an included child, re-lint every known root document that includes
  it.
- If ownership is unknown, run lightweight current-file lint first, rebuild the
  graph in the background, then re-lint the owning document once discovered.
- If `.asciidoclint.yaml` changes, rebuild the graph and mark existing
  diagnostics stale; do not re-lint until save or an explicit lint command.
- Opening, clicking, or focusing a file must not trigger lint by itself. Those
  events also should not traverse the graph; diagnostics should not be replaced
  merely because a user navigated through files.

Diagnostics should always be reported against the actual source file and line,
even when linting was triggered from a root document.

### Background Processing

Linting should run in the extension host background with debouncing,
cancellation, and stale-result protection:

- On folder open: build the document graph quietly.
- On extension activation: import `.asciidoclint/diagnostics.json` when present
  and check its fingerprint for stale source/config/tool inputs.
- On save: schedule document-context linting for the changed file.
- On type: do not lint. AsciiDoc linting is document-context work, so text
  editing should wait for save or an explicit command.
- Show progress only for longer runs.
- Keep the Problems panel, editor highlights, and file explorer diagnostics in
  sync with the latest completed run.
- Never replace newer diagnostics with results from an older run that completed
  late.

Expected editor behavior:

- Activate for `asciidoc`, `adoc`, `asc`, and `asciidoc` language/file
  extensions.
- Do not lint on file open, focus, or typing. Lint on save in document context
  by default, or through explicit commands.
- Read `.asciidoclint.yaml` from the workspace root or nearest project root.
- Show findings in the Problems panel with rule ID, alias, severity, message,
  source range, and fix helper text.
- Include the `AD###/alias` label in diagnostic message text as well as
  `Diagnostic.code`. VS Code/Cursor Problems filtering is more reliable against
  visible message text than against implementation-specific diagnostic fields;
  filtering for `AD000` should find `AD000/asciidoctor-diagnostic` records.
- Allow editor-only hiding of noisy rule IDs or aliases, such as `AD000`, so
  users can suppress renderer diagnostics from the Problems panel without
  changing CLI lint behavior.
- Provide hover/detail text from the same rule docs used by CLI rule
  explanation output.
- Provide code actions for safe fixes first; expose unsafe fixes only through an
  explicit setting or command.
- Provide commands:
  - `asciidoclint: Lint Workspace Documents`
  - `asciidoclint: Rebuild Document Graph`
  - `asciidoclint: Cancel Running Lint`
  - `asciidoclint: Fix Workspace (Safe)`

Settings:

```json
{
  "asciidoclint.enable": true,
  "asciidoclint.run": "onSave",
  "asciidoclint.defaultScope": "document",
  "asciidoclint.config": ".asciidoclint.yaml",
  "asciidoclint.executablePath": "",
  "asciidoclint.customRules": [],
  "asciidoclint.hiddenRules": [],
  "asciidoclint.unsafeFixes": false,
  "asciidoclint.followSymlinks": false,
  "asciidoclint.importCliDiagnostics": true
}
```

When the official Asciidoctor VS Code extension is also installed, it can publish
its own native Asciidoctor diagnostics as files are opened. Those diagnostics are
useful for preview workflows, but they are a separate Problems source from
`asciidoclint` and can make the count appear to change while the user is only
navigating files. Workspaces that use `asciidoclint` as the single lint source
should disable the native extension diagnostics:

```json
{
  "asciidoc.debug.enableErrorDiagnostics": false
}
```

`AD000/asciidoctor-diagnostic` should then come from `asciidoclint` only, either
through live editor lint or through an imported CLI diagnostics artifact. This
prevents duplicate Asciidoctor findings and keeps Problems counts stable during
file navigation.

Resolution order for the lint engine:

1. Workspace `node_modules/.bin/asciidoclint` or package API when installed.
2. Extension-bundled engine version.
3. User-configured `asciidoclint.executablePath`.

The extension should prefer the workspace engine when present so project
configuration and custom rule packages resolve exactly as they do in CI. The
extension-bundled engine is a convenience fallback for users who only install
the editor extension.

Custom rule scalability must match the CLI:

- `.asciidoclint.yaml` can list local files, TypeScript rule sources, JavaScript
  rule modules, or package names in `customRules`.
- Rule IDs and aliases are validated by the same registry.
- Rule docs are loaded from the rule metadata or adjacent docs files and shown
  in diagnostics and hovers.

The extension should consume JSON diagnostics from the API rather than parsing
pretty terminal output. Pretty output remains for humans and task/problem
matcher fallback, not for the primary extension integration.

### CLI To Editor Diagnostics

VS Code and Cursor do not automatically import diagnostics from arbitrary CLI
runs. The Diagnostic API can only be updated by an extension, and task problem
matchers only work for commands launched as editor tasks. To make external CLI
runs visible in an already-open editor, `asciidoclint` should support an
explicit diagnostics artifact that the extension watches.

Proposed artifact:

```bash
asciidoclint --format json \
  --output-diagnostics .asciidoclint/diagnostics.json \
  docs/index.adoc
```

The extension watches `.asciidoclint/diagnostics.json` and, when
`asciidoclint.importCliDiagnostics` is enabled:

- Reads the JSON result.
- Verifies the workspace root and file paths are inside the open workspace.
- Updates the Problems panel and editor highlights from the artifact.
- Marks imported diagnostics with source `asciidoclint`.
- Replaces only diagnostics from the same source/scope, leaving live editor runs
  independent.

This gives three integration paths:

| Trigger | Editor visibility |
|---|---|
| Extension lint command | Direct diagnostics via API. |
| VS Code/Cursor task using `asciidoclint` | Problem matcher or diagnostics artifact. |
| External terminal/CI-like CLI run | Diagnostics artifact watched by the extension. |

The artifact approach should be opt-in so normal CLI runs do not create editor
state or repository noise unexpectedly.

## Implementation Priorities

- Asciidoctor diagnostics as first-class lint results.
- Asciidoctor structural spans for grammar-heavy blocks, with tolerant fallback
  for broken documents.
- Include/source line mapping.
- Core and organization-specific rule separation.
- Safe and unsafe automatic fix categories, plus non-automatic fix helpers.
- Installable `skills/asciidoclint` workflow for natural-language lint,
  summarize, safe-fix, unsafe-fix, and AI-assisted repair requests.
- Auto-fix grouped by original source file.
- Schema-validated rule configuration.
- Declarative template conformance for required sections, allowed blocks, block
  ordering, attributes, and title patterns.

## Initial Milestones

1. Repo and architecture review.
2. Minimal TypeScript library with `lint()` API, JSON output, config loading,
   and one text rule.
3. Asciidoctor.js adapter with parser diagnostics normalized to findings.
4. Tolerant structure parser for headings, blocks, includes, images, tables, and
   source-block protection, plus Asciidoctor-backed table spans for rules that
   need renderer-accurate table grammar.
5. Core rules matching the syntax and structure fixtures.
6. Fix engine with safe fixes only.
7. CLI package with terminal and JSON output.
8. SARIF or JUnit output only when a concrete integration needs it.

## Review Decisions

- Start as a single package; move to a workspace only when needed.
- Use Asciidoctor.js first to minimize required local dependencies. Keep Ruby
  Asciidoctor optional for parity checks.
- Keep company-specific rules in an organization policy pack unless a rule is
  clearly common AsciiDoc structure behavior.
- Start with a smaller native conformance schema instead of promising external
  schema compatibility in v1.
- Treat SARIF and JUnit as low-priority output formats until an integration
  needs them.

## Current Implementation Coverage

Implemented prototype coverage:

- Library API and CLI.
- Asciidoctor.js diagnostics normalized into `AD000/asciidoctor-diagnostic`
  findings.
- Asciidoctor.js table spans merged into the normalized model before table rules
  run.
- Tolerant parser for headings, includes, images, delimited blocks, attributes,
  conditionals, xrefs, local links, anchors, and simple tables.
- Source-map records for root and included files.
- Built-in `AD###` rule namespace with category tags and packs.
- Thirty-eight built-in rules covering core headings/blocks/lists/tables/images/diagrams, circular includes,
  dependency resolution, generic policy, and cleanup.
- Rule metadata with ID plus one alias.
- Config severity overrides and rule disabling.
- Config `extends` presets and `ignores` patterns.
- Custom rule loading from outside this repository.
- `--list-rules`, `--explain`, and `init-rule`.
- Safe fix application for `AD032/blank-before-block`, `AD034/no-hard-tabs`,
  and `AD035/blank-after-block`.
- Coverage reporting with enforced thresholds through `npm run test:coverage`.
- Rule necessity report that classifies every built-in by rendering impact,
  reference/navigation integrity, or documentation-quality contract rather than
  by reference-tool provenance.

Not yet complete:

- Full declarative conformance schema.
- Unsafe fixes and structural reparse invariants beyond the current safe-fix
  path.
- SARIF and JUnit output.
- Large performance fixtures and unsafe-fix fixtures.
