/** User-facing messages when the chat client hits network or config errors. */
export function chatClientErrorMessage(err: unknown): string {
  const isNetwork =
    err instanceof TypeError &&
    (String(err.message).includes("fetch") || String(err.message).includes("Load failed"));
  if (isNetwork) {
    return "Could not reach this app’s API. Keep `npm run dev` running and use the same URL you started it with (for example http://localhost:3000).";
  }
  return "Something went wrong. Ensure the Python sidecar is on port 8000 and GEMINI_API_KEY is set for chat.";
}
