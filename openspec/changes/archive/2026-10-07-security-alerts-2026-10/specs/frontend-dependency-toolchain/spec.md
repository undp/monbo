## ADDED Requirements

### Requirement: Registry-external dependencies are pinned tarballs

A JavaScript dependency SHALL come from outside the npm registry only when the registry has no patched version. It SHALL then be declared as the vendor's own versioned HTTPS tarball URL, never a moving "latest" URL. pnpm records no integrity hash for a remote tarball, so the content is trusted to the vendor's host. The package's README SHALL state that limit, and SHALL name vendoring the tarball (`file:`, which pnpm verifies) as the fallback.

#### Scenario: SheetJS from its CDN

- **WHEN** `apps/web/package.json` is inspected
- **THEN** `xlsx` is declared as `https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz` with a fixed version of at least 0.20.2
- **AND** `apps/web/README.md` states that its content isn't verified by an integrity hash, and how to vendor it instead

#### Scenario: Excel upload and downloads keep working

- **WHEN** the regression farms file is uploaded, and the validation and deforestation results are downloaded as Excel
- **THEN** the parsed farms match the previous version's, and both downloads open with their headers and wrapped text

### Requirement: Overrides only for transitive fixes

A pnpm project (`apps/web` or the repository root) SHALL use `pnpm.overrides` only to raise a transitive dependency to a patched version that its parent's declared range excludes, scoped to that parent where pnpm allows it. A fix available within the parent's range SHALL be applied by updating the lockfile, not by an override.

#### Scenario: Fix within the parent's range

- **WHEN** an alert's patched version satisfies the range its parent declares
- **THEN** the lockfile is updated to it and no override is added

#### Scenario: Parent pins a vulnerable version

- **WHEN** a parent pins a vulnerable version, as `concurrently` 10.0.5 pins `shell-quote` 1.9.0
- **THEN** an override raises it, and the frozen install, lint and build still succeed
