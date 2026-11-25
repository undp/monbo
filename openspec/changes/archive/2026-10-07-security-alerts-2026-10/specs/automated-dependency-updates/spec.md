## ADDED Requirements

### Requirement: Security alerts are resolved, not left open

Every open Dependabot alert SHALL be resolved: by updating the dependency to a patched version, or by dismissing it in GitHub as `vulnerable_code_not_used`, `tolerable_risk` or `inaccurate` (never `no_bandwidth` or `fix_started`) with a comment naming the evidence. An alert with no patched version in the registry SHALL NOT be dismissed while the vendor publishes a fix elsewhere; the fix SHALL be installed from there.

#### Scenario: A transitive alert in unused code

- **WHEN** an alert concerns a transitive package whose vulnerable code the app never runs, and no update within the parent's range fixes it
- **THEN** it is fixed with an override or dismissed as `vulnerable_code_not_used`, with a comment saying why the code isn't reached

#### Scenario: The registry has no fix

- **WHEN** a dependency's patched version exists only outside its registry, as with SheetJS
- **THEN** the dependency is installed from the vendor's versioned tarball instead of the alert being dismissed

### Requirement: Dependencies outside Dependabot's reach are listed

Every dependency Dependabot can't update SHALL be listed in the README of the package that has it, with the reason and the manual check: dependencies installed from a URL tarball, and `pnpm` overrides. Each override SHALL state the condition for removing it.

#### Scenario: Bumping SheetJS

- **WHEN** a maintainer looks for how to update `xlsx`
- **THEN** `apps/web/README.md` says it comes from SheetJS's CDN, where to watch for releases, and how to change the version and test it

#### Scenario: An override becomes unnecessary

- **WHEN** the parent of an overridden package starts allowing the patched version
- **THEN** the README's exit condition is met, and the override is removed in the next dependency update
