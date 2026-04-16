import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function main() {
  const limitCount = 50;
  let pageToken;

  const responses = [];
  do {
    const page = await ai.models.list({
      config: { pageSize: limitCount, pageToken },
    });
    for (const model of page.models || page) {
      responses.push(model);
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  responses.filter(m => m.name.includes("gemini")).forEach(m => console.log(m.name));
}
main().catch(console.error);
