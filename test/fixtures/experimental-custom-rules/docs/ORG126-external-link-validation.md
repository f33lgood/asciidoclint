# ORG126 - external-link-validation

Tags: organization, links
Severity: warning

Description: External links should have valid offline URL shape and explicit descriptive text.

Necessity: External links can render while still being poor publication targets: malformed URLs confuse readers, unknown internal short hostnames often indicate typos, and omitted descriptive text leaves readers with a raw URL label. This is environment-specific because valid internal hosts and network policy vary by organization.

Rationale: This fixture models offline external-link validation as a loadable custom rule because the useful behavior is policy-bound and offline. It does not perform network connectivity checks.

Bad:

What's wrong: `http://tracker/ISSUE-123[]` uses an unknown short hostname and omits explicit descriptive link text.

```asciidoc
See http://tracker/ISSUE-123[].
```

Good:

Expected: The link uses a known internal hostname and descriptive visible text.

```asciidoc
See http://tracker.internal/ISSUE-123[Issue ISSUE-123].
```

Implementation note: This fixture scans HTTP/HTTPS links, validates dotted public hostnames or a small internal-host allowlist, and reports missing `[...]` text. A production rule should make allowed internal hosts configurable and may add optional asynchronous network probing in CI.
