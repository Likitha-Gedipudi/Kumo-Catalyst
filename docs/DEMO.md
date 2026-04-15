# Demo checklist (Kumo Catalyst)

Use this before a live walkthrough or recording.

## Environment

1. **Python sidecar** on `http://127.0.0.1:8000` — see [../kumo-sidecar/README.md](../kumo-sidecar/README.md).
2. **Next.js app** — from repo root: `npm install` then `npm run dev` → open `http://localhost:3000`.
3. **Keys** in `.env.local` (copy from `.env.example`):
   - `GEMINI_API_KEY` — chat intent / narration
   - `KUMO_API_KEY` — sidecar / predictions

## Quick health

- Header should show **Graph live · KumoRFM** (or degraded/mock if expected).
- If **Sidecar offline**, predictions and board data may be empty — start the sidecar first.

## Suggested 2-minute flow

1. **Sessions** — Point out the left rail: multiple chats, **New chat**.
2. **Starter cards** — With only the welcome message, show the capability grid; click one card or a suggested follow-up.
3. **Run** — Type a retail question, press **Run**; mention the phased **thinking** indicator.
4. **Board / Explain** — Open the **Board** pill (or header chart icon); switch **Board** vs **Explain**; drag the panel if needed.
5. **Shortcuts** — `Ctrl+K` / `Cmd+K` search, `Ctrl+S` / `Cmd+S` save query (when implemented in UI).

## Smoke commands

```bash
npm run lint
npm run test
npm run build
```

## Where things live in the repo

| Area | Location |
|------|------------|
| Main UI shell & chat orchestration | `components/stylist/StylistApp.tsx` |
| Header, composer, floating board panel | `components/stylist/*.tsx` |
| Chat bubbles, sidebar, thinking | `components/chat/` |
| Intelligence board + explain | `components/panels/`, `components/explain/` |
| API routes | `app/api/` |
| State (sessions, board, explain) | `lib/store.ts` |

See [STRUCTURE.md](./STRUCTURE.md) for the full layout.
