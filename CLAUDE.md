# Claude Instructions

Read and follow `AGENTS.md` first. It is the canonical project guide for this repository.

Additional Claude-specific notes:

- Apply `AGENTS.md` as the source of truth. If this file and `AGENTS.md` ever differ, `AGENTS.md` wins.
- Preserve the read-only reporting model. Do not bypass SQL validation, execution safety checks, RAG grounding, or provider-routing guardrails.
- Keep database-specific behavior in adapters, cross-provider orchestration in services, and UI-only concerns in the frontend.
- When API behavior changes, update `docs/api/openapi.yaml` and the affected frontend API types.
- Repo-local Claude/Codex skills live under `.agents/skills/`.
- Prefer the standard repo commands listed in `AGENTS.md`.
- Treat `.claude/worktrees/` as local machine state. Do not rely on it or commit changes from it.
