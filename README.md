<p align="center">
  <img src="assets/logo.svg" width="160" height="160" alt="asciidoclint logo">
</p>

# asciidoclint

`asciidoclint` is an AsciiDoc syntax, structure, and document-policy linter for
CLI, AI-agent, and editor workflows.

## Install the npm package

```bash
npm install --save-dev asciidoclint
```

## Use the CLI

Run lint:

```bash
npx asciidoclint index.adoc
npx asciidoclint --format json index.adoc
```

Apply deterministic fixes:

```bash
npx asciidoclint --fix index.adoc
npx asciidoclint --fix --unsafe index.adoc
```

Inspect rules:

```bash
npx asciidoclint --list-rules
npx asciidoclint --explain AD001
npx asciidoclint --explain heading-level-progression
npx asciidoclint --explain AD001 --format json
```

Use a project config file when the same lint settings should be reused:

```yaml
# .asciidoclint/config.yaml
extends:
  - asciidoclint:recommended
```

Use a global config file for settings that should apply across projects:

```yaml
# ~/.asciidoclint/config.yaml
customRules:
  - "@example/asciidoclint-rules"
```

See [docs/configuration.md](docs/configuration.md) for configuration fields and
merge order. See [docs/waiver.md](docs/waiver.md) for source waiver syntax and
reporting.

## Install the AI skill

The repository ships an `asciidoclint` skill for AI agents. Install it from the
npm package:

```bash
npx asciidoclint install-skill
```

Or install it directly from GitHub with the open skills CLI:

```bash
npx skills add f33lgood/asciidoclint --skill asciidoclint -a codex -g
```

Remove the installed skill when you want to use `asciidoclint` without AI skill
assistance:

```bash
npx asciidoclint uninstall-skill
```

The public skill exposes these user-facing workflows:

| Workflow | Purpose |
|---|---|
| `lint-summary` | Run lint and summarize findings by severity, rule, file, waiver status, and fixability. |
| `agentic-fix` | Use lint guidance and local source context to repair findings that deterministic fixes cannot safely handle. |
| `waivers` | Add narrow source waivers and verify waiver syntax. |
| `rule-create` | Create project-local or shared custom rules. |
| `rule-review` | Review rule behavior, overlap, documentation, and tests. |
| `feedback` | Prepare a sanitized, paste-ready GitHub issue message. |

## VS Code / Open VSX-Compatible Extension

`asciidoclint` is also available as a VS Code / Open VSX-compatible extension.
Editors compatible with VS Code's diagnostic model can use it to show lint
issues in the editor and Problems panel, including diagnostics mapped back to
included source files.

The extension can import CLI diagnostics written by:

```bash
npx asciidoclint --format json \
  --output-diagnostics .asciidoclint/diagnostics.json \
  index.adoc
```

See [packages/vscode-asciidoclint](packages/vscode-asciidoclint/README.md) for
extension commands and settings.

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
| `ADW01/unknown-waiver-directive` | Waiver directive names should be known |
| `ADW02/missing-waiver-rule-list` | Waiver directives should include a rule list |
| `ADW03/malformed-waiver-rule-list` | Waiver rule lists should use comma-separated rule IDs |
| `ADW04/unknown-waiver-rule-id` | Waiver rule IDs should be defined rules |
| `ADW05/unpaired-waiver-enable-block` | Waiver enable-block directives should have a preceding disable-block |
| `ADW06/unpaired-waiver-disable-block` | Waiver disable-block directives should have a following enable-block |
| `ADW07/mismatched-waiver-block-rule-list` | Waiver block delimiters should use matching rule lists |
| `ADW08/waiver-targets-waiver-rule` | Source waivers should not target ADW waiver diagnostics |

## Tags

Tags group related rules and can be used to enable or disable classes of normal
rules. `ADW##` waiver diagnostics use tags for discovery, but remain always on.

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
| `waiver` | `ADW01`, `ADW02`, `ADW03`, `ADW04`, `ADW05`, `ADW06`, `ADW07`, `ADW08` |
| `whitespace` | `AD034` |
| `references` | `AD023` |
| `links` | `AD027`, `AD031`, `AD042`, `AD044` |
| `structure` | `AD043` |
| `markdown-compatibility` | `AD045` |
| `maintainability` | `AD045` |
| `xref` | `AD026`, `AD042`, `AD044` |

## Documentation

Start with the architecture proposal:

- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Rule architecture](docs/rule-architecture.md)
- [Waivers](docs/waiver.md)
- [Custom rules](docs/custom-rules.md)

Detailed per-rule docs live under [docs/rules](docs/rules/). The CLI exposes
the rule catalog through `--list-rules`, readable rule help through `--explain`,
and structured rule metadata through `--explain <rule> --format json`.
