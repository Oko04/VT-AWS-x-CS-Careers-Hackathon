"use client";

import { AnalysisResponse, RiskItem, Source } from "../types";

interface AnalysisOutputProps {
  analysis: AnalysisResponse;
  sourcesUnavailable?: boolean;
}

export default function AnalysisOutput({
  analysis,
  sourcesUnavailable,
}: AnalysisOutputProps) {
  if (!analysis.isLegalDocument) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-yellow-300 bg-yellow-50 p-6 text-yellow-800"
      >
        This doesn&apos;t appear to be a legal document. Please submit a
        contract, policy, or legislation.
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {sourcesUnavailable && (
        <div
          role="status"
          className="rounded-md border border-orange-300 bg-orange-50 p-4 text-orange-800"
        >
          Legal sources are temporarily unavailable.
        </div>
      )}

      {/* What This Means For You */}
      <section
        aria-labelledby="heading-summary"
        className="bg-gray-50 border border-gray-200 rounded-lg p-6"
      >
        <h2
          id="heading-summary"
          className="mb-3 text-lg font-semibold text-gray-900"
        >
          What This Means For You
        </h2>
        <p className="text-gray-700">{analysis.whatThisMeansForYou}</p>
      </section>

      {/* Key Obligations */}
      <section
        aria-labelledby="heading-obligations"
        data-section="key-obligations"
        className="bg-blue-50 border border-blue-300 rounded-lg p-6"
      >
        <h2
          id="heading-obligations"
          className="mb-3 text-lg font-semibold text-blue-900"
        >
          Key Obligations
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-blue-800">
          {analysis.keyObligations.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      {/* Risks */}
      <section
        aria-labelledby="heading-risks"
        data-section="risks"
        className="bg-red-50 border border-red-300 rounded-lg p-6"
      >
        <h2
          id="heading-risks"
          className="mb-3 text-lg font-semibold text-red-900"
        >
          Risks
        </h2>
        <ul className="space-y-3">
          {analysis.risks.map((risk: RiskItem, i) => (
            <li key={i}>
              <p className="font-medium text-red-800">{risk.clause}</p>
              <p className="text-red-700">{risk.explanation}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* What You Are Agreeing To */}
      <section
        aria-labelledby="heading-agreeing"
        data-section="what-you-are-agreeing-to"
        className="bg-green-50 border border-green-300 rounded-lg p-6"
      >
        <h2
          id="heading-agreeing"
          className="mb-3 text-lg font-semibold text-green-900"
        >
          What You Are Agreeing To
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-green-800">
          {analysis.whatYouAreAgreeingTo.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>

      {/* Backed by Law */}
      <section
        aria-labelledby="heading-law"
        className="bg-white border border-gray-200 rounded-lg p-6"
      >
        <h2
          id="heading-law"
          className="mb-3 text-lg font-semibold text-gray-900"
        >
          Backed by Law
        </h2>
        {analysis.backedByLaw.length === 0 ? (
          <p className="text-gray-500">No citations available.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.backedByLaw.map((source: Source, i) => (
              <li key={i}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
