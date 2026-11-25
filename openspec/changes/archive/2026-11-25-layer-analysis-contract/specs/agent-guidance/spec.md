## MODIFIED Requirements

### Requirement: Root CLAUDE.md with repository knowledge
The repository SHALL have a `CLAUDE.md` at its root, written in English, with these sections in this order: a short introduction with what to read first, `## System map`, `## Commands`, `## Code conventions`, `## Security`, `## Testing`, `## Workflow` and `## Domain skills`. It SHALL contain repository knowledge only: no personal preferences, no instructions tied to one contributor's machine, and nothing about external agent tooling beyond the skills committed under `.claude/skills/`.

#### Scenario: A new session reads the conventions
- **WHEN** an agent session starts at the repository root
- **THEN** `CLAUDE.md` tells it that the analysis contract is `POST /layer_analysis/analyze` with `AnalyzeBody`, the meaning of `value: null` and area `-1`, that `pnpm contracts` regenerates `apps/api/openapi.json` and `apps/web/src/api/schema.d.ts` and CI fails when they are stale, and where the API and web conventions are stated

#### Scenario: Section headings are stable
- **WHEN** a tool or skill looks for the code conventions, security rules or testing rules
- **THEN** it finds them under the exact headings `## Code conventions`, `## Security` and `## Testing`
