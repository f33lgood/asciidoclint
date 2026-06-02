# ORG115 - line-length

Tags: organization, formatting
Severity: info

Description: Lines should stay within the organization line-length limit.

Necessity: Line length is a source readability convention. It should be configurable and team-owned rather than a generic AsciiDoc rule.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The line exceeds the example 100-character source-width limit.

```asciidoc
This is an intentionally long line that exceeds the organization's example source-width limit for maintained documents.
```

Good:

Expected: The line is short enough to fit the configured source-width limit.

```asciidoc
This is a shorter line.
```

Implementation note: This fixture reports lines longer than 100 characters.
