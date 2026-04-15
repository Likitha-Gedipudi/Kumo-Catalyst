# Kumo Catalyst — Master Plan
### Conversational Retail Intelligence, Powered by KumoRFM
*Demo vehicle: H&M dataset | Production target: Any fashion or retail brand*

---

> **How to read this document**
> This plan has two clearly separated layers:
> - **THE PLAN** — Product vision, architecture, technical decisions, explainability integration. What you build.
> - **THE SCRIPT** — What you say out loud during the demo. Word-for-word guidance for the room.

---

# PART 1: THE PLAN

## 1.1 What This Is

Kumo Catalyst is a **conversational retail intelligence copilot** built on top of KumoRFM. It is not a recommendation engine. It is not a dashboard. It is a system that lets the business people at a fashion brand — heads of merchandising, CRM leads, buyers — ask questions about their customers and products in plain English and get answers grounded in real relational predictions.

The demo character: you are the Head of Merchandising at H&M. Monday morning. Planning meeting in 40 minutes. You open Stylist.

---

## 1.2 Positioning

| What It Is | What It Is Not |
|---|---|
| A retail intelligence copilot for business users | A data science notebook |
| Conversational, natural language interface | A dashboard with filters |
| Every answer grounded in live KumoRFM predictions | Hardcoded or pre-scripted responses |
| Generalizable to any fashion brand's data | An H&M-specific tool |

---

## 1.3 Dataset

**H&M Personalized Fashion Recommendations**

- Hosted by Kumo at `s3://kumo-sdk-public/rfm-datasets/online-shopping`
- Three tables: `customers`, `articles`, `transactions`
- Articles have image URLs — renders actual product thumbnails in chat
- Pre-validated by Kumo's own team, zero data wrangling needed
- Used in Kumo's own quickstart documentation — signals familiarity with their stack

**For real brand deployments:** swap the dataset, keep the interface. That is the product pitch.

---

## 1.4 Architecture

```
User (browser)
    ↓
React Frontend
  - Chat panel (left)
  - Intelligence board + explainability panel (right)
    ↓
FastAPI Backend (Python)
  - NL → PQL translation via Claude API
  - KumoRFM SDK calls
  - Result formatting + narration
  - Explainability data fetching
    ↓
KumoRFM Python SDK
  - Zero-shot predictions
  - Batch predictions (pre-cached for dashboard)
  - Subgraph + column importance data
    ↓
H&M Dataset (Kumo public S3)
```

**Frontend:** React. Premium UI using Kumo's pink as brand accent. Two-panel layout. Product image cards rendered inline in chat bubbles. Animated transitions. Think Vercel dashboard aesthetic applied to fashion retail.

**Backend:** Python, FastAPI. Handles LLM orchestration, PQL generation, SDK calls, result formatting, and explainability data assembly.

**LLM layer:** Claude API. System prompt includes full PQL syntax reference and H&M schema. Translates natural language to PQL, calls KumoRFM, interprets results, narrates in business language. The LLM never fabricates predictions — it only narrates what KumoRFM returns.

**Caching:** Pre-run batch predictions for all six demo questions on five specific customer IDs and three specific product IDs. Demo always runs clean. Live queries available for spontaneous exploration.

---

## 1.5 The Six Core Prediction Capabilities

Each maps to a real KumoRFM PQL query. The user never sees PQL — they see a business answer.

### Capability 1: Category Demand Forecasting
**Business question:** Which product categories are about to peak in the next 30 days?

KumoRFM reasoning: early-adopter purchase patterns extrapolated across the customer relationship network. Output: ranked category list with demand scores and the specific customer segments driving each surge.

**PQL pattern:**
```sql
PREDICT SUM(transactions.price, 0, 30, days)
FOR EACH articles.product_type_name
```

**Who acts on this:** Buyers deciding what to restock this week.

---

### Capability 2: Churn Prediction + Personalized Win-Back
**Business question:** Show me customers about to churn, and tell me what would bring each one back.

Two PQL queries chained. First: churn prediction across active customers. Second: for top churners, link prediction to find which unowned articles they're most likely to respond to.

**PQL pattern:**
```sql
-- Churn
PREDICT COUNT(transactions.*, 0, 90, days) = 0
FOR EACH customers.customer_id
WHERE COUNT(transactions.*, -60, 0, days) > 0

-- Win-back recommendation for churners
PREDICT LIST_DISTINCT(transactions.article_id, 0, 30, days) RANK TOP 5
FOR EACH customers.customer_id IN (<churn_list>)
```

**Who acts on this:** CRM team running retention campaigns.

---

### Capability 3: Reverse Recommendation (Dead Inventory Clearance)
**Business question:** This black midi skirt has been sitting in inventory for 8 weeks. Who in our customer base is most likely to buy it right now?

Runs link prediction in reverse — given a product, find the customers. Output: ranked customer list with purchase probability scores.

**PQL pattern:**
```sql
PREDICT LIST_DISTINCT(transactions.customer_id, 0, 30, days) RANK TOP 200
FOR EACH articles.article_id IN (<target_article_id>)
```

**Who acts on this:** Marketing team sending targeted push notifications.

---

### Capability 4: Cold Product Affinity
**Business question:** We're launching an activewear line. Which of our existing customers are most likely to engage with it, based on how they engage with similar categories?

KumoRFM uses graph structure of existing category relationships and behavioral patterns to score affinity for a product type with no transaction history. Genuinely something no standard ML model does cleanly.

**PQL pattern:**
```sql
PREDICT COUNT(transactions.*, 0, 90, days) > 0
FOR EACH customers.customer_id
WHERE transactions.product_type_name IN ('Sport', 'Swimwear', 'Outdoor')
```

**Who acts on this:** Product team validating a new category launch.

---

### Capability 5: Competitive Churn Risk
**Business question:** Who are our top 1000 customers most at risk of switching to a competitor this season?

Churn prediction with a business framing. Output includes top churn signals: declining purchase frequency, shift toward lower price points, narrowing category engagement.

**PQL pattern:**
```sql
PREDICT COUNT(transactions.*, 0, 90, days) = 0
FOR EACH customers.customer_id
WHERE COUNT(transactions.*, -180, 0, days) > 5
ORDER BY prediction DESC
LIMIT 1000
```

**Who acts on this:** Retention team prioritizing high-value saves.

---

### Capability 6: Explainability Trace — Why This Prediction?
**Business question:** Walk me through why customer 12808 was flagged as high churn risk. I want to understand the reasoning.

This is the explainability layer integration. See section 1.6 below for full detail.

---

## 1.6 Explainability Layer Integration

This is what elevates Kumo Catalyst from impressive to trustworthy — and trustworthy is what enterprise buyers pay for.

### What Kumo's API Exposes

Kumo provides three levels of explainability that Kumo Catalyst surfaces conversationally:

**Entity-level explainability:**
- Historical items vs ground truth vs predictions (the three-pane view)
- Pre-selected entity categories: true positives, false positives, false negatives, uncertain predictions, cold-start entities
- Up to 50 entities per category with anchor timestamps

**Subgraph visualization:**
- The exact subgraph used as model input for a given prediction
- Nested table layout traversing foreign key relationships
- Column importance scores per node generated via gradient backpropagation
- Ordered by recency — most recent signals appear first

**Global explainability:**
- Contribution scores per table and per column (variation of predictions %)
- Column analysis: distribution plots comparing predictions vs actual labels
- Data leakage detection: columns with disproportionately high variation scores

### How Kumo Catalyst Uses This

When the user asks "why did you flag this customer?" the agent:

1. Fetches the subgraph for that customer entity from Kumo's explainability API
2. Identifies the top 3-5 column importance signals from the gradient backpropagation scores
3. Narrates them in plain English: *"The strongest signal was this customer's declining transaction frequency — from 6 purchases in the prior 90 days to 1 in the last 90 days. Their club_member_status is inactive, and they've stopped receiving fashion news. Across 47 similar customers in the graph, this pattern preceded churn 82% of the time."*
4. Renders the subgraph data visually in the right panel — not as a nested table like Kumo's native UI, but as an actual node-edge graph showing the customer connected to their transactions, articles, and peer customers

### The Explainability Panel (Right Panel)

The right panel has three tabs that activate when an explainability query runs:

**Tab 1: Signal Breakdown**
Bar chart of column importance scores. Styled and readable — not the raw horizontal bars from Kumo's UI. Each bar is labeled with a plain English description of what the column means.

**Tab 2: Subgraph View**
An interactive node-edge graph. Customer node in the center. Transaction nodes radiating out, colored by recency (hot = recent, cool = old). Article nodes connected to transactions, sized by purchase frequency. This is the graph visualization that Kumo's own UI currently does NOT render — their subgraph is a nested table. This is genuine visual differentiation.

**Tab 3: Peer Comparison**
Shows the prediction distribution across similar customers — what percentage churned, what percentage retained, and where this specific customer sits on that distribution. Pulls from Kumo's column analysis data.

### Why This Matters In The Demo

The explainability layer turns a compelling demo into an enterprise-ready product. Without it, a skeptic in the room says "how do I know these predictions are right?" With it, you show them exactly why the model made each call, traceable to specific data points in their own tables. That is what closes enterprise deals.

---

## 1.7 Risk Mitigation

**Risk: KumoRFM free tier 1000 query/day limit**
Mitigation: Pre-cache all six demo capabilities for five specific customer IDs and three product IDs. All scripted demo moments use cached results. Live queries for spontaneous exploration only.

**Risk: NL to PQL translation fails on edge cases**
Mitigation: Claude system prompt includes full PQL syntax reference and H&M schema. Out-of-scope questions get a graceful fallback: "I can answer questions about customer predictions, product demand, and inventory targeting. Try asking me one of those."

**Risk: Prediction quality varies**
Mitigation: Run all predictions in advance, inspect outputs, and choose demo customer IDs where results are visually compelling and correct. Don't demo blind.

**Risk: Kumo SDK authentication in live demo**
Mitigation: Test the full stack at least 48 hours before the demo. Have a backup with all responses pre-recorded as a video if the live connection fails.

---

# PART 2: THE SCRIPT

> This is word-for-word guidance for what you say out loud in the room. Every line has a purpose.

---

## Before You Open The App

Say nothing. Open your laptop. Let them look at the screen as it loads. The intelligence board on the right panel is already populating with live data. Let the silence do the first 10 seconds of work.

Then:

*"I want to show you what it looks like when a fashion brand's entire customer and product graph becomes something you can just talk to."*

Pause. Don't rush it.

---

## Setting The Scene (30 seconds)

*"This is Kumo Catalyst — a retail intelligence copilot I built on KumoRFM, using the H&M dataset. The interface is designed for one specific person: the Head of Merchandising. Monday morning. Planning meeting in 40 minutes. They open this."*

Point at the right panel.

*"What you're seeing on the right is already live — trending categories, churn risk distribution, demand heatmap. All KumoRFM batch predictions, running on the actual H&M transaction graph."*

---

## Question 1: Category Demand Forecast (90 seconds)

Type into the chat: **"Which product categories are about to peak in the next 30 days?"**

Wait for the response. Let the ranked list appear. Let them read it.

*"This just replaced a Thursday afternoon data pull that used to take a team two hours and a slide deck. That's the first thing."*

---

## Question 2: Churn + Win-Back (90 seconds)

Type: **"Show me customers who are about to churn — and tell me what would actually bring them back."**

Watch the response populate — customer list with personalized product recommendations and actual product images appearing inline.

*"Two predictions chained. First, KumoRFM identified who's about to go silent based on their behavioral graph. Then it ran a second prediction: for each of those customers, what's the one product they're most likely to respond to. This is a campaign brief. It took thirty seconds."*

Point at a specific product image in the chat.

*"That recommendation didn't come from a rule. It came from looking at 1.3 million transactions across 100,000 customers and finding the relational pattern that connects this specific person to this specific product."*

---

## Question 3: Reverse Recommendation — The Moment (60 seconds)

Type: **"Article 835563007 — the black midi skirt — has been in inventory for 8 weeks. Who should we call?"**

Watch the room when the response comes back. A ranked list of customer IDs with purchase probabilities.

*"Most models go from customer to product. This one just ran in reverse — given a specific unsold product, it found the 200 customers most likely to buy it today. Your marketing team sends a push notification. Your inventory manager sleeps better."*

Don't say anything else. Give them a moment.

---

## Question 4: Cold Product Affinity (60 seconds)

Type: **"We're thinking of launching an activewear line. Which of our customers are most likely to engage with it?"**

*"There is no activewear in this dataset. No transactions, no history, nothing. KumoRFM is reasoning from the graph structure — how customers who buy sportswear adjacent categories behave, what their network connections look like, which demographic signals correlate with category expansion. It's giving a confident answer about a product that doesn't exist yet."*

---

## Question 5: Explainability Trace — The Trust Moment (90 seconds)

Click on the highest churn-risk customer from question 2. The right panel shifts to the explainability view.

Type: **"Why did you flag this customer as high churn risk? Walk me through it."**

The agent narrates: purchase frequency decline, inactive club status, no fashion news subscription. The subgraph panel shows the actual node-edge graph — the customer connected to their transaction history, the articles, the peer cluster.

*"This is not a black box. Every prediction has a chain of reasoning you can audit, traceable to specific columns in specific tables. You can see exactly which signals drove this call. That is what makes this enterprise-ready — not just impressive."*

Point at the subgraph graph view.

*"Kumo's own platform shows this as a nested table. I rendered it as an actual graph because that's what this data is — a graph. The relationships are the insight."*

---

## Close (30 seconds)

*"Everything you just saw is a live KumoRFM prediction over the H&M relational graph. No hardcoded answers. No pre-written responses. Every question I asked, the model reasoned over 1.3 million transactions, 100,000 customers, and 105,000 articles simultaneously to give that answer."*

Pause.

*"Drop in any fashion brand's data warehouse — same interface, same capabilities, same speed. That's Kumo Catalyst."*

---

## The Question They Will Ask

Someone will ask: *"What if the predictions are wrong?"*

Answer: *"That's exactly what the explainability layer is for. You don't have to trust the prediction — you can inspect the reasoning. If the model flagged a customer as churning and you know something the data doesn't, you can see exactly which signals drove that call and make an informed override. The model makes you faster. The explainability makes you confident."*

---

## What They Are Looking For In You — Decoded

| What They See | What They're Actually Evaluating |
|---|---|
| You built a full product, not a notebook | Full-stack execution ability |
| NL → PQL → KumoRFM → narrated results | LLM orchestration and tool use |
| The subgraph rendered as a node-edge graph | Product sense — you improved their own UI |
| Six distinct prediction capabilities | Depth of KumoRFM understanding |
| You demoed to a business buyer, not a data scientist | Customer-facing communication skills |
| You built this before the first interview | "Moves quickly from idea to prototype to ship" |
| The explainability layer | You understand what makes enterprise AI trustworthy |

---

## Naming

**Kumo Catalyst**

Not "H&M demo." Not "a Kumo module." A product name.

In the room you say: *"I called it Kumo Catalyst — because that's what it does. It knows your customers better than a human stylist would. Today it's running on H&M data. Connect any brand's warehouse and it works the same way."*

That one sentence shows the product is generalizable, shows you thought beyond the demo, and opens the door for the interviewer to mentally place it in front of their actual customers.

---

*Built by Manoj | Powered by KumoRFM*
