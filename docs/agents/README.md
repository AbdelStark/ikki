# Agent Handbook

This handbook gives LLM and AI agents a fast on-ramp to the Ikki codebase. It outlines the repository map, common workflows, and how to use the skills defined in `skills/`.

## Repository flyover
- **Frontend (`src/`)** – Svelte 5 UI, routes under `src/routes`, shared UI in `src/lib/components`, and state management in `src/lib/stores`.
- **Desktop backend (`src-tauri/`)** – Rust commands, wallet logic, and application state.
- **Static assets (`public/`, `docs/`)** – Icons, screenshots, and documentation.
- **Automation (`tools/ikki-mcp/`)** – MCP server for UI automation with Claude Code.

## Core flows for agents
1. **Survey the repo** – Start with `AGENTS.md` (root) and this handbook. Use `skills/survey-repo.skill.yaml` for a structured pass.
2. **Install dependencies** – Run `npm install`. For MCP automation, run `bun install` inside `tools/ikki-mcp/` (skill provided).
3. **Build or run** – `npm run dev` for Vite, `npm run tauri dev` for the full desktop flow, `npm run build` for CI-style sanity checks.
4. **Validate changes** – Build the frontend; if you touch Rust, run `npm run tauri build`.
5. **Summarize work** – Follow the guidance in `AGENTS.md` and reference the skills to keep steps reproducible.

## Coding patterns
- Svelte + TypeScript with single-file components.
- Stores live in `src/lib/stores/`; utilities for Tauri IPC live in `src/lib/utils/`.
- Keep UI changes paired with copy updates and state changes when relevant.
- Avoid `try/catch` around imports (per repo policy).

## MCP quick start
- Location: `tools/ikki-mcp/`.
- Install: `bun install` (skill: `skills/setup-ikki-mcp.skill.yaml`).
- Register: follow the snippet in the main `README.md` or in the skill file.

## Skills
Skill cards live in `skills/` and follow the Agent Skills format from Anthropics. Each skill includes:
- **When to use** – Situations the skill is meant for.
- **Prerequisites** – Tools or installs the agent should verify.
- **Steps** – Concrete commands and file touchpoints.
- **Outputs** – What artifacts or logs to collect.

See `docs/agents/skills/INDEX.md` for the index, and open each `*.skill.yaml` to execute.
