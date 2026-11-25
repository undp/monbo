## ADDED Requirements

### Requirement: Security fixes are ordered by exposure

When several Dependabot alerts are open, the fixes SHALL be merged in order of exposure. First come alerts in code that runs in a deployed environment and is reachable from outside. Then come runtime dependencies of deployed apps. Last come development-only dependencies and tools that aren't deployed. A fix for a deployed, reachable alert SHALL NOT wait behind a routine version update or behind fixes for less exposed alerts.

#### Scenario: A deployed RCE goes first

- **WHEN** open alerts include a remote code execution in a dependency of the deployed web, and others in development or tool lockfiles
- **THEN** the web fix is merged first
- **AND** the other fixes don't delay it

#### Scenario: A conflicting security PR is regenerated, not skipped

- **WHEN** the Dependabot pull request that carries a deployed fix conflicts with `dev`
- **THEN** it is rebased or recreated by Dependabot, or replaced by a pull request with the fix
- **AND** the alert isn't left open waiting for the next weekly run

### Requirement: Fixes that share a lockfile may be consolidated

When several Dependabot pull requests fix alerts in the same lockfile, their fixes, and those Dependabot opened no pull request for, can be applied together in one pull request instead of being merged and rebased one by one. Such a pull request SHALL move only the packages named by the alerts, plus what they require, and its description SHALL list the Dependabot pull requests it supersedes. After it merges, each superseded pull request SHALL be closed with a comment naming the pull request that replaced it.

#### Scenario: Five PRs on one lockfile

- **WHEN** five Dependabot pull requests each bump one transitive package in `tools/update-gfw-tmf/uv.lock`
- **THEN** one pull request upgrades all five with `uv lock --upgrade-package`
- **AND** the lockfile diff moves no unrelated package
- **AND** after it merges, the five Dependabot pull requests are closed as superseded

#### Scenario: An alert without a Dependabot PR

- **WHEN** an alert has a patched version but Dependabot opened no pull request for it
- **THEN** the fix is applied by hand, in the pull request that touches the same lockfile
