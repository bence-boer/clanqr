# Ralph Agent Workspace

Multi-agent orchestration platform for managing AI coding agents. Built with **Bun**, **Svelte 5**, **Hono**, and **Supabase**.

## Architecture

- `/server` — Hono backend (API + filesystem watcher + agent spawner)
- `/web` — SvelteKit 5 dashboard
- `/agents` — Agent prompts and spawn scripts
- `/supabase` — Database migrations and local config

## Quick Start

```bash
# 1. Start local Supabase
bunx supabase start

# 2. Start the backend
cd server && bun run dev

# 3. Start the dashboard
cd web && bun run dev
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| Frontend | SvelteKit + Svelte 5 |
| Backend | Hono |
| Database | Supabase (local) |
| Agents | GitHub Copilot CLI |
