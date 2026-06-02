# ORG113 - unordered-list-indent-width

Tags: organization, lists, whitespace
Severity: info

Description: Nested unordered lists should use two-space indentation.

Necessity: Indent width is a source style preference. Teams may want a fixed width even when AsciiDoc can render the list.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The child item is indented by three spaces, violating the example two-space convention.

```asciidoc
* Item
   * Child
```

Good:

Expected: The child item is indented by two spaces, matching the organization convention.

```asciidoc
* Item
  * Child
```

Implementation note: This fixture expects nested unordered-list indentation to be a multiple of two spaces.
