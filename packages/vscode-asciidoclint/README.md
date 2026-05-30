# asciidoclint for VS Code/Cursor

This extension surfaces `asciidoclint` findings as editor diagnostics for
AsciiDoc files.

## Features

- Lints `.adoc`, `.asciidoc`, and `.asc` files.
- Shows `AD###/alias` diagnostics in the Problems panel.
- Reuses `.asciidoclint.yaml` and custom rule modules from the workspace.
- Can hide noisy rule IDs or aliases from editor diagnostics, such as `AD000`.
- Provides commands to lint workspace document roots and apply safe fixes to
  workspace document roots.
- Imports `.asciidoclint/diagnostics.json` when present, so CLI lint results can
  be viewed in VS Code/Cursor.

Opening or clicking a file does not run lint by itself. The extension imports
existing CLI diagnostics on activation and watches the diagnostics artifact.
Editor-side lint runs are triggered by explicit commands, or by save when
`asciidoclint.run` is `onSave`.

The intended model is document-aware: the extension should discover root
AsciiDoc documents, lint each root with its include tree, and map diagnostics
back to the source files. Included fragments should normally be linted through
their owning document context, not as standalone documents.

`asciidoclint: Lint Workspace` uses configured `documents` from
`.asciidoclint.yaml` when present. Otherwise it uses a conventional root such as
`index.adoc`, `master.adoc`, or `README.adoc`. If no conventional root exists
and multiple top-level AsciiDoc files are present, it prompts for the document
root to lint instead of linting every top-level file.

## Commands

- `asciidoclint: Lint Workspace`
- `asciidoclint: Rebuild Document Graph`
- `asciidoclint: Cancel Running Lint`
- `asciidoclint: Import CLI Diagnostics`
- `asciidoclint: Clear Diagnostics`
- `asciidoclint: Fix Workspace (Safe)`

The safe workspace fix command applies only fixes marked safe by the rule
metadata. It does not apply unsafe fixes even if `asciidoclint.unsafeFixes` is
enabled.

## Settings

```json
{
  "asciidoclint.enable": true,
  "asciidoclint.run": "onSave",
  "asciidoclint.defaultScope": "document",
  "asciidoclint.config": ".asciidoclint.yaml",
  "asciidoclint.customRules": [],
  "asciidoclint.hiddenRules": [],
  "asciidoclint.unsafeFixes": false,
  "asciidoclint.followSymlinks": false,
  "asciidoclint.importCliDiagnostics": true
}
```

`customRules` accepts the same local module paths or package names as the CLI.
`hiddenRules` accepts rule IDs or aliases, for example `["AD000"]` or
`["asciidoctor-diagnostic"]`. Hidden rules are still produced by the engine or
imported CLI artifact, but the extension does not publish them to the Problems
panel.

## CLI Diagnostics Import

VS Code/Cursor cannot observe arbitrary external CLI diagnostics unless an
extension imports them. The proposed integration is an opt-in diagnostics file:

```bash
asciidoclint --format json \
  --output-diagnostics .asciidoclint/diagnostics.json \
  docs/index.adoc
```

When `asciidoclint.importCliDiagnostics` is enabled, the extension should watch
that file and populate the Problems panel from it.

## Development

```bash
npm run build:extension
npm test -w vscode-asciidoclint
npm run package -w vscode-asciidoclint
```
