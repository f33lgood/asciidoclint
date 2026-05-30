# ORG116 - commands-show-output

Tags: organization, code
Severity: info

Description: Shell prompts should be avoided unless command output is shown.

Necessity: Prompt markers are a command-transcript style choice. Some teams omit them to make commands easier to copy.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The command includes a `$` prompt marker even though the snippet is meant to show the command itself.

```asciidoc
$ asciidoclint docs/**/*.adoc
```

Good:

Expected: The command is shown without a prompt marker, making it directly copyable.

```asciidoc
asciidoclint docs/**/*.adoc
```

Implementation note: This fixture flags shell prompt markers in command examples; production policies may allow prompts when output is shown.
