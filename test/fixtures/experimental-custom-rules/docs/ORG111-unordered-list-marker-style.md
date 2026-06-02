# ORG111 - unordered-list-marker-style

Tags: organization, lists
Severity: info

Description: Unordered lists should use the organization-preferred marker.

Necessity: AsciiDoc supports multiple unordered markers. A style guide can prefer one marker for consistency, but the choice is not a generic syntax rule.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The list item uses `-`, which is not this fixture pack's preferred unordered-list marker.

```asciidoc
- Item
```

Good:

Expected: The list item uses `*`, the preferred marker for this organization.

```asciidoc
* Item
```

Implementation note: This fixture flags `-` and `+` unordered-list markers and prefers `*`.
