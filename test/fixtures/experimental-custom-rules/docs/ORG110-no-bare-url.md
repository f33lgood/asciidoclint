# ORG110 - no-bare-url

Tags: organization, links, accessibility
Severity: info

Description: Bare URLs should use explicit link text.

Necessity: AsciiDoc can render bare URLs, but explicit link text improves prose quality and accessibility.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The raw URL exposes implementation detail as the visible label and may wrap poorly.

```asciidoc
See https://example.com/raw
```

Good:

Expected: The link macro keeps the same target while providing meaningful visible text.

```asciidoc
See link:https://example.com/raw[raw example endpoint]
```

Implementation note: This fixture looks for plain `http` or `https` URLs and suggests an explicit AsciiDoc link macro.
