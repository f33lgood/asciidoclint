# ORG102 - portable-table-formatting

Tags: organization, table
Severity: info

Description: Tables should declare organization-preferred formatting attributes.

Necessity: Table formatting defaults vary by backend and publishing pipeline. A team may require explicit attributes for portable output, but that preference should not be a built-in syntax rule.

Rationale: This fixture demonstrates how an organization can express the policy as a loadable custom rule without modifying `asciidoclint` built-ins.

Bad:

What's wrong: The table renders, but it does not declare the organization-required `options="header"` attribute.

```asciidoc
|===
| Name | Value
|===
```

Good:

Expected: The table declares the expected formatting attribute before the table delimiter.

```asciidoc
[options="header"]
|===
| Name | Value
|===
```

Implementation note: This fixture intentionally checks for one simple preferred attribute to show how a team can encode its own portable-output policy.
