# Release Workflow

This document defines the expected release flow for `asciidoclint` as a public
toolchain.

Chronological release order:

1. Study name availability and decide the public identifiers.
2. Register or verify publishing accounts and registry ownership.
3. Release the core npm package.
4. Release the VS Code-compatible extension that consumes the released core.

The core package is the source of truth for parsing, rules, configuration,
custom-rule loading, fixes, and CLI behavior. The editor extension should stay
thin: it runs the same engine, displays diagnostics, imports CLI diagnostic
artifacts, applies safe fixes, and exposes rule explanations.

## Release Artifacts

| Artifact | Package | Registry | Purpose |
| --- | --- | --- | --- |
| Core package | `asciidoclint` | npm | CLI, API, built-in rules, custom-rule loader, fix engine, and bundled `skills/asciidoclint` skill. |
| Editor extension | `f33lgood.asciidoclint` | VS Code Marketplace and Open VSX | VS Code-compatible diagnostics, commands, safe fixes, rule explanations, CLI diagnostic import. |

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
| VS Code Marketplace | https://marketplace.visualstudio.com/manage/publishers/ | Marketplace publisher `f33lgood` | extension `f33lgood.asciidoclint` | Manual `.vsix` upload first; optional `VSCE_PAT` later |
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

- A Microsoft account that can manage the Marketplace publisher.
- A Visual Studio Marketplace publisher ID. The planned publisher is
  `f33lgood`.
- For manual publishing: a packaged `.vsix` uploaded through the Marketplace
  publisher page.
- For CI publishing only: a Personal Access Token accepted by `vsce`, provided
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

Create or claim the `f33lgood` namespace before release so Open VSX-backed
editors can install `f33lgood.asciidoclint`.

Prefer manual VS Code Marketplace upload for the first release. `VSCE_PAT`
automation is optional because it depends on Azure DevOps PAT creation for a
Marketplace-capable account; new Azure DevOps organization registration may
also require linking an Azure subscription. Keep the Marketplace automation path
documented, but do not block the first release on it.

## 3. GitHub Actions Setup

Goal:

| Artifact | GitHub publishing method | Secret required |
| --- | --- | --- |
| npm package | npm trusted publisher with GitHub Actions OIDC after the first publish | `NPM_TOKEN` for first publish only |
| VS Code Marketplace extension | Manual `.vsix` upload first; optional `vsce publish` later | None for manual upload; optional `VSCE_PAT` |
| Open VSX extension | `ovsx publish` from GitHub Actions | `OVSX_PAT` |

### 3.1 Create GitHub Environments

1. Open `https://github.com/f33lgood/asciidoclint`.
2. Go to **Settings**.
3. Go to **Environments** in the left sidebar.
4. Click **New environment**.
5. Create these environments:
   - `npm-release`
   - `open-vsx-release`
6. Optional, only when enabling VS Code Marketplace automation:
   - `vscode-marketplace-release`

For each environment, configure **Deployment branches and tags**:

1. Prefer **Selected branches and tags**.
2. Add tag rule `v*.*.*`.
3. Add branch rule `main`.
4. Leave **Environment variables** empty.

If GitHub shows **Required reviewers**, add the maintainer account. If that
control is not visible, skip it.

The workflow also checks that the release tag is reachable from `origin/main`:

```bash
git fetch origin main --depth=1
git merge-base --is-ancestor "$GITHUB_SHA" origin/main
```

### 3.2 Create npm Token or Trusted Publisher

For the first publish, use an npm token because npm trusted publishing can only
be attached after the package exists.

1. Sign in to `https://www.npmjs.com/` as the long-term package owner.
2. Enable 2FA for the account.
3. Go to **Access Tokens** and choose **Generate New Token**.
4. Use these npm token settings:
   - Token type: granular access token.
   - Name: `asciidoclint-github-actions-release`.
   - Expiration: choose a short operational window for first publish, such as
     7-30 days.
   - Packages and scopes permission: **Read and write**.
   - Packages and scopes selection:
     - For an existing package: choose **Only select packages and scopes** and
       select `asciidoclint`.
     - For the first unscoped package publish, if npm cannot select
       `asciidoclint` before it exists, use **All packages** temporarily.
   - Organizations permission: **No access**, unless publishing under an npm
     organization.
   - Allowed IP ranges: leave empty for GitHub-hosted runners.
   - Bypass 2FA: enable only for this temporary CI token if account/package 2FA
     would otherwise block non-interactive publishing. Do not use bypass 2FA
     after trusted publishing is configured.
5. Copy the token once.
6. In GitHub, open
   `https://github.com/f33lgood/asciidoclint/settings/environments`.
7. Open environment `npm-release`.
8. Under **Environment secrets**, add:

   ```text
   NPM_TOKEN
   ```

9. Paste the npm token as the value.

After the first successful npm release, replace the token with npm trusted
publishing:

1. Open the npm package settings for `asciidoclint`.
2. Configure a trusted publisher for GitHub Actions.
3. Use owner `f33lgood`.
4. Use repository `asciidoclint`.
5. Use workflow filename:

   ```text
   release.yml
   ```

6. Use environment:

   ```text
   npm-release
   ```

7. Allowed actions: select `npm publish`.
8. Keep `id-token: write` in the npm job.
9. Remove `NODE_AUTH_TOKEN` from the workflow.
10. Delete `NPM_TOKEN` from GitHub.
11. Revoke the temporary npm token.

### 3.3 VS Code Marketplace Publishing

Use manual upload for the first release:

1. Build the VSIX locally:

   ```bash
   npm run release:vscode:package
   ```

2. Open `https://marketplace.visualstudio.com/manage/publishers/f33lgood`.
3. Click **New extension**.
4. Choose **Visual Studio Code**.
5. Upload `packages/vscode-asciidoclint/asciidoclint-<version>.vsix`.
6. Review the Marketplace metadata and publish.

CI publishing is optional. Enable it later only if the Azure DevOps token path
is worth maintaining:

1. Create or verify publisher `f33lgood`.
2. Create an Azure DevOps PAT for the account that owns or can publish under
   the `f33lgood` publisher.
3. Use PAT settings:
   - Scope: **Marketplace**.
   - Permission: **Manage**.
   - Expiration: choose a practical release window and record the renewal date.
   - Avoid broad Azure DevOps scopes that are unrelated to Marketplace
     publishing.
4. Add GitHub environment secret:

   ```text
   VSCE_PAT
   ```

5. Add a `vscode` job to `.github/workflows/release.yml` or run
   `npm run release:vscode:publish` locally with `VSCE_PAT` set.

### 3.4 Create Open VSX Token

1. Sign in to `https://open-vsx.org/`.
2. Create or claim namespace `f33lgood`.
3. Create an Open VSX access token from the account settings.
4. Copy the token once.
5. In GitHub, open environment `open-vsx-release`.
6. Under **Environment secrets**, add:

   ```text
   OVSX_PAT
   ```

7. Paste the Open VSX token as the value.

If the namespace must be created from the CLI:

```bash
npx ovsx create-namespace f33lgood -p "$OVSX_PAT"
```

### 3.5 Add the Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          package-manager-cache: false
      - run: npm ci
      - name: Verify release commit is on main
        run: |
          git fetch origin main --depth=1
          git merge-base --is-ancestor "$GITHUB_SHA" origin/main
      - run: npm run check
      - run: npm run release:npm:dry-run
      - run: npm run release:vscode:package

  npm:
    needs: verify
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
          package-manager-cache: false
      - run: npm ci
      - run: npm run release:npm:publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  open-vsx:
    needs: npm
    runs-on: ubuntu-latest
    environment: open-vsx-release
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          package-manager-cache: false
      - run: npm ci
      - run: npm run release:open-vsx:publish
        env:
          OVSX_PAT: ${{ secrets.OVSX_PAT }}
```

When npm trusted publishing is active, remove the `NODE_AUTH_TOKEN` environment
variable from the npm publish step and delete the `NPM_TOKEN` environment
secret. Keep `permissions.id-token: write`.

To automate VS Code Marketplace later, add a `vscode` job that depends on
`npm`, uses environment `vscode-marketplace-release`, and runs
`npm run release:vscode:publish` with `VSCE_PAT`.

References:

- npm trusted publishing: `https://docs.npmjs.com/trusted-publishers`
- npm `trust` command constraints: `https://docs.npmjs.com/cli/v11/commands/npm-trust/`
- VS Code extension CI publishing: `https://code.visualstudio.com/api/working-with-extensions/continuous-integration`
- Open VSX CLI: `https://www.npmjs.com/package/ovsx`
- GitHub Actions secrets and environments: `https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions`

## 4. Shared Pre-Release Checks

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

The generated `.vsix` should be installed locally in a VS Code-compatible editor
and smoke-tested before marketplace publication.

## 5. Core npm Package Release

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

## 6. VS Code-Compatible Extension Release

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
   code --install-extension packages/vscode-asciidoclint/asciidoclint-<version>.vsix --force
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

6. Publish to the VS Code Marketplace manually.

   Open:

   ```text
   https://marketplace.visualstudio.com/manage/publishers/f33lgood
   ```

   Click **New extension**, choose **Visual Studio Code**, upload the generated
   `.vsix`, review the metadata, and publish.

   Use `npm run release:vscode:publish` only after optional `VSCE_PAT`
   automation is configured.

7. Publish to Open VSX for broader editor compatibility.

   ```bash
   npm run release:open-vsx:publish
   ```

Open VSX is useful for editors that do not use the Microsoft marketplace.

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
- [ ] VS Code Marketplace publisher access is ready for manual `.vsix` upload.
- [ ] Public docs contain no private project names or sensitive paths.
- [ ] Rule docs exist for every built-in `AD###` rule.
- [ ] Experimental custom rules have docs that state necessity, rationale, bad
      example behavior, and expected good example behavior.
- [ ] GitLab-only reports are regenerated and consistent with tests.
- [ ] `npm run check` passes.
- [ ] `npm run release:npm:dry-run` contains only intended files.
- [ ] Clean-install npm smoke test passes.
- [ ] `.vsix` local install smoke test passes in a VS Code-compatible editor.
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
