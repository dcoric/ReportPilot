---
name: create-pr
description: Create a pull request for the current branch, optionally linking it to a provided ticket, and commit first if the branch still has uncommitted changes
---

Create a pull request for the current branch.

Read `AGENTS.md` first. It is the canonical project guide for this repository.

Inputs:

- Optional ticket identifier such as `#123`, `ABC-123`, or a ticket URL
- Optional short ticket summary or context

Workflow:

1. Check `git status --short`
2. If there are staged or unstaged code changes that belong in the PR, use the `commit` skill first
3. Get the current branch with `git rev-parse --abbrev-ref HEAD`
4. If the branch name contains `codex`, `claude`, `chatgpt`, or similar agent branding, stop and ask the user to rename the branch before creating the PR
5. Review the branch diff against its base and write a concise human PR title and body
6. Open the PR using the normal repo workflow

PR title rules:

- Keep it short, specific, and written by topic rather than by tool
- Do not include agent branding
- Do not copy a noisy stack of commit subjects into the title

PR body rules:

- Summarize what changed and how to verify it
- If a ticket is provided, link it explicitly
- For GitHub issues, prefer a closing reference such as `Closes #123`
- For external tickets such as `ABC-123`, include a plain ticket line such as `Ticket: ABC-123`
- Do not invent ticket IDs, links, or status text
- Do not add `Co-authored-by`
- Do not add `Signed-off-by`
- Do not add AI-generated disclaimers, attribution, or signature text

If there are no commits on the branch yet, stop and use the `commit` skill first.
