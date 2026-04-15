import { NextResponse } from "next/server";

/**
 * Server-side relay for alert rules: forwards payload to the configured webhook URL
 * when the client sends a test or when a future cron invokes this route.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const targetUrl = body?.forwardTo;
    if (typeof targetUrl === "string" && /^https?:\/\//i.test(targetUrl)) {
      const { forwardTo: _f, ...rest } = body;
      await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rest, relayedBy: "kumo-stylist" }),
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, received: body });
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
}
