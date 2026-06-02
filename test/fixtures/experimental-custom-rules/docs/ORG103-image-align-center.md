# ORG103 - image-align-center

Tags: organization, image
Severity: info

Description: Images should use organization-preferred center alignment.

Necessity: Image alignment is presentation policy. Images render without an alignment attribute, but teams may require a consistent layout in generated output.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The image renders, but it omits the organization-preferred `align="center"` attribute.

```asciidoc
image::diagram.png[Diagram]
```

Good:

Expected: The image macro keeps the same target and alt text while adding the expected center alignment.

```asciidoc
image::diagram.png[Diagram,align="center"]
```

Implementation note: This rule scans block image macros and reports any image without an `align=center` attribute.
