# ORG127 - no-fake-definition-list

Tags: organization, conversion, lists
Severity: info

Description: Definition-like paragraphs should use AsciiDoc definition-list syntax.

Necessity: Converted documents sometimes contain paragraphs that visually imitate definition lists. They can render as plain paragraphs instead of semantic definition lists, which weakens structure and makes later formatting harder.

Rationale: This fixture demonstrates an experimental custom rule for a conversion-cleanup policy. It is not an official extension pack rule; it exists to prove custom rules can express this class of AsciiDoc policy.

Bad:

What's wrong: The line looks like a term and definition, but it is only a paragraph with a colon.

```asciidoc
Term: Definition text.
```

Good:

Expected: The text uses AsciiDoc definition-list syntax so the term and definition are represented structurally.

```asciidoc
Term:: Definition text.
```

Implementation note: This fixture flags short capitalized `Term: value` lines that do not use `::`. A production rule should tune this pattern for the target document set to avoid false positives.
