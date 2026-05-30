# ORG120 - no-space-in-link-text

Tags: organization, links, whitespace
Severity: info

Description: Link text should not start or end with spaces.

Necessity: Leading or trailing spaces in visible link text usually render but create awkward labels and are hard to notice in review.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The link label includes spaces just inside the brackets.

```asciidoc
link:https://example.com[ Example ]
```

Good:

Expected: The link label contains only the intended visible text.

```asciidoc
link:https://example.com[Example]
```

Implementation note: This fixture flags leading or trailing spaces inside AsciiDoc link and xref text.
