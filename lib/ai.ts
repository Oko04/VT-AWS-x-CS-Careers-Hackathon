import Anthropic from "@anthropic-ai/sdk";
import type { RawAnalysis } from "../types";

const PROMPT = `You are a legal document analyzer. Analyze the provided legal document and respond ONLY with valid JSON matching this exact structure:

{
  "whatThisMeansForYou": "2-3 sentence plain English summary of the whole document",
  "keyObligations": ["short bullet describing what the user must do", "..."],
  "risks": [{ "clause": "brief 10-15 word quote or label identifying the risky clause", "explanation": "1-2 sentences explaining why this is a risk in plain English" }],
  "whatYouAreAgreeingTo": ["short plain English bullet of each commitment", "..."],
  "personalDataCollected": ["e.g. Email address", "Location data", "Browsing history", "..."],
  "claims": [{ "id": "uuid-v4", "text": "plain English claim", "searchQuery": "legal search terms" }],
  "isLegalDocument": true
}

Rules:
- Use plain English throughout; avoid legal jargon.
- Keep every bullet point and explanation concise — one sentence max.
- For "clause" in risks: use a SHORT label or brief quote (max 15 words), NOT the full clause text.
- For "personalDataCollected": list each specific type of personal data the document says is collected or required. If the document does not mention personal data collection, return an empty array [].
- If the text is NOT a legal document, return: { "whatThisMeansForYou": "", "keyObligations": [], "risks": [], "whatYouAreAgreeingTo": [], "personalDataCollected": [], "claims": [], "isLegalDocument": false }
- For each claim in the "claims" array, generate a unique UUID v4 for the "id" field.
- Respond ONLY with the JSON object — no markdown, no explanation, no code fences.`;

export async function analyzeDocument(
  input: string | Buffer,
  _signal: AbortSignal
): Promise<RawAnalysis> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build the message content — text or native PDF
  const userContent: Anthropic.MessageParam["content"] = typeof input === "string"
    ? `${PROMPT}\n\nDocument:\n${input}`
    : [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: input.toString("base64"),
          },
        } as Anthropic.DocumentBlockParam,
        {
          type: "text",
          text: PROMPT,
        },
      ];

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 16000,
    messages: [{ role: "user", content: userContent }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Anthropic API");
  }

  let parsed: RawAnalysis;
  try {
    // Extract JSON object regardless of markdown wrapping or extra text
    const firstBrace = content.text.indexOf("{");
    const lastBrace = content.text.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No JSON object found in response");
    }
    const raw = content.text.slice(firstBrace, lastBrace + 1);
    parsed = JSON.parse(raw) as RawAnalysis;
  } catch {
    throw new Error(
      `Failed to parse JSON response from Claude: ${content.text.slice(0, 200)}`
    );
  }

  return parsed;
}
