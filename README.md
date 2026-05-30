<p align="center">
  <img src="assets/logo.svg" width="160" height="160" alt="asciidoclint logo">
</p>
<p align="center">
  <sub><code>assets/logo.svg</code> and <code>assets/icon.svg</code> were created with <a href="https://inkscape.org/">Inkscape</a>. The <strong>lint</strong> label uses <a href="https://www.jetbrains.com/lp/mono/">JetBrains Mono</a> (SIL Open Font License).</sub>
</p>

# asciidoclint

`asciidoclint` is an AsciiDoc syntax, structure, and document-policy linter for
CLI, AI-agent, and editor workflows.

`asciidoclint` began as an in-house implementation and has been open-sourced
under the MIT License since June 1, 2026.

Design goals:

- Provide a library-first, typed, plugin-friendly rule model.
- Use Asciidoctor-backed diagnostics, source mapping, include awareness, and a
  safe/unsafe fix model.
- Keep generic AsciiDoc syntax/structure rules separate from project or
  organization policy rules.

Start with the architecture proposal:

- [Architecture](docs/architecture.md)

## Install the npm package

Install in a project:

```bash
npm install --save-dev asciidoclint
```

Run the CLI:

```bash
npx asciidoclint docs/**/*.adoc
npx asciidoclint --format json docs/**/*.adoc
npx asciidoclint --fix docs/**/*.adoc
npx asciidoclint --fix --unsafe docs/**/*.adoc
```

Inspect rules:

```bash
npx asciidoclint --list-rules
npx asciidoclint --explain AD001
npx asciidoclint --explain heading-level-progression
```

Load organization-specific conformance or style rules as custom rules:

```yaml
extends:
  - asciidoclint:recommended

ignores:
  - build/**

customRules:
  - ./lint-rules/ORG001-no-todo.js
  - ./lint-rules/ORG002-section-policy.js
```

Scaffold a custom rule without modifying `asciidoclint` source:

```bash
npx asciidoclint init-rule --pack my-org --id ORG001 --alias no-todo
```

## Install the AI skill

The repository ships an `asciidoclint` skill under `skills/asciidoclint`. The
skill lets AI agents trigger lint, summarize results, apply safe fixes, apply
explicit unsafe fixes, and use reported `fixHelper` guidance for focused
AI-assisted repairs.

Install the skill directly from GitHub with the open skills CLI:

```bash
npx skills add f33lgood/asciidoclint --skill asciidoclint -a codex -g
```

The repository hides repo-maintenance skills from normal discovery, so the
shorter form installs the public `asciidoclint` skill too:

```bash
npx skills add f33lgood/asciidoclint
```

If you already installed the npm package and want the matching bundled skill
version, install it through the `asciidoclint` CLI:

```bash
npx asciidoclint install-skill
```

Useful installer options:

```bash
npx asciidoclint install-skill --project
npx asciidoclint install-skill --dest ./tmp/skills --force
```

## VS Code and Cursor extension

`asciidoclint` is also available as a VS Code/Cursor extension. The extension
shows lint issues as source-file diagnostics in the editor and Problems panel,
including diagnostics mapped back to included source files.

The extension can import CLI diagnostics written by:

```bash
npx asciidoclint --format json \
  --output-diagnostics .asciidoclint/diagnostics.json \
  docs/index.adoc
```

See [packages/vscode-asciidoclint](packages/vscode-asciidoclint/README.md) for
extension commands and settings.

## Use this repository

Install dependencies:

```bash
npm install
```

Run the check loop:

```bash
npm run check
```

Run coverage only:

```bash
npm run test:coverage
```

Coverage thresholds and the latest metrics are documented in
[docs/reports/report-coverage.md](docs/reports/report-coverage.md).

Run the CLI from source:

```bash
npx tsx src/cli/index.ts test/fixtures/api/structural_errors.adoc
npx tsx src/cli/index.ts --format json test/fixtures/api/structural_errors.adoc
npx tsx src/cli/index.ts --fix test/fixtures/api/structure_only.adoc
npx tsx src/cli/index.ts install-skill --dest ./tmp/skills --force
```

Build and package the VS Code/Cursor extension:

```bash
npm run build:extension
npm test -w vscode-asciidoclint
npm run package -w vscode-asciidoclint
```

Install the generated `.vsix` in Cursor with **Extensions: Install from VSIX**,
then run **asciidoclint: Lint Current File** or **asciidoclint: Lint Workspace**.

## Built-in Rules

| ID / Alias | Short description |
|---|---|
| `AD000/asciidoctor-diagnostic` | Asciidoctor parser/render diagnostics are reported as lint findings |
| `AD001/heading-level-progression` | Section headings must not skip levels |
| `AD002/single-document-title` | Article documents should have only one level-0 title |
| `AD003/unterminated-block` | Delimited blocks should have matching closing delimiters |
| `AD004/table-cell-count` | Table rows should match the declared column count |
| `AD005/explicit-document-title` | Root documents should provide an explicit document title |
| `AD006/included-document-title` | Included AsciiDoc files should not introduce a level-0 title without level offset |
| `AD007/heading-depth-limit` | Section headings should not exceed Asciidoctor's supported depth |
| `AD008/blank-before-list` | Lists should be separated from preceding paragraph text |
| `AD010/table-title` | Table blocks should have a title |
| `AD011/image-title` | Block images should have a title |
| `AD012/diagram-title` | Diagram blocks should have a title |
| `AD013/standalone-inline-image` | Standalone image macros should use block image syntax |
| `AD016/malformed-figure-caption` | Figure captions should use AsciiDoc title syntax |
| `AD017/malformed-table-caption` | Table captions should use AsciiDoc title syntax |
| `AD019/content-after-include` | Text should not be attached directly after include directives |
| `AD020/appendix-section-level` | Appendices should be section-level blocks in article documents |
| `AD022/circular-include` | Include trees must not contain cycles |
| `AD023/empty-section` | Sections should contain body content or child sections |
| `AD024/missing-include` | Include targets should exist after attribute substitution |
| `AD025/missing-image` | Image targets should exist after attribute substitution |
| `AD026/missing-xref` | Cross-reference targets should resolve to an anchor or file |
| `AD027/missing-local-link` | Local link targets should resolve to existing files |
| `AD028/image-alt-text` | Images should not explicitly set empty alt text |
| `AD029/markdown-link-image-residue` | Markdown link and image residue should not render as text |
| `AD030/markdown-table-residue` | Markdown pipe table residue should not render as text |
| `AD031/no-nested-link-text` | Link text should not contain nested links or cross references |
| `AD032/blank-before-block` | Structural block delimiters should be preceded by a blank line |
| `AD034/no-hard-tabs` | Prose and structural markup lines should not contain hard tabs |
| `AD035/blank-after-block` | Structural block delimiters should be followed by a blank line |
| `AD036/list-marker-residue` | Standalone list marker residue should be removed or completed |
| `AD037/underline-residue` | Standalone three-underscore residue should be removed or converted |
| `AD039/punctuation-passthrough-residue` | Safe punctuation passthrough residue should be removed |
| `AD040/html-link-text-residue` | Link text should not contain raw HTML or XML residue |
| `AD041/no-space-in-inline-formatting` | Inline formatting markers should not contain inner spaces |
| `AD042/interdocument-xref-text` | Interdocument xrefs should provide explicit link text |
| `AD043/section-title-start-left` | Section title syntax should start at the beginning of the line |
| `AD044/local-adoc-link` | Local AsciiDoc files should be referenced with xref, not link |
| `AD045/markdown-heading-mix` | Markdown-compatible headings should not be mixed with AsciiDoc headings |

Detailed per-rule docs live under `docs/rules/`; `--explain` exposes the same
metadata programmatically.

## Tags

Tags group related rules and can be used to enable or disable classes of rules.

| Group | IDs |
|---|---|
| `blank_lines` | `AD008` |
| `blocks` | `AD003`, `AD032`, `AD035` |
| `accessibility` | `AD028`, `AD042` |
| `cleanup` | `AD032`, `AD034`, `AD035`, `AD036`, `AD037`, `AD039`, `AD040`, `AD041` |
| `conversion` | `AD029`, `AD030`, `AD031`, `AD036`, `AD037`, `AD039`, `AD040` |
| `dependencies` | `AD024`, `AD025`, `AD026`, `AD027` |
| `diagram` | `AD012` |
| `format` | `AD041` |
| `headings` | `AD001`, `AD002`, `AD005`, `AD006`, `AD007`, `AD043`, `AD045` |
| `image` | `AD011`, `AD013`, `AD016`, `AD025`, `AD028` |
| `include` | `AD006`, `AD019`, `AD022`, `AD024` |
| `inline` | `AD041` |
| `lists` | `AD008`, `AD036` |
| `parser` | `AD000` |
| `table` | `AD004`, `AD010`, `AD017`, `AD030` |
| `whitespace` | `AD034` |
| `references` | `AD023` |
| `links` | `AD027`, `AD031`, `AD042`, `AD044` |
| `structure` | `AD043` |
| `markdown-compatibility` | `AD045` |
| `maintainability` | `AD045` |
| `xref` | `AD026`, `AD042`, `AD044` |

## Rule ID Namespaces

Built-in rule IDs use one reserved namespace:

- `AD###` - all built-in `asciidoclint` rules.

Rule responsibility is expressed through tags such as `headings`,
`dependencies`, `policy`, and `cleanup`, not through multiple built-in ID
prefixes. This keeps built-in IDs predictable as the rule set grows.

Company, product, or template-specific rules should not be built-ins. Use a
three-letter custom prefix such as `ORG`, `ABC`, or a team-owned namespace. The
registry rejects duplicate IDs and aliases across built-in and custom rules.

The rule-by-rule rendering and severity rationale is in
[docs/rules/rule-necessity.md](docs/rules/rule-necessity.md).
