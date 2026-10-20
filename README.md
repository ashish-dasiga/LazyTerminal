# Lazy Terminal shared Antigravity agent pack

This pack provides repository-shared custom agents plus a shared `AGENTS.md` contract. It is designed for four contributors, isolated feature branches, minimal context repetition, and a low-token test/review loop.

## Install into the cloned repository

Copy `AGENTS.md` and the `.agents/` directory into the root of the Lazy Terminal repository. Commit them on a small setup branch, then merge that branch so all four developers receive the same configuration.

The project-level `.agents/agents/` definitions are the source of truth for the team. A personal global agent folder is machine-specific and will not be shared by Git.

## Model strategy

Antigravity agent frontmatter supports `model: pro`, `model: inherit`, and `model: flash` in the documented CLI schema. This pack uses:
- `pro`: architecture/security/irreversible decisions only.
- `inherit`: implementation and integration, inheriting the active model tier.
- `flash`: targeted tests and focused diff review.

These are model tiers, not a guarantee of exact billing/token cost. Model availability and names can vary by installed Antigravity version. Confirm the agents appear with `/agents`.

## Start

1. Open the cloned repository root in Antigravity CLI.
2. Run `agy` (or your normal CLI command), then enter `/agents`.
3. Confirm `architect`, `implementer`, `test-engineer`, `reviewer`, and `integrator` are listed.
4. Assign each human contributor a separate feature branch and explicit file ownership.
5. Use isolated worktrees/branches for parallel agent work. Do not let multiple agents edit the same files concurrently.

## Token-saving workflow

1. Ask `architect` only for decisions with cross-module impact or high reversal cost.
2. Give `implementer` a bounded feature brief, relevant paths, acceptance tests, and owned files.
3. Ask `test-engineer` to run narrow tests first; broaden only at integration.
4. Ask `reviewer` to inspect the diff and return actionable findings only.
5. Run integration checks after all branches are merged.

Do not launch all agents for every task. One implementer plus one focused test/review pass is the default; use architecture and parallel subagents only when justified.

## Global personal agents (optional)

Antigravity's documented global location is `~/.gemini/config/agents/`. Global agents are for one machine/account and are not automatically shared with teammates. Keep project requirements in this repository.

Official docs:
- https://antigravity.google/docs/cli/commands/agents/
- https://antigravity.google/docs/cli/subagents/
- https://www.antigravity.google/blog/introducing-custom-agents
