# ORG123 - no-unused-anchor

Tags: organization, links, references
Severity: info

Description: Explicit anchors should be referenced.

Necessity: Unused anchors can be valid, but in tightly reviewed documents they often indicate stale IDs or abandoned cross-reference plans. This is a review policy, not a rendering requirement.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The explicit anchor `unused` is declared, but no local xref points to it, so the anchor may be stale or unnecessary.

```asciidoc
[[unused]]
== Section
```

Good:

Expected: The explicit anchor `used` is referenced by `xref:used[]`, proving why the anchor exists.

```asciidoc
[[used]]
== Section

See xref:used[].
```

Implementation note: This fixture scans explicit anchors and local references within the same file. A production rule may need project-wide references.
