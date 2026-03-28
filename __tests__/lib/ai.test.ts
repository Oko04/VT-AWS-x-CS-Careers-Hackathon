import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawAnalysis } from "../../types";

// ---------------------------------------------------------------------------
// Mock the Anthropic SDK before importing the module under test
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic };
});

// Import after mock is set up
const { analyzeDocument } = await import("../../lib/ai");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validRawAnalysis: RawAnalysis = {
  whatThisMeansForYou: "This contract binds you to monthly payments.",
  keyObligations: ["Pay $100/month", "Provide 30-day notice to cancel"],
  risks: [
    {
      clause: "Automatic renewal clause",
      explanation: "The contract renews automatically unless you cancel.",
    },
  ],
  whatYouAreAgreeingTo: ["Monthly subscription", "No refunds after 7 days"],
  claims: [
    {
      id: "123e4567-e89b-12d3-a456-426614174000",
      text: "Automatic renewal is enforceable",
      searchQuery: "automatic renewal contract enforceability",
    },
  ],
  isLegalDocument: true,
};

function makeSuccessResponse(analysis: RawAnalysis) {
  return {
    content: [{ type: "text", text: JSON.stringify(analysis) }],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("analyzeDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("valid legal document → returns RawAnalysis with all fields", async () => {
    mockCreate.mockResolvedValueOnce(makeSuccessResponse(validRawAnalysis));

    const signal = new AbortController().signal;
    const result = await analyzeDocument("This is a legal contract...", signal);

    expect(result.isLegalDocument).toBe(true);
    expect(result.whatThisMeansForYou).toBe(
      "This contract binds you to monthly payments."
    );
    expect(result.keyObligations).toHaveLength(2);
    expect(result.risks).toHaveLength(1);
    expect(result.whatYouAreAgreeingTo).toHaveLength(2);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].id).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("Anthropic 500 response → throws error", async () => {
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error("Internal Server Error"), { status: 500 })
    );

    const signal = new AbortController().signal;
    await expect(
      analyzeDocument("Some legal text", signal)
    ).rejects.toThrow("Internal Server Error");
  });

  it("AbortSignal aborted → throws AbortError", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    mockCreate.mockRejectedValueOnce(abortError);

    controller.abort();
    await expect(
      analyzeDocument("Some legal text", controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("isLegalDocument: false path → returns RawAnalysis with isLegalDocument: false", async () => {
    const nonLegalAnalysis: RawAnalysis = {
      whatThisMeansForYou: "",
      keyObligations: [],
      risks: [],
      whatYouAreAgreeingTo: [],
      claims: [],
      isLegalDocument: false,
    };

    mockCreate.mockResolvedValueOnce(makeSuccessResponse(nonLegalAnalysis));

    const signal = new AbortController().signal;
    const result = await analyzeDocument(
      "The weather today is sunny and warm.",
      signal
    );

    expect(result.isLegalDocument).toBe(false);
    expect(result.keyObligations).toEqual([]);
    expect(result.risks).toEqual([]);
    expect(result.whatYouAreAgreeingTo).toEqual([]);
    expect(result.claims).toEqual([]);
  });

  it("invalid JSON response → throws descriptive error", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "not valid json {{" }],
    });

    const signal = new AbortController().signal;
    await expect(
      analyzeDocument("Some legal text", signal)
    ).rejects.toThrow("Failed to parse JSON response from Claude");
  });
});
