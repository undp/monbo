# agent-guidance Specification

## Purpose
The root `CLAUDE.md`: the repository knowledge every agent session and new contributor starts from (the system map and its invariants, commands, code conventions, security, testing, workflow and the repo's skills). It states the rules briefly, links to the docs that own the detail, and is the single source of the conventions the repo's skills check against.
## Requirements
### Requirement: Root CLAUDE.md with repository knowledge
The repository SHALL have a `CLAUDE.md` at its root, written in English, with these sections in this order: a short introduction with what to read first, `## System map`, `## Commands`, `## Code conventions`, `## Security`, `## Testing`, `## Workflow` and `## Domain skills`. It SHALL contain repository knowledge only: no personal preferences, no instructions tied to one contributor's machine, and nothing about external agent tooling beyond the skills committed under `.claude/skills/`.

#### Scenario: A new session reads the conventions
- **WHEN** an agent session starts at the repository root
- **THEN** `CLAUDE.md` tells it the contract spelling `analize`, the meaning of `value: null` and area `-1`, that `pnpm contracts` regenerates `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts` and CI fails when they are stale, and where the API and web conventions are stated

#### Scenario: Section headings are stable
- **WHEN** a tool or skill looks for the code conventions, security rules or testing rules
- **THEN** it finds them under the exact headings `## Code conventions`, `## Security` and `## Testing`

### Requirement: CLAUDE.md points to the docs that own each topic
`CLAUDE.md` SHALL state rules and invariants briefly and link to the document that owns the detail: `docs/onboarding.md` for setup and architecture walkthrough, `docs/architecture.md` for Azure resources, layer reads and the admin, `docs/maps.md` for layers, `docs/branch_protection.md` for the branch flow and required checks, and the app READMEs for app-specific commands. It SHALL NOT copy step-by-step procedures from those documents. It SHALL stay within 200 lines.

#### Scenario: Setup instructions
- **WHEN** a reader needs to run Monbo locally
- **THEN** `CLAUDE.md` gives the root commands and links to `docs/onboarding.md` §4 instead of repeating its steps

#### Scenario: Length budget
- **WHEN** `CLAUDE.md` is changed
- **THEN** `wc -l CLAUDE.md` reports 200 lines or fewer

### Requirement: Every statement matches the current repository
Every path, command, job name, file name and invariant in `CLAUDE.md` SHALL match the repository at the commit where it is merged. In particular, it SHALL describe the per-country admin authentication (passkey login, HMAC-signed session, opt-in through `ADMIN_SESSION_SECRET`), the generated contract types, the CI job names `Test and static checks` and `Tests, type-check, lint, build`, and the version that lives in four files (root and both apps' `package.json`, and `apps/api/pyproject.toml`).

#### Scenario: Paths resolve
- **WHEN** a reviewer checks every repository path mentioned in `CLAUDE.md`
- **THEN** each one exists at the merge commit

#### Scenario: No stale "no authentication" claim
- **WHEN** `CLAUDE.md` describes the API's security model
- **THEN** it states that public routes are unauthenticated with open CORS and that `/admin` requires a per-country session token

### Requirement: CLAUDE.md stays current
A change that alters a command, convention, invariant, path or CI job name stated in `CLAUDE.md` SHALL update `CLAUDE.md` in the same pull request, as `docs/onboarding.md` already requires for itself.

#### Scenario: A renamed CI job
- **WHEN** a pull request renames a required CI job
- **THEN** the same pull request updates the job name in `CLAUDE.md`

### Requirement: Single source for the code conventions
The repository's code conventions SHALL be stated once, in `CLAUDE.md`. Skills under `.claude/skills/` that check code against them (`pr-review`) SHALL read them from `CLAUDE.md` instead of keeping their own copy, and SHALL keep only what is specific to their task.

#### Scenario: pr-review checks conventions
- **WHEN** the `pr-review` skill reaches its project-conventions step
- **THEN** it reads `CLAUDE.md` (`## Code conventions`, `## Security`, `## Testing`) and contains no separate list of the same conventions

