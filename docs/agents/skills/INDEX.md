# Skill Index

Use this index to locate Agent Skill cards for common Ikki workflows. Skills live in the repository root under `skills/`.

## Available skills
- **`survey-repo.skill.yaml`** – Fast context gathering for new tasks.
- **`setup-node-workspace.skill.yaml`** – Install Node dependencies and verify toolchain.
- **`setup-ikki-mcp.skill.yaml`** – Install and register the MCP automation server.
- **`build-frontend.skill.yaml`** – Run the Vite build and capture output for status reports.
- **`tauri-dev-session.skill.yaml`** – Launch the full Tauri app in development mode with logging.
- **`ui-copy-change.skill.yaml`** – Guardrails and steps for UI text or visual tweaks.

## Conventions
- Skills are YAML files following the Anthropics Agent Skills format.
- Each skill includes prerequisites, commands, artifacts to capture, and context links.
- Prefer reusing or extending existing skills before authoring new ones.

## Coverage snapshot
- Frontend setup and builds are covered (`setup-node-workspace`, `build-frontend`).
- Automation via MCP is covered (`setup-ikki-mcp`).
- Context gathering and UX tweaks are covered (`survey-repo`, `ui-copy-change`).
- End-to-end desktop validation is covered (`tauri-dev-session`).
- Gaps to consider adding later: Rust-side linting/builds in `src-tauri/`, wallet data reset flows, and scripted regression checks for transaction history UI.
