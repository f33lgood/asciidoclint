# ORG114 - no-multiple-blank-lines

Tags: organization, whitespace
Severity: info

Description: Documents should not contain multiple consecutive blank lines.

Necessity: Extra blank lines usually do not change rendering, but they create noisy diffs and inconsistent source layout.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: There are two blank lines between the document title and section heading.

```asciidoc
= Title


== Section
```

Good:

Expected: There is one blank line, which is enough to separate the blocks.

```asciidoc
= Title

== Section
```

Implementation note: This fixture reports the second and later blank lines in a consecutive blank-line run.
