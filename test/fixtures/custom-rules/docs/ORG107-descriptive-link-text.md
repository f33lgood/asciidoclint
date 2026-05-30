# ORG107 - descriptive-link-text

Tags: organization, links, accessibility
Severity: info

Description: Links should use descriptive visible text.

Necessity: Descriptive links improve scanning and accessibility. The exact banned phrases and accepted wording are editorial policy, so this belongs in a custom pack.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The link text “click here” describes the action, not the destination.

```asciidoc
link:https://example.com[click here]
```

Good:

Expected: The link text names the destination so it remains understandable out of context.

```asciidoc
link:https://example.com[Example product documentation]
```

Implementation note: This fixture flags a small set of vague labels. Teams can expand the phrase list or make it locale-specific.
