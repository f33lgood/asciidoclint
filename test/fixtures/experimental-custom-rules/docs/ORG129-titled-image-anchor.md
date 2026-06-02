# ORG129 - titled-image-anchor

Tags: organization, image, references
Severity: info

Description: Titled images should have explicit anchors.

Necessity: This is an optional organization policy. Asciidoctor renders titled images without explicit IDs, and no ID is needed unless the image must be a cross-reference target.

Rationale: Some teams prefer every titled figure to be referenceable for review comments, generated lists, and future xrefs. That preference is useful as a custom rule, but it is too broad for an official built-in because many titled images are never referenced.

Bad:

What's wrong: The image has a title, but no explicit ID. This is only a problem for teams that require every titled image to be referenceable.

```asciidoc
.Architecture
image::architecture.png[Architecture]
```

Good:

Expected: The titled image has an explicit ID that Asciidoctor can use as an xref target.

```asciidoc
[#fig-architecture]
.Architecture
image::architecture.png[Architecture]
```

Implementation note: This fixture uses the Asciidoctor-derived image block model and accepts `[[id]]`, `[#id]`, `[id=id]`, and image macro `id=...` forms recognized by Asciidoctor.
