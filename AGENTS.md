# Ralph Agent Workspace — Bug Fix Instructions

## Workflow for the fixing agent

1. **Invoke skills first:** Use `hono-backend-architect` before backend changes, `svelte-architect` before frontend changes.
2. **Validate before and after:**
   ```bash
   cd server && bun run --bun tsc --noEmit   # must produce 0 errors
   cd web && bun run check                   # must produce 0 errors
   ```
3. **Amend all fixes into THIS commit** (do not create new commits):
   ```bash
   git add -A && git commit --amend --no-edit
   ```
4. **Force-push when done:**
   ```bash
   git push --force-with-lease origin main
   ```
5. **Wait for the CI pipeline to succeed.** The workflow is `Deploy to Pi` (`.github/workflows/deploy-pi.yml`). Use `gh run list --limit 1 --json status,conclusion` to poll for completion. If CI fails, investigate logs with `gh run view --log-failed`, fix, and re-amend/push.
6. **Validate E2E against the live deployment at `https://agents.benceboer.com`:**
   - The app requires passkey auth. For API-level testing, try unauthenticated endpoints first (e.g. `GET /health`). For authenticated testing, use the browser or check if session cookies can be reused.
   - Use `gpt-4.1` for any test that needs a real model call (it's free tier). When sending chat messages, include `"model": "gpt-4.1"` in the request body to `POST /api/chat/sessions/:id/send`.
   - Verify each fixed bug works as described in the testing section below.
7. **You are ONLY done when:** the pipeline has run successfully AND you have confirmed the fixes work on the live deployment.

## Conventions

- **Backend:** Hono on Bun (port 3001), TypeScript strict, snake_case, Zod validation via `schema.safeParse(await c.req.json())`
- **Frontend:** SvelteKit + Svelte 5 runes (`$state`, `$derived`, `$effect`), no stores
- **DB:** Supabase (local Postgres via Docker)
- **No new libraries** unless absolutely necessary

---

## Open Bugs — Fix All of These

### BUG-04 · Traits library overflows horizontally on mobile

**Status:** Previous fix attempt (flex-wrap / box-sizing on `.trait-row`) did NOT resolve the overflow. The root constraint issues remain.

**File:** `web/src/routes/prompts/+page.svelte`

**Root cause:**
- `.trait-actions` has `flex-shrink: 0` (found at lines 783, 978, 1116) — prevents the action button group from shrinking, forcing the row wider than viewport.
- `.trait-filter-bar` has no `flex-wrap` or mobile stacking rule.
- Parent `.traits-list` has no `overflow-x: hidden`.

**Fix:**
- In the `@media (max-width: 768px)` block, add `flex-shrink: 1;` to `.trait-actions`.
- Add `.trait-filter-bar { flex-direction: column; align-items: stretch; }` in the mobile block.
- Add `overflow-x: hidden; box-sizing: border-box;` to the `.traits-section` container.
- Truncate long trait names: `.trait-name { text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 100%; }` on mobile.

**Verify:** Set viewport to 375×812 → load `/prompts` → traits tab → confirm no horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth`).

---

### BUG-06 · Chat message area broken on mobile

**Status:** Previous fix using `100dvh` was insufficient — layout still overflows/clips.

**File:** `web/src/routes/chat/+page.svelte`

**Root cause:**
- Mobile `@media` sets `.chat-page { height: auto; }` which removes the height constraint entirely.
- `.chat-area` has no mobile-specific rules — no flex, no min-height.
- Layout's `.content` has `padding-top: 3.5rem` on mobile which is not accounted for.

**Fix:**
```css
@media (max-width: 768px) {
  .chat-page {
    flex-direction: column;
    height: calc(100dvh - 3.5rem);
    min-height: 0;
  }
  .sessions-panel { width: 100%; height: 180px; margin-right: 0; margin-bottom: 0; }
  .chat-area { flex: 1; min-height: 0; }
  .input-area { padding-bottom: env(safe-area-inset-bottom, 0.75rem); }
}
```

**Verify:** Set viewport to 375×812 → load `/chat` → select a session → confirm messages area fills available space without overflow.

---

### BUG-07 · Usage analytics page overflows horizontally on mobile

**Status:** Previous `flex-wrap: wrap` fix was partial — overflow persists from stat grids and filter row.

**File:** `web/src/routes/usage/+page.svelte`

**Root cause:**
- `.stats-3` uses `grid-template-columns: repeat(3, 1fr)` — collapses to `1fr` at 640px but has no rule for 641–768px.
- `.filters` row lacks `flex-wrap` or mobile stacking.
- `.history-header` flex children have no `min-width: 0`.

**Fix:**
- Replace stat grids with `display: flex; flex-wrap: wrap; gap: 0.75rem;` and stat cards get `flex: 1 1 auto; min-width: 140px;`.
- Add `flex-wrap: wrap;` to `.filters`. Add `@media (max-width: 640px) { .filters { flex-direction: column; } }`.
- Add `min-width: 0;` to `.history-header` flex children and `.select` elements.
- Add `overflow-x: hidden;` to the page container as a safety net.

**Verify:** Set viewport to 375×812 → load `/usage` → confirm no horizontal scroll.

---

### BUG-11 · Pipeline agent fails — "Executable not found in $PATH: copilot"

**Status:** `agent_service.ts` and `chat_service.ts` were already fixed (they use `COPILOT_BIN` + `ENRICHED_PATH`). But `pipeline_service.ts` was **completely missed** — it still uses bare `"copilot"` and doesn't enrich PATH.

**File:** `server/src/services/pipeline_service.ts`

**Current broken code (around line 138):**
```ts
const proc = Bun.spawn(["copilot", "-p", prompt, "--allow-all-tools"], {
  cwd: work_dir,
  stdout: "pipe",
  stderr: "pipe",
  env: { ...process.env, HOME: process.env.HOME ?? "/home/scoy" },
});
```

**Fix:** Add at the top of the file (after the existing imports):
```ts
const HOME = process.env.HOME ?? "/home/scoy";
const COPILOT_BIN =
  process.env.COPILOT_BIN ?? join(HOME, ".local/bin/copilot");
const ENRICHED_PATH = [
  join(HOME, ".local/bin"),
  join(HOME, ".bun/bin"),
  process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
].join(":");
```
Note: `join` is already imported from `"path"`.

Then update the spawn call:
```ts
const proc = Bun.spawn([COPILOT_BIN, "-p", prompt, "--allow-all-tools"], {
  cwd: work_dir,
  stdout: "pipe",
  stderr: "pipe",
  env: { ...process.env, HOME, PATH: ENRICHED_PATH },
});
```

**Verify:** After deployment, submit a feature via the UI → check `/usage` → confirm the agent run status is `running` or `completed` (not `failed` with PATH error).

---

### BUG-12 · Button coloring inconsistent across pages

**Files:** `web/src/routes/projects/+page.svelte`, `web/src/routes/projects/[id]/+page.svelte`, `web/src/routes/monitoring/+page.svelte`

**Root cause:** `.btn-danger` uses `color: var(--fg)` in some pages but `color: #fff` in others. The `projects/+page.svelte` is also missing a `.btn-secondary` class entirely.

**Fix:**
- Change all `.btn-danger` to use `color: #fff` (white text on red background).
- Add to `projects/+page.svelte`:
  ```css
  .btn-secondary { background: var(--bg-elevated); color: var(--fg); border: 1px solid var(--border); }
  ```

---

### BUG-16 · Pipeline page has zero responsive CSS

**File:** `web/src/routes/pipeline/+page.svelte`

**Root cause:** The entire page has **no** `@media` breakpoints. Status bar buttons, queue items, and pagination all overflow on mobile.

**Fix — add this `@media` block:**
```css
@media (max-width: 768px) {
  .status-bar { flex-direction: column; align-items: flex-start; }
  .status-right { width: 100%; justify-content: flex-end; flex-wrap: wrap; }
  .queue-item { flex-direction: column; align-items: flex-start; }
  .item-actions { align-self: flex-end; }
  .pagination { flex-wrap: wrap; }
}
```
Add `overflow-x: hidden;` to the page container.

**Verify:** Set viewport to 375×812 → load `/pipeline` → confirm no horizontal scroll.

---

## Testing Checklist

After fixing and deploying, verify each bug against `https://agents.benceboer.com`:

| Bug | Test |
|-----|------|
| BUG-04 | Load `/prompts` → traits tab at 375px → no horizontal scroll |
| BUG-06 | Load `/chat` at 375px → messages fill screen, input visible |
| BUG-07 | Load `/usage` at 375px → no horizontal scroll |
| BUG-11 | Submit a feature → check `/usage` → agent run should not show PATH error |
| BUG-12 | Check `.btn-danger` on `/projects` → text should be white |
| BUG-16 | Load `/pipeline` at 375px → no horizontal scroll |

For BUG-11 specifically: if you can't submit a feature via the UI due to auth, verify by checking the pipeline_service.ts code change is deployed and the server restarted (the `.deploy-trigger` file signals restart).

