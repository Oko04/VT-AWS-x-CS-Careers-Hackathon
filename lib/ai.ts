import Anthropic from "@anthropic-ai/sdk";
import type { RawAnalysis } from "../types";

const PROMPT = `You are a legal document analyzer. Analyze the provided legal document and respond ONLY with valid JSON matching this exact structure:

{
  "whatThisMeansForYou": "string summary in plain English",
  "keyObligations": ["bullet 1", "bullet 2"],
  "risks": [{ "clause": "original clause text", "explanation": "why it is a risk in plain English" }],
  "whatYouAreAgreeingTo": ["bullet 1", "bullet 2"],
  "claims": [{ "id": "uuid-v4", "text": "plain English claim", "searchQuery": "legal search terms" }],
  "isLegalDocument": true
}

Rules:
- Use plain English throughout; avoid legal jargon.
- If the text is NOT a legal document, return: { "whatThisMeansForYou": "", "keyObligations": [], "risks": [], "whatYouAreAgreeingTo": [], "claims": [], "isLegalDocument": false }
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
    max_tokens: 4096,
    messages: [{ role: "user", content: userContent }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Anthropic API");
  }

  let parsed: RawAnalysis;
  try {
    const raw = content.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    parsed = JSON.parse(raw) as RawAnalysis;
  } catch {
    throw new Error(
      `Failed to parse JSON response from Claude: ${content.text.slice(0, 200)}`
    );
  }

  return parsed;
}
