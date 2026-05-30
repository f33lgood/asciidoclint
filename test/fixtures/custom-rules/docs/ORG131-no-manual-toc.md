# ORG131 - no-manual-toc

Tags: organization, structure, toc
Severity: info

Description: Manual tables of contents should use generated TOCs.

Necessity: This is an optional organization policy. Asciidoctor supports generated tables of contents with `:toc:` and `toc::[]`, but a hand-written TOC section is still valid AsciiDoc and may be intentional in custom documents.

Rationale: Generated TOCs stay synchronized when sections are added, removed, or renamed. Teams that want all navigation generated from the real section tree can enforce that preference as a custom rule.

Bad:

What's wrong: The `Table of Contents` section is hand-written and contains xrefs. It can become stale when the section tree changes.

```asciidoc
== Table of Contents

xref:intro[]

== Introduction
```

Good:

Expected: The document asks Asciidoctor to generate the TOC from the actual section tree.

```asciidoc
:toc:

== Introduction
```

Implementation note: This experimental fixture source-scans for a `Table of Contents` heading with nearby `xref:` or shorthand `<<...>>` entries. It does not prove the section is stale, and it intentionally remains outside official built-ins.
