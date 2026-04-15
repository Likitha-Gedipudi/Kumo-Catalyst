import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      reportType,
      date,
      timezone,
      hour,
    }: {
      reportType: "morning" | "eod";
      date: string;
      timezone: string;
      hour: number;
    } = body;

    if (reportType !== "morning" && reportType !== "eod") {
      return NextResponse.json({ error: "Invalid reportType" }, { status: 400 });
    }

    const timeContext =
      reportType === "morning"
        ? "start of the business day — planning ahead, deciding what to act on"
        : "end of the business day — reviewing performance, identifying risks, planning follow-up";

    const focusGuidance =
      reportType === "morning"
        ? "Focus on: which customers to target today, which categories are forecast to peak, which campaigns to launch, which inventory to prioritize."
        : "Focus on: how demand performed vs forecast, which customers moved to high churn risk, what segments showed growth, what actions to carry forward tomorrow.";

    const prompt = `You are an AI assistant for a retail merchandising and analytics team at a fashion retailer.

Generate exactly 5 distinct retail analytics questions for a ${reportType === "morning" ? "Morning Briefing" : "End-of-Day Recap"} report.

Context:
- Today: ${date}
- Local time: ${hour}:00 (${timezone})
- Report purpose: ${timeContext}
- ${focusGuidance}

Available analytics capabilities (use each at most twice, vary across capabilities):
- demand_forecast: Product category demand forecasts for the coming days/weeks
- churn_list: Customers at high risk of churning who need retention action
- reverse_rec: Lapsed customers to win back with promotions
- cold_affinity: New or untapped customer segments to target for first-time purchases

Rules:
- Each question must be a complete, specific, actionable retail question
- Questions should collectively cover at least 3 different capabilities
- Make them feel natural — like a head of merchandising would ask them
- Do NOT number the questions or add any prefix
- Return ONLY valid JSON, no markdown fences, no explanation

JSON format:
{"questions":["question 1","question 2","question 3","question 4","question 5"]}`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });

    const raw = response.text ?? "";
    let parsed: { questions?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Kumo AI returned malformed JSON", raw },
        { status: 502 }
      );
    }

    const questions = Array.isArray(parsed?.questions)
      ? (parsed.questions as unknown[])
          .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
          .slice(0, 5)
      : [];

    // Pad to 5 with sensible defaults if fewer were returned
    const defaults = {
      morning: [
        "Which customer segments are at highest churn risk today?",
        "Which product categories are forecast to peak in demand this week?",
        "Which lapsed customers should we target with a win-back campaign today?",
        "Which new customer segments show the strongest affinity for our latest collection?",
        "Which inventory categories should we prioritize for restocking this morning?",
      ],
      eod: [
        "Which customers moved to high churn risk today?",
        "How did demand forecasts compare to actual category performance today?",
        "Which win-back customers are most likely to convert with a follow-up campaign?",
        "Which cold-start customer segments showed the most growth today?",
        "What key actions should we carry forward based on today's performance?",
      ],
    };

    while (questions.length < 5) {
      questions.push(defaults[reportType][questions.length]);
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("[report/questions] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate questions", details: String(error) },
      { status: 500 }
    );
  }
}
