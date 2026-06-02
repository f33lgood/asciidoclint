# Rule Architecture

Rules are plain JavaScript or TypeScript objects loaded by the shared
`asciidoclint` rule registry. Built-in rules live in the main package; project,
organization, or template policy belongs in custom-rule packages.

## Rule API

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
```

Rule IDs are stable machine identifiers. Aliases are readable names. A rule can
have at most one alias, and neither IDs nor aliases may collide across built-in
and custom rules.

Rule authors should pick the narrowest parser surface:

| Parser | Use |
|---|---|
| `text` | Line-oriented or pattern-oriented rules. |
| `document` | Section, block, table, image, and normalized document rules. |
| `dependency` | Include, image, xref, attachment, and path rules. |
| `project` | Rules that need more than one document graph. |

## Rule Documentation

Every built-in and publishable custom rule should have metadata that can be
shown by CLI, editor, and AI-agent workflows:

- `description`;
- `docs.summary`;
- `docs.rationale`;
- `docs.badExamples`;
- `docs.goodExamples`;
- `docs.fixability`;
- `docs.fixHelper` when deterministic fixing is unavailable or incomplete.

Built-in rule docs live under `docs/rules/`. Custom-rule packages should keep
matching human/AI-readable docs under their own `docs/` folder.

## Rule Packs

Built-ins use the reserved `AD###` namespace. Custom packs should use an
organization-owned prefix such as `ORG###`.

Built-in pack tags:

| Tag | Purpose |
|---|---|
| `core` | Common syntax-adjacent structure checks. |
| `dependencies` | Include, image, xref, attachment, and path checks. |
| `accessibility` | Low-risk accessibility checks. |
| `policy` | Generic document-policy checks. |
| `cleanup` | Conversion artifact and whitespace cleanup checks. |

Do not add a built-in prefix for every new idea. Company, product, or
template-specific behavior should remain in custom-rule packages.

## Custom Rules

Custom rules must be loadable without modifying `asciidoclint` source.
Supported references include:

- local custom-rule package folders;
- npm packages or package subpaths;
- direct JavaScript/TypeScript modules for debugging.

Recommended local package shape:

```text
lint-rules/
  src/index.js
  src/ORG001-no-todo.js
  docs/ORG001-no-todo.md
  fixtures/ORG001-no-todo/bad.adoc
  fixtures/ORG001-no-todo/good.adoc
  ORG001-no-todo.test.js
```

`init-rule` is an optional scaffold helper for this package contract. It is not
a separate rule format.

See `docs/custom-rules.md` for user-facing custom-rule workflows.
