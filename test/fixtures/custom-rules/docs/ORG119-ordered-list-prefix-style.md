# ORG119 - ordered-list-prefix-style

Tags: organization, lists
Severity: info

Description: Ordered lists should use organization-preferred dot markers.

Necessity: Explicit numbering can be intentional, but repeatable dot markers are easier to maintain when list items are inserted or removed.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The list uses hard-coded numbers that can become stale after edits.

```asciidoc
1. First
2. Second
```

Good:

Expected: The list uses repeatable ordered-list markers and lets Asciidoctor generate numbering.

```asciidoc
. First
. Second
```

Implementation note: This fixture flags explicit numbered list markers and prefers repeatable dot markers.
