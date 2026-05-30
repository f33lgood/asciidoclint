# ORG104 - no-html-entities

Tags: organization, conversion
Severity: warning

Description: Avoid raw HTML entities in organization documentation.

Necessity: HTML entities are often conversion residue. Some may render acceptably, but teams can prefer plain characters or native AsciiDoc escaping for maintainability.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The text contains `&nbsp;`, which hides a nonbreaking-space decision in source and can create inconsistent output.

```asciidoc
Text&nbsp;with entity.
```

Good:

Expected: The text uses a normal space, making the intended prose visible in source.

```asciidoc
Text with entity.
```

Implementation note: This fixture represents HTML-entity cleanup as custom policy because entity preferences depend on source and output needs.
