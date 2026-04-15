# Kumo Catalyst

Kumo Catalyst is a retail intelligence copilot built for merchandising teams who need fast, accurate answers about demand, churn, inventory, and customers, without writing SQL or waiting for data teams. It combines Google Gemini for language understanding, the KumoRFM graph prediction engine for structured analytics, and a polished Next.js interface that makes every answer feel like it came from a senior analyst.

---

## Why This Exists

Retail merchandising is driven by perishable decisions. The window to act on a churn signal, a demand spike, or an untapped customer segment is often hours, not days. Most existing tools require analysts, BI queries, or overnight batch jobs. Kumo Catalyst puts that answer in a conversational interface that any merchant can use directly.

The specific problems it solves:

- Identifying which customer segments are at risk of churn before they lapse
- Forecasting demand at the category and item level so stock decisions are data-driven
- Running reverse recommendations to find the right customers for a given product
- Discovering cold-start affinity signals for new customers with limited purchase history
- Explaining why a specific customer was scored the way they were, so the merchant trusts the model
- Generating a structured daily report that captures the most important retail signals each morning or at close of day

The underlying belief is that AI should do the analytical heavy lifting, and the merchant should spend their time acting on what they learn, not finding it.

---

## Architecture

```
Browser (Next.js UI)
        |
        v
Next.js Route Handlers (/api/chat, /api/report/questions, /api/kumo/*)
        |                              |
        v                              v
 Google Gemini                  Python FastAPI Sidecar (port 8000)
 (intent routing,               (KumoRFM graph, predictions,
  narration, report              churn, demand, explain, board)
  question generation)
        |
        v
 Optional: Kumo Cloud REST API
 (job discovery, predictive query metadata, console deep links)
```

The browser never sees API keys. All calls to Gemini and Kumo are proxied through Next.js server route handlers. The sidecar runs on the same machine (or a private network) and exposes CORS-controlled REST endpoints that the browser can call directly for board data and health checks.

### Key subsystems

| Subsystem | Role |
|-----------|------|
| `/api/chat` | Two-step pipeline: `intent` step classifies the user message with Gemini; `narrate` step calls the sidecar and uses Gemini to turn structured results into readable narration |
| `/api/report/questions` | Calls Gemini to generate 5 context-aware retail analytics questions based on report type, date, and timezone |
| `/api/kumo/discovery` | Aggregates jobs and predictive query metadata from Kumo Cloud REST (or serves demo stubs) |
| `/api/kumo/jobs` | Normalizes and enriches job records with console deep links |
| `/api/webhooks/kumo-alert` | Relays structured alert payloads to configured downstream webhook URLs |
| `kumo-sidecar/main.py` | FastAPI service wrapping `kumoai` SDK; builds the RFM graph, warms prediction caches, serves demand/churn/explain/board/health endpoints |

---

## Technology Stack

### Frontend

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router), React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4, PostCSS |
| State management | Zustand |
| Charts | Recharts |
| Animation | Framer Motion (motion) |
| Icons | lucide-react |
| UI primitives | Base UI (`@base-ui/react`) |
| PDF generation | `@react-pdf/renderer` |

### Backend

| Layer | Technology |
|-------|------------|
| API routes | Next.js Route Handlers (server-only) |
| AI | Google Gemini via `@google/genai` |
| ML predictions | `kumoai` SDK (KumoRFM graph engine) |
| Sidecar server | FastAPI + Uvicorn |
| Data layer | pandas, pyarrow, s3fs (H&M-style dataset on S3) |

### DevOps

- ESLint (`eslint-config-next`)
- Vitest + jsdom + Testing Library
- GitHub Actions CI: lint, test, `next build`
- `output: 'standalone'` in `next.config.ts` for container deployments

---

## Dataset and Domain Model

The demo dataset is modeled after public H&M transactional data (users, items, orders). It is loaded from `s3://kumo-sdk-public/rfm-datasets/online-shopping` with anonymous read access. The sidecar builds a KumoRFM graph with nodes for customers and items, edges for purchase interactions, and computes RFM-style features (recency, frequency, monetary value) alongside model-driven predictions.

The domain maps directly to real merchandising language: customer segments, category-level demand, item-level stock signals, churn-at-risk lists, and per-customer prediction explanations.

---

## Core Features

### Chat Copilot

The chat interface is the primary way to interact with Kumo Catalyst. Every message goes through a two-step pipeline:

1. **Intent step** -- Gemini classifies the user message into one of the supported capabilities (`demand_forecast`, `churn_list`, `reverse_rec`, `cold_affinity`, `explain`, `graph_schema`, `text`) and extracts relevant entities. The result is normalized to a strict payload with optional confidence score and clarifying questions if the intent is ambiguous.

2. **Narrate step** -- The server calls the appropriate sidecar endpoint using the classified intent and extracted entities, then passes the structured result back to Gemini with a narration prompt. Gemini returns a `narration` (business-language explanation), optional `followUps`, and chart-ready `data`.

For low-signal messages (conversational, out-of-scope), the fast path skips the sidecar entirely and Gemini responds directly.

Each assistant message includes an expandable trace panel showing every step, latency, warnings, and the raw PQL-like query that was executed. This is deliberate: the merchant should always be able to see how an answer was produced.

### Sample Questions the System Can Answer

The following examples reflect real capabilities wired through the intent pipeline:

**Demand and inventory:**
- "What is the demand forecast for the footwear category over the next 14 days?"
- "Which items in the outerwear category are trending upward in the next week?"
- "How has the demand forecast for the spring collection been adjusted based on today's higher-than-expected sell-through?"

**Churn and retention:**
- "Which high-value customers appeared on the churn list this evening after weekend sales concluded, and what immediate retention outreach is required?"
- "Which customers are most at risk of lapsing in the next 30 days?"
- "Show me the churn-at-risk segment for the loyalty tier with the highest revenue contribution."

**Recommendations and targeting:**
- "Which customers from our cold affinity segment should we target with Monday's email campaign to drive first-time purchases?"
- "Which dormant customer segments from our reverse recommendation list should be prioritized for a targeted win-back promotion tomorrow?"
- "Who are the top candidates to receive a personalized product recommendation for the new denim line?"

**Explainability:**
- "Why was customer 12345 flagged as high churn risk?"
- "What signals drove the demand forecast for the accessories category this week?"

**Operational:**
- "What is the current state of the KumoRFM graph?"
- "What predictive queries are available in my Kumo workspace?"

---

## Intelligence Board

The right-hand panel is the Intelligence Board, a live summary of the most important retail signals at any given moment. It loads from the sidecar's `/data/intelligence-board` endpoint via the Zustand store.

What the board surfaces:

- **Category demand** -- top-performing and at-risk categories with trend direction
- **Item demand** -- specific item-level signals where action is most needed
- **Churn-at-risk** -- a count and preview of customers who have crossed a risk threshold
- **Timeframe** -- the prediction window in effect (e.g., next 14 days)
- **Trust and health signals** -- graph mode, cache coverage percentage, link health (foreign key match rates), and sidecar connection status

When Kumo Cloud REST is configured, the board also shows a discovery strip listing active jobs and predictive queries from the tenant's Kumo workspace, with direct links to the Kumo Cloud console.

The board is always synchronized with the chat. When a chat response returns demand or churn data, the board can be refreshed to reflect the most current state. The merchant sees both the conversational answer and the always-on summary panel at the same time.

---

## Explainability

One of the most important features for building merchant trust is the ability to explain why a prediction was made. The Explain view loads per-customer prediction explanations from the sidecar, including:

- **Feature signals** -- which RFM features (recency, frequency, spend, category mix) had the most influence on the score
- **Peer context** -- how this customer compares to similar customers in the graph
- **Subgraph view** -- the local neighborhood of nodes and edges around this customer in the KumoRFM graph
- **Score breakdown** -- the model's confidence and contributing factors

The Explain view can be triggered from chat (by asking about a specific customer or entity) or directly from the board by drilling into a churn-at-risk customer. When triggered from chat, the right panel switches to the Explain view automatically and syncs the entity ID from the chat response.

This makes it possible to go from "who is at risk" to "why are they at risk" in a single conversation thread without leaving the interface.

---

## Daily Report

The Daily Report feature generates a branded, AI-curated PDF report on demand. The report is time-aware: in the morning hours the system recommends a Morning Briefing (plan-your-day orientation), and in the afternoon and evening it recommends an End-of-Day Recap (performance review orientation).

### How Report Generation Works

The pipeline has three stages:

1. **Question selection** -- A call to `/api/report/questions` sends the report type, current date, and timezone to Gemini. Gemini returns 5 retail analytics questions that are calibrated to the time of day and the reporting context. Morning questions focus on what to target, stock, and activate. End-of-day questions focus on what changed, what needs follow-up, and what to carry forward.

2. **Answer pipeline** -- The same two-step chat pipeline (intent, then narrate) that powers the chat copilot is run sequentially for each of the 5 questions. This means the report answers are generated by exactly the same logic as a live chat response. There is no separate reporting model and no separate data path. Every answer in the report is identical in quality and sourcing to what the merchant would get if they asked the same question directly in chat.

3. **PDF assembly** -- Once all 5 answers are collected, `@react-pdf/renderer` assembles a branded PDF client-side with a cover page, one section per question, and a summary page. The PDF is generated in the browser and downloaded directly without any server-side file storage.

### UI Flow

When the merchant clicks the report button in the header, a modal opens. Five skeleton cards appear immediately (the UI does not wait for the questions to load before showing structure). As the question fetch resolves, the skeletons are replaced by real question text. Each question then runs through the pipeline in sequence, with an animated pipeline visualizer showing which step is in progress, which are pending, and which are complete. When all 5 are done, the modal transitions to a download view.

### Why the Report Reflects Real Data

Because each report answer goes through the same intent and narration pipeline as a live chat message, the report is always grounded in the same predictions, the same sidecar data, and the same model outputs. The merchant can trust that what appears in the PDF is not a summary or an approximation. It is the same answer they would get from the copilot at that moment.

---

## Setup

### Prerequisites

- Node.js 20+
- Python 3.10+
- A Kumo API key (for the sidecar)
- A Google Gemini API key (for chat and reports)

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for intent, narration, and report question generation |
| `KUMO_API_KEY` | Yes | Kumo SDK authentication for the Python sidecar |
| `KUMO_SIDECAR_URL` | Optional | Sidecar base URL (defaults to `http://127.0.0.1:8000`) |
| `KUMO_REST_API_KEY` | Optional | Kumo Cloud REST API key (`customer_id:secret`) for job discovery; never exposed to the browser |
| `KUMO_REST_BASE_URL` | Optional | Kumo Cloud REST host (defaults to `https://api.kumo.ai`) |
| `KUMO_APP_BASE_URL` | Optional | Kumo Cloud console URL for deep links in the board discovery strip |
| `APP_URL` | Optional | Public app URL for deployed environments |

Security note: Never use `NEXT_PUBLIC_*` for any API key. All key usage is server-side only.

### Running Locally

**Step 1: Start the Python sidecar**

```bash
cd kumo-sidecar
python -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows
pip install -r requirements.txt
export KUMO_API_KEY=your_key    # Unix
# set KUMO_API_KEY=your_key     # Windows CMD
python main.py
```

The sidecar listens on `http://localhost:8000`.

**Step 2: Start the Next.js app**

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

**Step 3: Quality checks**

```bash
npm run lint
npm run test
npm run build
npm run clean    # clears the Next.js build cache
```

---

## Repository Layout

| Path | Purpose |
|------|---------|
| `app/` | Next.js App Router: `page.tsx`, `layout.tsx`, API routes under `app/api/` |
| `app/api/chat/` | Two-step intent and narration pipeline |
| `app/api/report/` | Report question generation endpoint |
| `app/api/kumo/` | Discovery, jobs, and webhook relay routes |
| `components/stylist/` | Main UI shell: `StylistApp`, header, composer, report trigger |
| `components/chat/` | Message bubbles, thinking indicator, trace UI, charts |
| `components/report/` | `ReportModal` (pipeline UI, skeleton loader) and `ReportDocument` (PDF layout) |
| `components/panels/` | Intelligence Board and Explain panel components |
| `lib/store.ts` | Zustand store: messages, board, explain state, sidecar health |
| `lib/constants/` | Gemini system prompts and capability definitions |
| `lib/chat/` | Intent payload normalization, discovery chip logic |
| `lib/utils/` | CSV export, saved queries, search, handoff helpers |
| `kumo-sidecar/` | Python FastAPI service wrapping the KumoRFM SDK |
| `.github/workflows/` | CI: lint, test, build |

---

## CI

GitHub Actions runs on every push to main. The pipeline runs:

1. `npm ci`
2. `npm run lint`
3. `npm run test`
4. `next build`

Configuration is in `.github/workflows/ci.yml`.

---

## Further Reading

- Sidecar details and CORS configuration: [kumo-sidecar/README.md](kumo-sidecar/README.md)
- Project architecture deep dive: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)
