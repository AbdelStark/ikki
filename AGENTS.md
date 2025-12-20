# Ikki – Agent Operating Guide

Welcome! This file sets the ground rules for all AI/LLM agents working in this repository. Its scope is the entire repo.

## Working style
- Favor `rg` for searches; avoid `ls -R` and `grep -R`.
- Keep edits minimal and purposeful. Update relevant docs when behavior changes.
- Do **not** wrap imports in `try/catch`.
- Prefer small, self-contained commits with clear messages.

## Project basics
- Frontend: Svelte 5 + Vite (`src/`).
- Desktop runtime: Tauri 2 (`src-tauri/`).
- Key scripts: `npm run dev`, `npm run build`, `npm run tauri dev`, `npm run tauri build`.
- MCP server for UI automation lives in `tools/ikki-mcp/`.

## Quick checks
- Build: `npm run build`
- Desktop build: `npm run tauri build`
- Dev server: `npm run dev` (or `npm run tauri dev` for the full app)

## Agent collaboration assets
- Agent-focused documentation lives in `docs/agents/`.
- Skill definitions (Anthropic Skills format) live in `skills/`.

If you add new files within subdirectories, check for nested `AGENTS.md` files before editing; they override this guide for their subtree.
