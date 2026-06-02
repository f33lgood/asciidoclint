# ORG106 - source-language-required

Tags: organization, code
Severity: info

Description: Source blocks should declare a language in this organization.

Necessity: Language metadata improves highlighting and review, but it is not required for AsciiDoc to render a source block.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The `[source]` block renders, but it provides no language for syntax highlighting or downstream tooling.

```asciidoc
[source]
----
echo hi
----
```

Good:

Expected: The block declares `bash`, giving renderers and tools a stable language hint.

```asciidoc
[source,bash]
----
echo hi
----
```

Implementation note: This simple fixture catches `[source]`; production rules could also inspect parsed source blocks and accepted language names.
