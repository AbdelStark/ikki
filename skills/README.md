# Ikki Skill Pack

This folder contains Agent Skill cards for common workflows in the Ikki project. Skills follow the Anthropics Agent Skills format (YAML with `version`, `name`, `description`, `prerequisites`, `steps`, `artifacts`, and `references`).

## Using skills
1. Open `docs/agents/skills/INDEX.md` to find the relevant card.
2. Load the matching `*.skill.yaml` into your agent environment.
3. Execute the steps in order, collecting the requested artifacts (logs, screenshots).

## Authoring new skills
- Keep scope narrow (one workflow per skill).
- Include prerequisites and capture instructions for logs or screenshots.
- Link to related docs in `references` so agents can open source files quickly.
- Prefer reusing commands already captured in existing skills.

Available skills include repository survey, Node setup, MCP setup, frontend builds, Tauri dev sessions, and UI copy changes. Extend this pack as workflows evolve.
