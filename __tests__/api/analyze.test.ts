import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the lib modules
vi.mock("../../lib/parser", () => ({
  parseDocument: vi.fn(),
  ParseError: class ParseError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ParseError";
    }
  },
}));

vi.mock("../../lib/ai", () => ({
  analyzeDocument: vi.fn(),
}));

vi.mock("../../lib/retrieval", () => ({
  fetchSources: vi.fn(),
}));

import { parseDocument, ParseError } from "../../lib/parser";
import { analyzeDocument } from "../../lib/ai";
import { fetchSources } from "../../lib/retrieval";
import { POST } from "../../app/api/analyze/route";
import type { RawAnalysis, Source } from "../../types";

const mockParseDocument = vi.mocked(parseDocument);
const mockAnalyzeDocument = vi.mocked(analyzeDocument);
const mockFetchSources = vi.mocked(fetchSources);

const baseRawAnalysis: RawAnalysis = {
  whatThisMeansForYou: "This is a contract summary.",
  keyObligations: ["Pay on time", "Deliver goods"],
  risks: [{ clause: "Clause 5", explanation: "Unlimited liability" }],
  whatYouAreAgreeingTo: ["You agree to terms"],
  claims: [{ id: "claim-1", text: "Claim text", searchQuery: "search query" }],
  isLegalDocument: true,
};

const mockSources: Source[] = [
  { claimId: "claim-1", title: "Smith v. Jones", url: "https://example.com/case", type: "caselaw" },
];

/** Build a mock NextRequest with a controlled formData() return value */
function makeRequest(formDataEntries: Record<string, string | File>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(formDataEntries)) {
    formData.append(key, value);
  }
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as import("next/server").NextRequest;
}

/** Create a File of a given byte size */
function makeFile(sizeBytes: number, name = "test.pdf"): File {
  // Use a small repeated buffer to avoid allocating huge arrays
  const chunk = new Uint8Array(Math.min(sizeBytes, 1024)).fill(0x25);
  const parts: Uint8Array[] = [];
  let remaining = sizeBytes;
  while (remaining > 0) {
    const slice = chunk.slice(0, Math.min(remaining, 1024));
    parts.push(slice);
    remaining -= slice.length;
  }
  return new File(parts, name, { type: "application/pdf" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/analyze", () => {
  it("returns 200 with AnalysisResponse for valid text input", async () => {
    mockParseDocument.mockResolvedValue("normalized legal text");
    mockAnalyzeDocument.mockResolvedValue(baseRawAnalysis);
    mockFetchSources.mockResolvedValue(mockSources);

    const req = makeRequest({ text: "This is a valid legal document text input." });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.whatThisMeansForYou).toBe("This is a contract summary.");
    expect(body.keyObligations).toEqual(["Pay on time", "Deliver goods"]);
    expect(body.backedByLaw).toEqual(mockSources);
    expect(body.isLegalDocument).toBe(true);
  });

  it("calls parseDocument with a Buffer when a PDF file is uploaded", async () => {
    mockParseDocument.mockResolvedValue("extracted pdf text");
    mockAnalyzeDocument.mockResolvedValue(baseRawAnalysis);
    mockFetchSources.mockResolvedValue(mockSources);

    const file = makeFile(1024); // 1 KB PDF
    const req = makeRequest({ file });
    await POST(req);

    expect(mockParseDocument).toHaveBeenCalledOnce();
    const arg = mockParseDocument.mock.calls[0][0];
    expect(Buffer.isBuffer(arg)).toBe(true);
  });

  it("returns 413 when PDF exceeds 10 MB", async () => {
    const tenMbPlusOne = 10 * 1024 * 1024 + 1;
    const file = makeFile(tenMbPlusOne);
    const req = makeRequest({ file });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body.error).toMatch(/10 MB/);
    expect(mockParseDocument).not.toHaveBeenCalled();
  });

  it("returns 400 with retryable: false when ParseError is thrown", async () => {
    mockParseDocument.mockRejectedValue(new ParseError("Could not read the PDF."));

    const file = makeFile(512);
    const req = makeRequest({ file });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Could not read the PDF. Please paste the text manually.");
    expect(body.retryable).toBe(false);
  });

  it("returns 504 with retryable: true when Anthropic times out (AbortError)", async () => {
    mockParseDocument.mockResolvedValue("some text");
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    mockAnalyzeDocument.mockRejectedValue(abortError);

    const req = makeRequest({ text: "Some legal document text here." });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(504);
    expect(body.error).toBe("Request timed out. Please try again.");
    expect(body.retryable).toBe(true);
  });

  it("returns 502 with retryable: true when Anthropic returns a 500 error", async () => {
    mockParseDocument.mockResolvedValue("some text");
    const apiError = new Error("APIError: status 500 Internal Server Error");
    apiError.name = "APIError";
    mockAnalyzeDocument.mockRejectedValue(apiError);

    const req = makeRequest({ text: "Some legal document text here." });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toBe("Analysis failed. Please try again.");
    expect(body.retryable).toBe(true);
  });

  it("returns 200 with sourcesUnavailable: true when fetchSources returns empty array", async () => {
    mockParseDocument.mockResolvedValue("legal text");
    mockAnalyzeDocument.mockResolvedValue(baseRawAnalysis);
    mockFetchSources.mockResolvedValue([]); // CAP unavailable — empty sources

    const req = makeRequest({ text: "A legal document with claims." });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.backedByLaw).toEqual([]);
    expect(body.sourcesUnavailable).toBe(true);
  });

  it("does not call fetchSources and returns 200 when isLegalDocument is false", async () => {
    const nonLegalAnalysis: RawAnalysis = {
      ...baseRawAnalysis,
      whatThisMeansForYou: "",
      keyObligations: [],
      risks: [],
      whatYouAreAgreeingTo: [],
      claims: [],
      isLegalDocument: false,
    };
    mockParseDocument.mockResolvedValue("hello world");
    mockAnalyzeDocument.mockResolvedValue(nonLegalAnalysis);

    const req = makeRequest({ text: "This is not a legal document at all." });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isLegalDocument).toBe(false);
    expect(body.backedByLaw).toEqual([]);
    expect(mockFetchSources).not.toHaveBeenCalled();
  });
});
