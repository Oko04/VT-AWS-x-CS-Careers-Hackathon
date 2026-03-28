import { NextRequest, NextResponse } from "next/server";
import { parseDocument, ParseError } from "../../../lib/parser";
import { analyzeDocument } from "../../../lib/ai";
import { fetchSources } from "../../../lib/retrieval";
import type { AnalysisResponse, ErrorResponse } from "../../../types";

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
const ANTHROPIC_TIMEOUT_MS = 30_000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = crypto.randomUUID();

  try {
    const formData = await request.formData();
    const textField = formData.get("text");
    const fileField = formData.get("file");

    // Determine input: file takes precedence over text
    let input: string | Buffer;

    if (fileField instanceof File) {
      if (fileField.size > MAX_PDF_BYTES) {
        return NextResponse.json<ErrorResponse>(
          { error: "PDF file exceeds the 10 MB size limit. Please upload a smaller file or paste the text manually.", retryable: false },
          { status: 413 }
        );
      }
      const arrayBuffer = await fileField.arrayBuffer();
      input = Buffer.from(arrayBuffer);
    } else if (typeof textField === "string") {
      input = textField;
    } else {
      return NextResponse.json<ErrorResponse>(
        { error: "No document provided. Please paste text or upload a PDF.", retryable: false },
        { status: 400 }
      );
    }

    // Parse document
    const text = await parseDocument(input);

    // Analyze with Anthropic (30-second timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

    let rawAnalysis;
    try {
      rawAnalysis = await analyzeDocument(text, controller.signal);
    } finally {
      clearTimeout(timeoutId);
    }

    // If not a legal document, skip retrieval
    if (!rawAnalysis.isLegalDocument) {
      const response: AnalysisResponse = {
        whatThisMeansForYou: rawAnalysis.whatThisMeansForYou,
        keyObligations: rawAnalysis.keyObligations,
        risks: rawAnalysis.risks,
        whatYouAreAgreeingTo: rawAnalysis.whatYouAreAgreeingTo,
        backedByLaw: [],
        isLegalDocument: false,
      };
      return NextResponse.json<AnalysisResponse>(response, { status: 200 });
    }

    // Fetch sources (catch separately for graceful degradation)
    let sources = [];
    let sourcesUnavailable = false;
    try {
      sources = await fetchSources(rawAnalysis.claims);
      if (sources.length === 0 && rawAnalysis.claims.length > 0) {
        sourcesUnavailable = true;
      }
    } catch {
      sourcesUnavailable = true;
    }

    const response: AnalysisResponse = {
      whatThisMeansForYou: rawAnalysis.whatThisMeansForYou,
      keyObligations: rawAnalysis.keyObligations,
      risks: rawAnalysis.risks,
      whatYouAreAgreeingTo: rawAnalysis.whatYouAreAgreeingTo,
      backedByLaw: sources,
      isLegalDocument: true,
      ...(sourcesUnavailable && { sourcesUnavailable: true }),
    };

    return NextResponse.json<AnalysisResponse>(response, { status: 200 });
  } catch (err) {
    // ParseError — corrupt/unreadable PDF
    if (err instanceof ParseError) {
      return NextResponse.json<ErrorResponse>(
        { error: "Could not read the PDF. Please paste the text manually.", retryable: false },
        { status: 400 }
      );
    }

    // AbortError — Anthropic timeout
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json<ErrorResponse>(
        { error: "Request timed out. Please try again.", retryable: true },
        { status: 504 }
      );
    }

    // Anthropic API errors (4xx/5xx from the SDK)
    if (err instanceof Error && (err.message.includes("status") || err.constructor.name.includes("APIError") || err.constructor.name.includes("Anthropic"))) {
      return NextResponse.json<ErrorResponse>(
        { error: "Analysis failed. Please try again.", retryable: true },
        { status: 502 }
      );
    }

    // Unhandled exception — log with correlationId, never expose internals
    console.error(`[${correlationId}] Unhandled error in /api/analyze:`, err);
    return NextResponse.json<ErrorResponse>(
      { error: "Something went wrong. Please try again.", retryable: true },
      { status: 500 }
    );
  }
}
