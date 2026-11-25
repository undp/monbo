## ADDED Requirements

### Requirement: Secret scanning with push protection

The public repository SHALL have secret scanning and push protection enabled. A push that contains a recognised secret SHALL be blocked unless the pusher bypasses it with a stated reason, and every secret scanning alert SHALL be resolved: revoked and closed, or closed as a false positive or test value with a comment.

#### Scenario: A secret is pushed by mistake

- **WHEN** a commit containing a recognised credential, such as an Azure storage key, is pushed
- **THEN** GitHub rejects the push and names the secret and its location

#### Scenario: A leaked secret is handled

- **WHEN** a secret scanning alert opens
- **THEN** the secret is rotated where it is used before the alert is closed as revoked

### Requirement: CodeQL code scanning

CodeQL code scanning SHALL run on the repository with the default setup for Python, JavaScript/TypeScript and GitHub Actions, on pull requests into `dev` and `main` and on a weekly schedule. Its check SHALL NOT be a required check unless the rulesets are explicitly changed. Every open code scanning alert SHALL be fixed or dismissed with a reason and a comment.

#### Scenario: A pull request is analysed

- **WHEN** a pull request into `dev` changes API, web or workflow code
- **THEN** a CodeQL check runs and reports new alerts on the pull request

#### Scenario: The CodeQL check doesn't block merges

- **WHEN** a pull request's required checks pass and CodeQL is still running
- **THEN** the pull request can be merged
