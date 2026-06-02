# ORG122 - single-trailing-newline

Tags: organization, whitespace
Severity: info

Description: Files should end with a single newline.

Necessity: Final newline policy is a source-formatting convention that improves diffs and POSIX tool compatibility but does not affect AsciiDoc rendering.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The source ends immediately after the title text, so there is no final newline.

```asciidoc
= Title
```

Good:

Expected: The source ends with exactly one final newline after the title.

```asciidoc
= Title

```

Implementation note: This fixture checks whether the parsed file ends with a trailing empty line, which indicates a final newline in the source file.
