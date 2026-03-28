import Anthropic from "@anthropic-ai/sdk";
import type { RawAnalysis } from "../types";

const PROMPT = `You are a legal document analyzer. Analyze the provided legal document and respond ONLY with valid JSON matching this exact structure:

{
  "whatThisMeansForYou": "string summary in plain English",
  "keyObligations": ["bullet 1", "bullet 2"],
  "risks": [{ "clause": "original clause text", "explanation": "why it is a risk in plain English" }],
  "whatYouAreAgreeingTo": ["bullet 1", "bullet 2"],
  "claims": [{ "id": "uuid-v4", "text": "plain English claim", "searchQuery": "legal search terms for CAP/GovInfo" }],
  "isLegalDocument": true
}

Rules:
- Use plain English throughout; avoid legal jargon.
- If the text is NOT a legal document, return: { "whatThisMeansForYou": "", "keyObligations": [], "risks": [], "whatYouAreAgreeingTo": [], "claims": [], "isLegalDocument": false }
- For each claim in the "claims" array, generate a unique UUID v4 for the "id" field.
- Respond ONLY with the JSON object — no markdown, no explanation, no code fences.`;

export async function analyzeDocument(
  text: string,
  signal: AbortSignal
): Promise<RawAnalysis> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const message = await client.messages.create(
    {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${PROMPT}\n\nDocument:\n${text}`,
        },
      ],
    },
    { signal }
  );

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Anthropic API");
  }

  let parsed: RawAnalysis;
  try {
    parsed = JSON.parse(content.text) as RawAnalysis;
  } catch {
    throw new Error(
      `Failed to parse JSON response from Claude: ${content.text.slice(0, 200)}`
    );
  }

  return parsed;
}
