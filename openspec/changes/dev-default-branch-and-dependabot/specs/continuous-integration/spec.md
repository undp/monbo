## MODIFIED Requirements

### Requirement: Required checks enforce merge blocking

Repository rulesets SHALL require the final frontend and API workflow checks on both `main` and `dev`. Workflow failure semantics alone are insufficient: the required check names SHALL be recorded and a failing required check SHALL prevent merging. Each ruleset SHALL target its branch by name (`refs/heads/main`, `refs/heads/dev`) and SHALL NOT target `~DEFAULT_BRANCH`, so changing the default branch cannot move or remove a branch's protection. Both branches SHALL require a pull request, block force pushes and deletions, and keep an empty bypass list.

#### Scenario: Branch protection rejects a failing change

- **WHEN** either required frontend or API check fails on a ready-for-review pull request into `main` or `dev`
- **THEN** repository merge controls report the required check as unsuccessful
- **AND** the pull request cannot be merged until both required checks pass

#### Scenario: Protection survives a default-branch change

- **WHEN** the repository's default branch changes
- **THEN** `main` and `dev` keep exactly the rules they had before

#### Scenario: No direct pushes to protected branches

- **WHEN** someone pushes commits directly to `main` or `dev`
- **THEN** the push is rejected and the change must arrive through a pull request
