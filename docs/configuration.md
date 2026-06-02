# Configuration

`asciidoclint` builds one final in-memory config before loading rules and
linting documents.

## Config Sources

Config is merged in this order:

1. built-in defaults;
2. global user config from `~/.asciidoclint/config.yaml`;
3. project config from `.asciidoclint/config.yaml`, or an explicit
   `--config <file>`;
4. CLI flags such as `--custom-rule`.

Use global config for defaults that should apply in many working directories:

```yaml
# ~/.asciidoclint/config.yaml
customRules:
  - "@example/asciidoclint-rules"
```

Use project config for repository policy that should be reviewed and used by
CI:

```yaml
# .asciidoclint/config.yaml
extends:
  - asciidoclint:recommended

customRules:
  - ./lint-rules

ignores:
  - build/**
```

Run without the global layer when you need reproducible project-only behavior:

```bash
npx asciidoclint --no-global-config index.adoc
```

Inspect the merged config and source files:

```bash
npx asciidoclint --print-config index.adoc
```

## Fields

| Field | Purpose |
|---|---|
| `extends` | Select built-in baseline rule presets. |
| `customRules` | Load local or shared custom-rule packages. |
| `rules` | Enable, disable, or change severity for specific rules. |
| `ignores` | Exclude generated, vendored, or build output paths. |
| `documents` | Optional project entry documents for workspace/editor traversal. |

`editor` is not part of `.asciidoclint/config.yaml`. Editor behavior belongs in
the VS Code-compatible extension settings. `baseDir` is internal path-resolution
state and is not a user config field.

## Presets

Available built-in presets:

| Preset | Meaning |
|---|---|
| `asciidoclint:recommended` | Default recommended built-in rule set. In the current implementation this enables all built-in rules. |
| `asciidoclint:all` | Enables all built-in rules. Currently equivalent to `asciidoclint:recommended`. |
| `asciidoclint:core` | Enables built-in rules tagged `core`. |
| `asciidoclint:dependencies` | Enables built-in rules tagged `dependencies`. |

Use `asciidoclint:recommended` for normal projects:

```yaml
extends:
  - asciidoclint:recommended
```

Use narrower presets only when a project wants a smaller starting point:

```yaml
extends:
  - asciidoclint:dependencies
```

## Rule Overrides

Rules may be referenced by ID or alias:

```yaml
rules:
  AD024:
    severity: error
  heading-level-progression: false
  ORG001:
    severity: warning
```

Use one reference form per rule in a project to avoid confusing reviews.

## Editor Settings

Editor behavior is configured in VS Code-compatible settings, not in
`.asciidoclint/config.yaml`.

Workspace `.vscode/settings.json` example:

```json
{
  "asciidoclint.enable": true,
  "asciidoclint.run": "onSave",
  "asciidoclint.config": ".asciidoclint/config.yaml",
  "asciidoclint.customRules": [],
  "asciidoclint.hiddenRules": [],
  "asciidoclint.showWaived": false,
  "asciidoclint.unsafeFixes": false,
  "asciidoclint.importCliDiagnostics": true
}
```

See `packages/vscode-asciidoclint/README.md` for extension behavior and
settings.
