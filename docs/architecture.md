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
7. Source waivers are explicit, rule-ID scoped, auditable findings metadata,
   and are specified in [docs/waiver.md](waiver.md).
   Waiver-system diagnostics use the `ADW##` namespace and still follow the
   normal built-in rule metadata, documentation, and test contract.

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
can publish the Node.js package, an installable skill, and a VS Code-compatible
extension, while keeping the lint engine shared. The parser baseline should
remain Asciidoctor-compatible and hidden behind adapters.

Start as a single TypeScript package for the engine and CLI. Add the VS
Code-compatible extension as a workspace package when editor diagnostics become
a release target. Split other packages only when the CLI, rule packs, or
extension become painful to maintain in one package.

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
  vscode-asciidoclint/     # VS Code-compatible extension wrapper
```

Future workspace shape, if needed:

```text
packages/
  asciidoclint/           # shared engine, public API, CLI, built-in rules
  asciidoclint-skill/     # optional skill-only package, if split later
  vscode-asciidoclint/    # VS Code-compatible extension wrapper
  asciidoclint-rules/     # optional published rule packs, if needed
```

## Repository Organization

Use a rule layout adapted for AsciiDoc's project-oriented fixtures:

```text
docs/
  waiver.md
  custom-rules.md
  configuration.md
  rule-architecture.md
  rules/
    AD001.md
    AD002.md
    ...

skills/
  asciidoclint/
    SKILL.md
    references/
      result-schema.md
      lint-summary.md
      agentic-fix.md
      waivers.md
      rule-create.md
      rule-review.md
      feedback.md

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
    experimental-custom-rules/
      index.adoc
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

The `test/fixtures/experimental-custom-rules/ORG###` rules are experimental fixtures. They
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

Rules are plain objects loaded by the shared rule registry. The important
architectural boundary is that generic AsciiDoc behavior belongs in built-in
`AD###` rules, while project, organization, product, or template policy belongs
in custom-rule packages.

Details:

- [Rule architecture](rule-architecture.md)
- [Custom rules](custom-rules.md)
- [Built-in rule docs](rules/)

## Rule Documentation

Rule documentation is part of the rule contract. CLI, editor, and AI-agent
workflows all consume the same metadata and examples.

Details live in [Rule architecture](rule-architecture.md) and the generated
[built-in rule docs](rules/).

## AI Skill Distribution

`asciidoclint` should ship an installable AI-agent skill in the repository:

```text
skills/
  asciidoclint/
    SKILL.md
    references/
      result-schema.md
      lint-summary.md
      agentic-fix.md
      waivers.md
      rule-create.md
      rule-review.md
      feedback.md
```

The skill is an orchestration layer over the deterministic npm package. It
should not replace the CLI or embed a separate lint engine. Its responsibilities
are:

- Interpret natural language requests such as "lint this AsciiDoc", "summarize
  findings", "apply safe fixes", "apply unsafe fixes", "use AI to repair the
  remaining issues", "add a waiver", "create a custom rule", "review this
  rule", and "prepare a GitHub issue".
- Resolve the tool in this order: workspace `node_modules/.bin/asciidoclint`,
  `npx asciidoclint`, then `npx -y asciidoclint@latest`.
- Run `--format json` for machine-readable results.
- Run `--fix` for deterministic safe fixes.
- Run `--fix --unsafe` only when the user explicitly requests unsafe fixes.
- Use `fixHelper`, rule metadata, finding details, and local source context for
  AI-assisted repairs that do not have deterministic edits.
- Add source waivers only when fixing is not the right change, using the
  narrowest scope and a reason.
- Help create and review project-local custom rules without treating
  organization policy as built-in policy.
- Prepare sanitized, paste-ready feedback messages for
  `https://github.com/f33lgood/asciidoclint/issues`.
- Rerun lint after edits, waivers, and rule changes, then summarize fixed and
  remaining findings.

The primary skill install path should follow the open skills ecosystem:

```bash
npx skills add f33lgood/asciidoclint --skill asciidoclint -a codex -g
```

The repository should not check in agent-specific install copies under
`.agents/skills`, `.claude/skills`, or other target-agent directories. The
single public source of truth is `skills/asciidoclint`, and developers should
install it into their target agent when they need repo-local skill assistance.
With that organization, the shorter form also installs the public skill:

```bash
npx skills add f33lgood/asciidoclint
```

The npm package should also expose a convenience installer:

```bash
npx asciidoclint install-skill
npx asciidoclint uninstall-skill
```

This command copies the bundled `skills/asciidoclint` directory into
the selected agent's skill root. It should support `--agent` for common coding
agents, `--project` for project-local installs, `--dest` for explicit test or
custom install roots, and `--force` to replace an existing skill. This keeps
npm-package installs version-aligned with the skill that was published in the
same package.

`uninstall-skill` should remove `asciidoclint` from the same selected skills
root. It should be idempotent so users can disable skill assistance without
needing to inspect the filesystem first.

The installer intentionally implements only the small target matrix needed by
`asciidoclint`; the open `skills` CLI remains the full interactive installer.
Validated target paths from `npx skills`:

| Agent | `--agent` | Project root | Global root |
|---|---|---|---|
| Codex | `codex` | `.agents/skills/` | `~/.codex/skills/` |
| Cursor | `cursor` | `.agents/skills/` | `~/.cursor/skills/` |
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` |
| OpenClaw | `openclaw` | `skills/` | `~/.openclaw/skills/` |

`--dest <skills-root>` overrides the target matrix and installs directly under
the supplied skills root.

### Skill Installation Channels

End users should install a released skill. They should not need to know where
the repository checkout lives:

```bash
npx asciidoclint@latest install-skill --force
```

or, for a project-local install that should travel with the current workspace:

```bash
npx asciidoclint@latest install-skill --project --force
```

Install a released skill for a specific project-local agent target:

```bash
npx asciidoclint@latest install-skill --project --agent codex --force
npx asciidoclint@latest install-skill --project --agent cursor --force
npx asciidoclint@latest install-skill --project --agent claude-code --force
```

Developers need two switchable channels:

- released channel: the skill bundled in the published npm package;
- workspace channel: the skill currently under development in an
  `asciidoclint` repository checkout.

The active channel is determined by the CLI used to run `install-skill` and the
destination selected by `--project`, `--dest`, or the default global skills
root. `--force` is the explicit switch operation because it replaces the
existing `asciidoclint` skill at that destination.

Inside the `asciidoclint` repository, install the workspace-under-development
skill into the repository-local skill root:

```bash
npx tsx src/cli/index.ts install-skill --project --force
```

Use `--agent claude-code` or `--agent cursor` to test those project install
layouts from the same checkout. Avoid `--agent openclaw --project` inside the
`asciidoclint` repository because OpenClaw's project path is `skills/`, which is
also this repository's canonical public skill source directory.

Switch that same repository workspace back to the released skill:

```bash
npx asciidoclint@latest install-skill --project --force
```

For global developer testing, use the same commands without `--project`.

Outside the `asciidoclint` repository, a developer may still install the
workspace-under-development skill into the current project by running the
checkout's CLI from the target project directory:

```bash
node /path/to/asciidoclint/dist/cli/index.js install-skill --project --force
```

If the checkout has not been built, run the TypeScript entry point with `tsx`:

```bash
npx tsx /path/to/asciidoclint/src/cli/index.ts install-skill --project --force
```

Switch that outside project back to the released skill with:

```bash
npx asciidoclint@latest install-skill --project --force
```

Use `--dest <skills-root>` when testing against an explicit Codex home or a
temporary skills root:

```bash
npx asciidoclint@latest install-skill --dest /tmp/codex-skills --force
node /path/to/asciidoclint/dist/cli/index.js install-skill --dest /tmp/codex-skills --force
```

Remove a released, project-local, or temporary skill install with the matching
scope:

```bash
npx asciidoclint@latest uninstall-skill
npx asciidoclint@latest uninstall-skill --project
npx asciidoclint@latest uninstall-skill --project --agent claude-code
npx asciidoclint@latest uninstall-skill --dest /tmp/codex-skills
```

Do not install separate public and developer copies under different skill names
by default. A single `asciidoclint` skill name keeps user prompts stable; channel
switching should happen by replacing the installed skill at the chosen scope.
The repository's `skills/asciidoclint` directory is the canonical public skill
source. Checked-in `.agents/skills`, `.claude/skills`, and other agent-specific
install directories are intentionally avoided; they are generated installation
targets, not source artifacts. Developers who want repo-local skill assistance
should install the development channel with `install-skill --project --agent
<agent> --force` and uninstall it when done.

LLM calls should remain outside the core npm package initially. The package
stays deterministic and offline-friendly; the skill uses the surrounding agent
to perform AI-assisted edits, inspect diffs, rerun lint, and report results.

## AI-Authored Rules

The rule API should be simple enough for AI tools to generate or revise custom
rules, but strict enough to catch conflicts and incomplete metadata before
linting starts. `init-rule` is an optional scaffold helper for the documented
custom-rule package layout; the package layout is the contract.

Details:

- [Custom rules](custom-rules.md)
- [Rule architecture](rule-architecture.md)
- [rule-create skill reference](../skills/asciidoclint/references/rule-create.md)

## Rule Packs

Built-ins use the reserved `AD###` namespace. Custom packs should use an
organization-owned namespace such as `ORG###`. Pack tags group rules for
presets, docs, filtering, and AI guidance without creating more built-in ID
namespaces.

Details live in [Rule architecture](rule-architecture.md) and
[Custom rules](custom-rules.md).

## Configuration

Configuration supports global user defaults, project policy, rule toggles,
custom-rule packages, and document entry hints. The detailed config contract,
including `extends` presets and editor-setting boundaries, lives in
[Configuration](configuration.md).

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
asciidoclint --format json index.adoc
asciidoclint --fix index.adoc
asciidoclint --fix --unsafe index.adoc
asciidoclint --config .asciidoclint/config.yaml index.adoc
asciidoclint --print-config index.adoc
asciidoclint --no-global-config index.adoc
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
- Print a summary grouped by severity, waived count, and fix applicability.
- Keep terminal output deterministic so snapshots are easy to test.

Exit codes:

| Code | Meaning |
|---:|---|
| 0 | No error findings. |
| 1 | One or more error findings. |
| 2 | Configuration, plugin loading, or runtime error. |

## VS Code-Compatible Extension

The project should publish a VS Code extension in addition to the Node.js
package. The same extension can be distributed through the VS Code Marketplace
or Open VSX and used by editors compatible with VS Code's diagnostic model.

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

- Explicit `documents` entries in `.asciidoclint/config.yaml`.
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
- If `.asciidoclint/config.yaml` changes, rebuild the graph and mark existing
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
- Read `.asciidoclint/config.yaml` from the workspace root or nearest project
  root, and use the same global/project/CLI config merge behavior as the CLI.
- Show findings in the Problems panel with rule ID, alias, severity, message,
  source range, and fix helper text.
- Include the `AD###/alias` label in diagnostic message text as well as
  `Diagnostic.code`. VS Code-compatible Problems filtering is more reliable
  against visible message text than against implementation-specific diagnostic
  fields; filtering for `AD000` should find `AD000/asciidoctor-diagnostic`
  records.
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
  "asciidoclint.config": ".asciidoclint/config.yaml",
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

- `.asciidoclint/config.yaml` can list local rule package folders, shared npm
  packages, or direct rule modules in `customRules`.
- Rule IDs and aliases are validated by the same registry.
- Rule docs are loaded from the rule metadata or adjacent docs files and shown
  in diagnostics and hovers.

The extension should consume JSON diagnostics from the API rather than parsing
pretty terminal output. Pretty output remains for humans and task/problem
matcher fallback, not for the primary extension integration.

### CLI To Editor Diagnostics

VS Code-compatible editors do not automatically import diagnostics from
arbitrary CLI runs. The Diagnostic API can only be updated by an extension, and
task problem matchers only work for commands launched as editor tasks. To make
external CLI runs visible in an already-open editor, `asciidoclint` should
support an explicit diagnostics artifact that the extension watches.

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
| VS Code-compatible task using `asciidoclint` | Problem matcher or diagnostics artifact. |
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
- `--list-rules`, `--explain`, `--custom-rule`, and `init-rule`.
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
