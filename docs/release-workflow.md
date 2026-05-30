# Release Workflow

This document defines the expected release flow for `asciidoclint` as a public
toolchain.

Chronological release order:

1. Study name availability and decide the public identifiers.
2. Register or verify publishing accounts and registry ownership.
3. Release the core npm package.
4. Release the VS Code/Cursor extension that consumes the released core.

The core package is the source of truth for parsing, rules, configuration,
custom-rule loading, fixes, and CLI behavior. The editor extension should stay
thin: it runs the same engine, displays diagnostics, imports CLI diagnostic
artifacts, applies safe fixes, and exposes rule explanations.

## Release Artifacts

| Artifact | Package | Registry | Purpose |
| --- | --- | --- | --- |
| Core package | `asciidoclint` | npm | CLI, API, built-in rules, custom-rule loader, fix engine, and bundled `skills/asciidoclint` skill. |
| Editor extension | `f33lgood.asciidoclint` | VS Code Marketplace and Open VSX | VS Code/Cursor diagnostics, commands, safe fixes, rule explanations, CLI diagnostic import. |

Planned public identifiers:

- Account, publisher, and namespace: `f33lgood`, matching the GitHub account.
- Tool, npm package, extension name, and skill name: `asciidoclint`.

The core package should be installable and usable without the editor extension.
The extension may bundle a fallback engine, but it should prefer the
workspace-local `asciidoclint` package when available so project-specific
configurations and custom rules behave the same in CLI and editor workflows.

## Versioning

Use semantic versioning for both artifacts.

| Change type | Core package version | Extension version |
| --- | --- | --- |
| Rule behavior change that can add or remove findings | Minor, or major if disruptive | Patch or minor, depending on editor changes |
| New built-in rule disabled by default | Minor | Patch |
| New built-in rule enabled by recommended config | Minor, or major if noisy | Patch or minor |
| CLI/API breaking change | Major | Minor or major if extension settings also break |
| Editor-only command, display, or activation change | No core release required unless engine changed | Minor or patch |
| Bug fix with stable behavior | Patch | Patch if extension is affected |

The root `package.json` version is the source of truth. Keep the extension
version aligned by running:

```bash
npm run version:sync
```

Release gates run `npm run version:check` so package versions cannot drift. The
sync logic lives in `scripts/sync-version.ts`; keep release automation in
TypeScript unless a tool explicitly requires shell or JavaScript.

## 1. Name Availability Study

Recheck names immediately before release because registry state can change.
These checks do not reserve names.

Snapshot checked on 2026-05-30 at 20:14 Asia/Shanghai:

| Name | Registry | Check | Result |
| --- | --- | --- | --- |
| `asciidoclint` | npm package | `npm view asciidoclint name version --json` | Returned `E404`; no public package was found. |
| `f33lgood` | npm user account | `GET https://registry.npmjs.org/-/user/org.couchdb.user:f33lgood` | Returned `401`; public unauthenticated check was inconclusive. Confirm during npm signup/login. |
| `f33lgood` | npm organization/scope | `GET https://registry.npmjs.org/-/org/f33lgood` | Returned `404`; no public npm org was found. |
| `f33lgood.asciidoclint` | VS Code Marketplace extension item | `GET https://marketplace.visualstudio.com/items?itemName=f33lgood.asciidoclint` | Returned `404`; no public extension item was found. |
| `f33lgood` | VS Code Marketplace publisher | `GET https://marketplace.visualstudio.com/publishers/f33lgood` | Returned `404`; no public publisher page was found. |
| `f33lgood.asciidoclint` | Open VSX extension item | `GET https://open-vsx.org/api/f33lgood/asciidoclint` | Returned `404`; no public extension item was found. |
| `f33lgood` | Open VSX namespace | `GET https://open-vsx.org/api/f33lgood` | Returned `404`; no public namespace was found. |

Interpretation:

- Use unscoped npm package `asciidoclint` if it is still available at release
  time.
- Register or verify npm account `f33lgood` for release ownership.
- Use VS Code Marketplace publisher `f33lgood`.
- Use Open VSX namespace `f33lgood`.
- Use extension name `asciidoclint`, producing extension ID
  `f33lgood.asciidoclint`.
- Update `packages/vscode-asciidoclint/package.json` before release so
  `publisher` is `f33lgood` and `name` is `asciidoclint`.

## 2. Account Registration

Register accounts before attempting release commands. npm, VS Code Marketplace,
and Open VSX are separate systems.

Required registrations for the planned release:

| Registry | Registration link | Account or owner to create | Planned public identifier | Token for CI |
| --- | --- | --- | --- | --- |
| npm | https://www.npmjs.com/signup | npm account `f33lgood` | package `asciidoclint` | none with trusted publishing; otherwise npm token |
| VS Code Marketplace | https://marketplace.visualstudio.com/manage/publishers/ | Marketplace publisher `f33lgood` | extension `f33lgood.asciidoclint` | `VSCE_PAT` |
| Open VSX | https://open-vsx.org/ | Open VSX namespace `f33lgood` | extension `f33lgood.asciidoclint` | Open VSX token |

### npm

Publishing to npm requires:

- An npm account created at `npmjs.com`.
- Publish access to the package name `asciidoclint`.
- 2FA for publishing, a granular access token configured for publish access, or
  trusted publishing from CI.
- A unique `name` + `version`; npm does not allow republishing the same version
  after it has been published.

Claim the intended package name by publishing it from an account that should own
the project long term, or by publishing under an npm organization/scope. For
GitLab CI/CD, prefer npm trusted publishing or `npm publish --provenance` from a
supported cloud runner so consumers can verify where the package was built.
Local publishing can use `npm login` plus an interactive 2FA prompt, or a
granular token stored outside the repository.

GitHub Actions can be configured as an npm trusted publisher. In that mode, npm
trusts one specific GitHub repository and workflow through OIDC, so the workflow
can publish without a long-lived `NPM_TOKEN`. Use GitHub-hosted runners, grant
the workflow `id-token: write`, and configure the trusted publisher on
`npmjs.com` with the GitHub owner, repository, workflow filename, and optional
environment. npm automatically generates provenance attestations for public
packages published through trusted publishing from GitHub Actions.

Self-hosted GitHub runners are not supported for npm trusted publishing. If the
release job uses self-hosted runners, use a granular npm automation token
instead.

### VS Code Marketplace

Publishing to the VS Code Marketplace requires:

- A Microsoft/Azure DevOps account.
- A Visual Studio Marketplace publisher ID. The planned publisher is
  `f33lgood`.
- A Personal Access Token accepted by `vsce login <publisher>` or provided to CI
  as `VSCE_PAT`.

Create or verify the `f33lgood` Marketplace publisher before release. Update
`packages/vscode-asciidoclint/package.json` before packaging:

```json
{
  "name": "asciidoclint",
  "displayName": "asciidoclint",
  "publisher": "f33lgood"
}
```

### Open VSX

Publishing to Open VSX requires:

- An Open VSX account.
- Access to namespace `f33lgood`.
- An Open VSX access token for CI publishing.

Create or claim the `f33lgood` namespace before release so Cursor,
VSCodium, Theia, and other Open VSX-backed editors can install
`f33lgood.asciidoclint`.

GitHub Actions can automate VS Code Marketplace publishing, but it is not a
trusted-publisher/OIDC flow like npm. The official `vsce` flow still requires a
Marketplace Personal Access Token. Store that token as a GitHub Actions secret
such as `VSCE_PAT`, restrict the workflow with GitHub environments or branch/tag
rules, and rotate the PAT before expiration.

## GitHub Actions Publishing Model

Recommended GitHub Actions model:

| Artifact | GitHub publishing method | Secret required |
| --- | --- | --- |
| npm package | npm trusted publisher with GitHub Actions OIDC | No long-lived npm publish token |
| VS Code Marketplace extension | `vsce publish` from GitHub Actions | `VSCE_PAT` |
| Open VSX extension, if used | `ovsx publish` from GitHub Actions | Open VSX token |

Store Marketplace and Open VSX tokens as GitHub Actions secrets, preferably
environment-scoped secrets. GitHub does not expose secret values publicly and
does not show the full value again after it is saved. Workflow logs mask values
that exactly match configured secrets, but workflows should still avoid printing
environment variables or command traces that could leak credentials.

The npm release workflow should use a GitHub environment such as `npm-release`
if human approval is desired. The Marketplace release workflow should use a
separate environment such as `vscode-marketplace-release` so the PAT is only
available to that gated job.

The three public release jobs can be split into separate workflows or kept as
separate jobs in one workflow. Trigger them from version tags such as `v1.2.3`
or from published GitHub Releases. Tag-triggered workflows are suitable when the
tag is the release authority:

```yaml
on:
  push:
    tags:
      - "v*.*.*"
```

Use separate GitHub environments to gate each target independently:

- `npm-release`
- `vscode-marketplace-release`
- `open-vsx-release`

The extension jobs should depend on the npm job if the extension release must
only happen after the core package is published and install-verified.

Minimal npm trusted-publishing job:

```yaml
name: Publish npm package

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: npm-release
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org
          cache: npm
      - run: npm ci
      - run: npm run release:npm:publish
```

Minimal VS Code Marketplace publishing job:

```yaml
name: Publish VS Code extension

on:
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: vscode-marketplace-release
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run release:vscode:publish
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

## 3. Shared Pre-Release Checks

Run the full local gate before publishing:

```bash
npm run check
```

This currently covers:

- TypeScript build for the core package.
- Unit and integration tests.
- Coverage thresholds.
- VS Code extension build.
- VS Code extension tests.

Before a public release, also inspect:

```bash
git status --short
npm run release:npm:dry-run
npm run release:vscode:package
```

`npm run release:npm:dry-run` should confirm that the published npm package
includes compiled `dist/` files, type declarations, the public
`skills/asciidoclint` skill, and no private test input.

The generated `.vsix` should be installed locally in Cursor or VS Code and
smoke-tested before marketplace publication.

## 4. Core npm Package Release

Release the npm package before the editor extension.

1. Confirm the repository is ready for a public release.
   - No private paths, private project names, or sensitive fixture content.
   - No ancestor-project naming in public docs or reports.
   - `README.md`, `docs/architecture.md`, and rule docs describe public behavior.
2. Confirm package metadata.
   - `package.json` has the intended `name`, `version`, `description`, `license`,
     `bin`, `exports`, `files` if used, and `engines`.
   - CLI entry point is executable after build.
   - API exports are stable enough for extension and custom-rule authors.
3. Build and test.

   ```bash
   npm run check
   npm run release:npm:dry-run
   ```

4. Publish a dry-run candidate if needed.

   ```bash
   npm publish --dry-run
   ```

5. Publish the package.

   ```bash
   npm run release:npm:publish
   ```

   From a supported CI runner configured for provenance:

   ```bash
   npm run release:npm:publish:provenance
   ```

6. Verify installation from npm in a clean temporary directory.

   ```bash
   npm init -y
   npm install asciidoclint
   npx asciidoclint --version
   npx asciidoclint --list-rules
   ```

Do not publish the extension before this verification passes.

## 5. VS Code/Cursor Extension Release

Release the editor extension after the npm package is available.

1. Confirm extension metadata in `packages/vscode-asciidoclint/package.json`.
   - `displayName` is the gallery name users see.
   - `publisher` is the marketplace publisher ID.
   - `categories`, `description`, activation events, commands, and settings are
     current.
2. Confirm the extension dependency strategy.
   - Prefer workspace-local `asciidoclint` when present.
   - Fall back to the bundled engine when the workspace does not install it.
   - Custom rule paths resolve relative to the workspace.
3. Build and package.

   ```bash
   npm run release:vscode:package
   ```

4. Install the generated `.vsix` locally.

   ```bash
   code --install-extension packages/vscode-asciidoclint/asciidoclint-0.5.0.vsix --force
   ```

   For Cursor:

   ```bash
   cursor --install-extension packages/vscode-asciidoclint/asciidoclint-0.5.0.vsix --force
   ```

5. Smoke-test editor behavior in a separate workspace.
   - Open an `.adoc` file.
   - Run `asciidoclint: Lint Workspace`.
   - Run `asciidoclint: Fix Workspace (Safe)` on a disposable workspace fixture.
   - Run `asciidoclint: Import CLI Diagnostics` after generating
     `.asciidoclint/diagnostics.json`.
   - Confirm opening, focusing, and typing in files does not eagerly re-lint.
   - Confirm saving an AsciiDoc file triggers lint only when
     `asciidoclint.run` is `onSave`.

6. Publish to the VS Code Marketplace.

   ```bash
   npm run release:vscode:publish
   ```

7. Optionally publish to Open VSX for broader editor compatibility.

   ```bash
   npm run release:open-vsx:publish
   ```

Cursor can install VS Code Marketplace extensions and local `.vsix` files. Open
VSX is useful for editors that do not use the Microsoft marketplace.

## Custom-Rule Compatibility

Custom-rule compatibility is part of the release contract.

Before release, verify:

- Custom rules can be loaded from config without modifying `asciidoclint`
  source.
- Duplicate IDs and aliases are rejected across built-in and custom rules.
- A custom rule can use either JavaScript output or TypeScript source compiled
  by the owning project.
- Rule docs can be associated with custom rules so CLI, editor, humans, and AI
  tooling can retrieve descriptions, rationale, bad examples, and good
  examples.
- Experimental `ORG###` fixture rules remain clearly documented as testing and
  reference examples, not official extensions.

## CLI Diagnostic Artifact Compatibility

The CLI and editor share diagnostic artifacts through:

```text
.asciidoclint/diagnostics.json
```

For a release, preserve backward compatibility for this artifact when practical.
If the schema must change, add a schema version and make the extension ignore or
explain unsupported artifacts instead of silently displaying stale diagnostics.

The artifact fingerprint should include the lint target, relevant source files,
tool version, configuration, and custom-rule inputs. This allows the editor to
detect when imported CLI diagnostics are stale.

## Release Branch Checklist

Use this checklist for each release branch or release candidate:

- [ ] Name availability rechecked and selected identifiers recorded.
- [ ] npm account, organization/scope if used, 2FA/token/trusted publishing, and
      publish access are ready.
- [ ] VS Code Marketplace publisher and `VSCE_PAT` or `vsce login` are ready.
- [ ] Public docs contain no private project names or sensitive paths.
- [ ] Rule docs exist for every built-in `AD###` rule.
- [ ] Experimental custom rules have docs that state necessity, rationale, bad
      example behavior, and expected good example behavior.
- [ ] `docs/reports/` reports are regenerated and consistent with tests.
- [ ] `npm run check` passes.
- [ ] `npm run release:npm:dry-run` contains only intended files.
- [ ] Clean-install npm smoke test passes.
- [ ] `.vsix` local install smoke test passes in VS Code or Cursor.
- [ ] Core package is published before the extension.
- [ ] Extension release notes mention the tested core engine version.

## Rollback

If the npm package release is bad:

1. Publish a patch version with the fix.
2. Deprecate the broken version with an explanation.

```bash
npm deprecate asciidoclint@<version> "Use asciidoclint@<fixed-version>."
```

Avoid unpublishing unless the package contains credentials, private content, or
another serious compliance issue.

If the editor extension release is bad:

1. Publish a patch version with the fix.
2. If needed, unpublish or hide the broken extension version through the
   marketplace publisher portal.

The extension should fail closed when it cannot run the engine: show a clear
error message and avoid clearing imported diagnostics unless a successful lint
result replaces them.
