# Custom Rules

Use custom rules for project, organization, template, or style policy that
should not become a generic `asciidoclint` built-in rule.

## Create a Rule

`init-rule` scaffolds a local custom-rule package. It does not change
`asciidoclint` source.

```bash
npx asciidoclint init-rule --tag organization --id ORG001 --alias no-todo
```

- `--tag` is a grouping tag stored in rule metadata, such as `organization`,
  `product-docs`, or `migration`.
- `--id` is the stable rule ID. Use a team-owned prefix such as `ORG001`.
- `--alias` is the readable rule name.
- `--directory` chooses the package directory. The default is `lint-rules`.
- `--pack` is accepted as a deprecated alias for `--tag`.

The command is a convenience, not a different rule format. A person or AI agent
still fills in the rule implementation and docs, but the scaffold creates the
files in the expected places and pre-populates `id`, `alias`, and `tag` in both
the executable source and the documentation stub.

The generated layout is:

```text
lint-rules/
  src/ORG001-no-todo.js
  src/index.js
  docs/ORG001-no-todo.md
  fixtures/ORG001-no-todo/bad.adoc
  fixtures/ORG001-no-todo/good.adoc
  ORG001-no-todo.test.js
```

Each rule has executable source under `src/` and matching human/AI-readable
documentation under `docs/`. `src/index.js` exports the local rule pack, so
users can load the package directory for several rules.

## Load Rules

Use project config for repeatable project behavior:

```yaml
# .asciidoclint/config.yaml
extends:
  - asciidoclint:recommended

customRules:
  - ./lint-rules
  - "@example/asciidoclint-rule-pack"
```

Use `--custom-rule` for one-off runs. The option takes one rule package folder
or published package name. The remaining positional arguments are lint targets:

```bash
npx asciidoclint --custom-rule ./lint-rules index.adoc
npx asciidoclint --custom-rule ./rules-a --custom-rule ./rules-b index.adoc
```

For a local rule package folder, `asciidoclint` looks for a package entry in
this order:

- `package.json` `exports`, `module`, or `main`;
- `dist/index.js` or `dist/index.mjs`;
- `src/index.js`, `src/index.mjs`, `src/index.ts`, or `src/index.mts`;
- `index.js`, `index.mjs`, or `index.ts`.

The package entry may export:

- `default`: one rule or an array of rules;
- `rule`: one rule;
- `rules`: an array of rules.

Local paths in `.asciidoclint/config.yaml` are interpreted from the project
root. For example, `./lint-rules` means `<project>/lint-rules`, not
`<project>/.asciidoclint/lint-rules`. Local paths passed to `--custom-rule`
are interpreted from the current working directory.

## Company-Wide Rules

Use global user config when a company wants custom rules available in any
working directory without adding config to every project:

```yaml
# ~/.asciidoclint/config.yaml
customRules:
  - "@company/asciidoclint-rules"
```

Project config remains available when a repository needs explicit, reviewable
policy:

```yaml
# .asciidoclint/config.yaml
extends:
  - asciidoclint:recommended

customRules:
  - ./lint-rules
```

The final config is merged in this order:

1. built-in defaults;
2. global user config from `~/.asciidoclint/config.yaml`;
3. project config from `.asciidoclint/config.yaml`;
4. CLI flags such as `--custom-rule`.

Use `--no-global-config` to ignore the global layer for a run. Use
`--print-config` to inspect the merged config and its source files. See
`docs/configuration.md` for available `extends` presets and field meanings.

## Validate Rules

Check loaded rule metadata and registry conflicts:

```bash
npx asciidoclint --custom-rule ./lint-rules --list-rules
npx asciidoclint --custom-rule ./lint-rules --validate-rules
```

Then run lint:

```bash
npx asciidoclint --custom-rule ./lint-rules index.adoc
```

## Share Rules

Use existing package infrastructure instead of a new `asciidoclint` registry.
For public sharing, publish an npm package such as
`@my-org/asciidoclint-rule-pack` with its entry point exporting `rules`. For
private sharing, use a private npm registry, GitHub Packages, or a Git URL
dependency in the consuming project.

Recommended package shape:

```text
asciidoclint-rule-pack/
  package.json
  src/index.js
  src/ORG001-no-todo.js
  docs/ORG001-no-todo.md
  fixtures/ORG001-no-todo/bad.adoc
  fixtures/ORG001-no-todo/good.adoc
  ORG001-no-todo.test.js
```

Consumers load a shared package by name:

```yaml
customRules:
  - "@my-org/asciidoclint-rule-pack"
```

The experimental rules under `test/fixtures/experimental-custom-rules/` are test
fixtures only. They are not a recommended custom rule pack for users.
