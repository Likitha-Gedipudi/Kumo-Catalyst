# Kumo Feature Roadmap

This roadmap translates the highest-value Kumo documentation themes into repo-specific implementation work.

## Principles

- Chat answers the question.
- Intelligence Board validates trust, explains why, and suggests the next action.
- Explainability remains the drill-down surface.

## Priority 1: Necessary Now

### 1. Graph Link Health

Why:
- Bad joins invalidate every prediction.
- Kumo graph creation guidance emphasizes checking link quality before trusting downstream outputs.

Deliver:
- Surface `orders.user_id -> users.user_id` coverage
- Surface `orders.item_id -> items.item_id` coverage
- Warn when match rates drop below a safe threshold

Repo touchpoints:
- `kumo-sidecar/main.py`
- `lib/types.ts`
- `lib/store.ts`
- `app/page.tsx`

Status:
- Implemented

### 2. Backend Trust & Health Diagnostics

Why:
- The board should show actual graph/cache/runtime health, not UI placeholders.

Deliver:
- Graph build timestamps
- Cache warm timestamps
- Cache coverage
- Warning state
- Last prediction metadata

Repo touchpoints:
- `kumo-sidecar/main.py`
- `lib/types.ts`
- `lib/store.ts`
- `app/page.tsx`

Status:
- Implemented

### 3. Explainability Availability as Trust Signal

Why:
- If explainability is unavailable, trust should drop.

Deliver:
- Board card for explainability readiness by task
- Warning when explainability is missing or partial

Repo touchpoints:
- `components/ExplainPanel.tsx`
- `app/page.tsx`
- `lib/store.ts`

Status:
- Partial

## Priority 2: High Value Next

### 4. Evaluation Metrics by Task Type

Why:
- Demand, churn, and recommendation tasks should not share one generic confidence score.

Deliver:
- Churn: `AUROC`, `AUPRC`
- Demand: `MAE`, `SMAPE`
- Reverse rec / affinity: `Precision@K`, `Recall@K`

Repo touchpoints:
- `kumo-sidecar/main.py`
- `lib/types.ts`
- `app/page.tsx`

Notes:
- Best implemented as offline / cached evaluation snapshots.
- Should be tied to a fixed evaluation window.

### 5. Baseline Comparison

Why:
- A trust signal is stronger when the app can say the model beats a simple baseline.

Deliver:
- Demand vs naive historical baseline
- Churn vs simple recency/frequency baseline
- Recommendation vs popularity baseline

Repo touchpoints:
- `kumo-sidecar/main.py`
- `app/page.tsx`

### 6. Fresh Batch / Run Status

Why:
- Merchandisers care when the intelligence was last operationalized, not just when the app loaded.

Deliver:
- Last successful batch-like prediction run
- Last refresh timestamp by task
- Clear stale warning

Repo touchpoints:
- `kumo-sidecar/main.py`
- `app/page.tsx`

## Priority 3: Useful But Not Urgent

### 7. Admin / Debug Mode

Deliver:
- Show active PQL, task type, and evaluation snapshots
- Show cache keys and backend diagnostics in more detail

### 8. Scheduled Batch Workflows

Deliver:
- Daily churn snapshots
- Daily inventory targeting lists
- Weekly demand outlooks

## Not Necessary Right Now

- In-app graph/table editing workflows
- Full metrics customization UI
- End-user graph creation flows

## Suggested Order

1. Link health and runtime diagnostics
2. Evaluation snapshots
3. Baseline comparisons
4. Batch freshness / scheduled runs
5. Admin mode
