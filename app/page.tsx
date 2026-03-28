"use client";

import { useState } from "react";
import DocumentInput from "../components/DocumentInput";
import AnalysisOutput from "../components/AnalysisOutput";
import { AnalysisResponse, ErrorResponse } from "../types";

type Status = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryFormData, setRetryFormData] = useState<FormData | null>(null);

  async function submitFormData(formData: FormData) {
    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errBody: ErrorResponse = await res.json();
        setError(errBody.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      const data: AnalysisResponse = await res.json();
      setAnalysis(data);
      setStatus("success");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  function handleSubmit(formData: FormData) {
    setRetryFormData(formData);
    submitFormData(formData);
  }

  function handleRetry() {
    if (retryFormData) {
      submitFormData(retryFormData);
    }
  }

  const isLoading = status === "loading";

  return (
    <main className="min-h-screen bg-gray-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900">LegalEase</h1>
          <p className="mt-2 text-lg text-gray-600">
            Translate legal language into plain English
          </p>
        </header>

        {/* Input form */}
        <div className="rounded-xl bg-white p-6 shadow-sm mb-6">
          <DocumentInput
            onSubmit={handleSubmit}
            isLoading={isLoading}
            error={status === "error" ? error : null}
          />

          {/* Retry button */}
          {status === "error" && retryFormData && (
            <button
              onClick={handleRetry}
              className="mt-4 w-full rounded-md border border-blue-600 px-6 py-2 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Retry
            </button>
          )}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-3 rounded-xl bg-white p-8 shadow-sm text-gray-600"
          >
            <svg
              className="h-6 w-6 animate-spin text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span>Analyzing your document…</span>
          </div>
        )}

        {/* Analysis output */}
        {status === "success" && analysis !== null && (
          <AnalysisOutput
            analysis={analysis}
            sourcesUnavailable={analysis.sourcesUnavailable}
          />
        )}
      </div>
    </main>
  );
}
