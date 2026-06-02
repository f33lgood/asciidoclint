# GitHub Feedback Workflow

Use this workflow when the user wants to report a bug, confusing diagnostic,
missing rule, bad fix, waiver issue, extension issue, or documentation problem.
Prepare a paste-ready message for:

```text
https://github.com/f33lgood/asciidoclint/issues
```

Gather what is available without exposing private source content:

```bash
npx asciidoclint --version
node --version
npm --version
```

Also collect:

- operating system;
- command that was run;
- target files or glob shape;
- config file content relevant to the issue;
- whether custom rules are loaded;
- whether waivers are involved;
- whether VS Code-compatible extension diagnostics are involved;
- minimal sanitized AsciiDoc reproduction;
- actual output, preferably from `--format json`;
- expected output or behavior.

Do not include confidential document text, customer names, internal paths,
project names, people, product codenames, bug IDs, or private URLs. Replace them
with neutral placeholders while preserving the syntax shape that reproduces the
issue.

Paste-ready issue shape:

````markdown
## Summary

## Environment

- asciidoclint:
- Node:
- npm:
- OS:

## Command

```bash

```

## Configuration

```yaml

```

## Minimal Repro

```adoc

```

## Actual Result

```text

```

## Expected Result

## Additional Context
````

If evidence is incomplete, clearly mark unknown fields instead of inventing
details.
