# Rule Creation Workflow

Use this workflow when creating either a project-local custom rule or an
`asciidoclint` built-in rule. If the task is to accept, reject, redesign, or
reclassify a rule, review it first with `rule-review.md`.

Default placement:

- End-user or organization policy rules should be custom rules.
- Built-ins should be reserved for broad AsciiDoc syntax, structure, rendering,
  dependency, accessibility, or conversion-cleanup value.
- Waiver diagnostics use the reserved `ADW##` namespace and still need rule
  metadata, docs, examples, and tests.

For custom rules, scaffold with:

```bash
npx asciidoclint init-rule --tag organization --id ORG001 --alias no-todo
npx asciidoclint init-rule --tag organization --id ORG002 --alias section-policy --directory ./lint-rules
```

`--tag` is a grouping tag stored in rule metadata. `--pack` remains accepted as
a deprecated alias for `--tag`.

For built-in repository work:

- built-ins live in `src/rules/AD###.ts`;
- waiver diagnostics live in `src/rules/ADW##.ts`;
- built-in docs live in `docs/rules/AD###.md` or `docs/rules/ADW##.md`;
- update `docs/rules/rule-necessity.md`;
- custom example fixtures live in `test/fixtures/experimental-custom-rules/src/ORG###-alias.ts`.
- generated project-local rules live under `<directory>/src/`, with matching
  docs under `<directory>/docs/` and examples under `<directory>/fixtures/`.
- generated `<directory>/src/index.js` exports the rule pack so users can load
  one local package module instead of listing every rule file.

Use one rule per file. Export one plain rule object with `id`, one `alias`,
`description`, `tags`, `parser`, `docs.summary`, `docs.rationale`,
`docs.fixability`, `docs.fixHelper`, and the rule function.

Use a team-owned uppercase prefix such as `ORG###` for custom rules. Do not use
the built-in `AD###` namespace or waiver diagnostic `ADW##` namespace for
custom rules.

Decide and document:

- purpose and authority for the rule;
- severity: `error`, `warning`, or `info`;
- fixability: `safe`, `unsafe`, or `no`;
- parser: `text`, `document`, `dependency`, or `project`;
- one bad example and one good example;
- default `fixHelper` for humans and AI agents;
- configuration schema, if the rule accepts options.

Parser guidance:

- `text`: line-oriented checks where source spelling matters.
- `document`: sections, blocks, headings, attributes, and normalized structure.
- `dependency`: local includes, images, xrefs, links, and target resolution.
- `project`: cross-file policy that needs project context.

Prefer Asciidoctor-owned parser facts over source scanning when available. For
built-ins, extend the normalized model instead of duplicating parser logic when
that is practical.

Severity and fixability:

- `error`: broken rendering, missing local dependency, invalid structure, output
  that cannot be trusted, or release-gating custom policy.
- `warning`: likely wrong output, accessibility issue, fragile structure,
  conversion residue, or Asciidoctor-documented recommendation.
- `info`: maintainability, publishability, migration hint, or organization
  policy that Asciidoctor accepts.
- `safe` fix: deterministic edit that preserves author intent.
- `unsafe` fix: plausible edit that may choose between valid author intents,
  alter structure, or require project context.
- `no` fix: author judgment, missing content/assets, semantic naming, or broad
  restructuring is required.

If a rule is fixable, findings must carry fix edits and tests must prove fix
application. `docs.fixHelper` is required for every rule. Per-finding
`fixHelper` should only add local computed guidance.

Per-rule docs for built-ins and publishable custom rules should include:

- title with rule ID and alias;
- tags, severity, and fixability;
- description;
- necessity;
- rationale;
- fix helper;
- bad example with "What's wrong";
- good example with "Expected";
- implementation note with parser surface, configuration, fix behavior, and
  known limits.

Common custom-rule candidates:

- required sections or document attributes;
- forbidden TODO markers in release-bound documents;
- organization-specific link, xref, or include policy;
- template conformance;
- required front matter or metadata;
- migration or conversion residue specific to a source corpus.

Tests and examples:

- Test bad and good examples from docs.
- Test important edge cases and documented exceptions.
- Test protected contexts such as comments, source blocks, tables, or included
  files when relevant.
- For source scanners, tests must enumerate supported syntax variants and
  documented exclusions.
- Keep examples sanitized. This is a hard gate for built-ins, custom rules,
  docs, tests, fixtures, prompt text, and generated examples. Do not commit
  customer, employer, organization, product, internal path, private URL, person,
  username, email, project, bug, register/interface, device, or confidential
  names. Use neutral placeholders such as `Product`, `Component`, `Register`,
  `example.internal`, `ISSUE-123`, or `architecture.png` only when the syntax
  shape matters.
- Keep `docs.summary`, `docs.rationale`, `docs.fixHelper`, diagnostic messages,
  snapshots, and fixture filenames generic. Do not encode the source corpus,
  customer, product, project, or internal policy name.
- When a rule is discovered from a real document, first reduce it to a minimal
  neutral reproduction. Preserve only the syntax pattern needed to trigger or
  suppress the finding.

After creating or editing a custom rule, validate:

```bash
npx asciidoclint --validate-rules
npx asciidoclint --list-rules --format json
npx asciidoclint --custom-rule ./lint-rules --list-rules
npx asciidoclint --custom-rule ./lint-rules index.adoc
```

For user-facing custom rule usage, prefer the guide in `docs/custom-rules.md`.

For repository built-in work, run targeted tests first when available, then:

```bash
npm run build
npm test
```

Run `npm run check` when the change affects shared behavior, generated reports,
the extension, or release readiness.
