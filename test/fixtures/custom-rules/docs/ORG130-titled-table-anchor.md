# ORG130 - titled-table-anchor

Tags: organization, table, references
Severity: info

Description: Titled tables should have explicit anchors.

Necessity: This is an optional organization policy. Asciidoctor renders titled tables without explicit IDs, and no ID is needed unless the table must be a cross-reference target.

Rationale: Some teams prefer every titled table to be referenceable for review comments, generated lists, and future xrefs. That preference is useful as a custom rule, but it is too broad for an official built-in because many titled tables are never referenced.

Bad:

What's wrong: The table has a title, but no explicit ID. This is only a problem for teams that require every titled table to be referenceable.

```asciidoc
.Registers
|===
| Name | Value
|===
```

Good:

Expected: The titled table has an explicit ID that Asciidoctor can use as an xref target.

```asciidoc
[#tab-registers]
.Registers
|===
| Name | Value
|===
```

Implementation note: This fixture uses the Asciidoctor-derived table block model and accepts `[[id]]`, `[#id]`, `[id=id]`, and table attribute-list `id=...` forms recognized by Asciidoctor.
