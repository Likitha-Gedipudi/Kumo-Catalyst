# Project structure

```
Kumo-pos/
├── app/
│   ├── api/                 # Next.js route handlers (chat, kumo, webhooks)
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home route — renders StylistApp
│   └── globals.css          # Global styles
├── components/
│   ├── stylist/             # Kumo Catalyst shell (demo entry surface)
│   ├── chat/                # Messages, sessions, typing indicator
│   ├── panels/              # Intelligence board
│   ├── explain/             # Unified explain view
│   ├── ui/                  # Shared UI primitives (e.g. tabs)
│   ├── SavedQueriesPanel.tsx
│   ├── SearchModal.tsx
│   └── ErrorBoundary.tsx
├── lib/
│   ├── store.ts             # Zustand app state
│   ├── types.ts
│   ├── business/            # Decision lens, eval, handoff
│   ├── chat/                # Intent, discovery chips
│   ├── constants/           # Prompts, system prompt
│   ├── kumo-rest/           # Server-side REST helpers
│   └── utils/               # Formatters, saved queries, chat-client errors, etc.
├── kumo-sidecar/            # Python FastAPI service
├── docs/                    # Demo notes, planning docs
└── README.md
```

**Primary demo entry:** `app/page.tsx` → `components/stylist/StylistApp.tsx`.
