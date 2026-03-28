// Feature: legal-ease
// Property 5: Analysis response contains all five sections
// Property 7: Citation links open in a new tab
// Property 8: Section color indicators are present

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import * as fc from "fast-check";
import "@testing-library/jest-dom";
import AnalysisOutput from "../../components/AnalysisOutput";
import type { AnalysisResponse, Source, RiskItem } from "../../types";

// ─── Arbitraries ────────────────────────────────────────────────────────────

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 80 });

const arbRiskItem: fc.Arbitrary<RiskItem> = fc.record({
  clause: arbNonEmptyString,
  explanation: arbNonEmptyString,
});

const arbSource: fc.Arbitrary<Source> = fc.record({
  claimId: fc.uuid(),
  title: arbNonEmptyString,
  url: fc.webUrl(),
  type: fc.constantFrom("caselaw" as const, "statute" as const),
});

const arbAnalysisResponse = (isLegalDocument: boolean): fc.Arbitrary<AnalysisResponse> =>
  fc.record({
    whatThisMeansForYou: arbNonEmptyString,
    keyObligations: fc.array(arbNonEmptyString, { minLength: 1, maxLength: 5 }),
    risks: fc.array(arbRiskItem, { minLength: 1, maxLength: 3 }),
    whatYouAreAgreeingTo: fc.array(arbNonEmptyString, { minLength: 1, maxLength: 5 }),
    backedByLaw: fc.array(arbSource, { minLength: 0, maxLength: 5 }),
    isLegalDocument: fc.constant(isLegalDocument),
  });

// ─── Property 5: All five section headings are rendered ─────────────────────

describe("Property 5: Analysis response contains all five sections", () => {
  it("renders all five section headings for any valid legal AnalysisResponse", () => {
    // Feature: legal-ease, Property 5: Analysis response contains all five sections
    fc.assert(
      fc.property(arbAnalysisResponse(true), (analysis) => {
        const { unmount } = render(<AnalysisOutput analysis={analysis} />);

        expect(screen.getByText("What This Means For You")).toBeInTheDocument();
        expect(screen.getByText("Key Obligations")).toBeInTheDocument();
        expect(screen.getByText("Risks")).toBeInTheDocument();
        expect(screen.getByText("What You Are Agreeing To")).toBeInTheDocument();
        expect(screen.getByText("Backed by Law")).toBeInTheDocument();

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 7: Citation links open in a new tab ───────────────────────────

describe("Property 7: Citation links open in a new tab", () => {
  it("every anchor in Backed by Law has target=_blank, rel=noopener noreferrer, and correct href", () => {
    // Feature: legal-ease, Property 7: Citation links open in a new tab
    fc.assert(
      fc.property(
        fc.array(arbSource, { minLength: 1, maxLength: 6 }),
        (sources) => {
          const analysis: AnalysisResponse = {
            whatThisMeansForYou: "Summary",
            keyObligations: ["Obligation 1"],
            risks: [{ clause: "Clause", explanation: "Explanation" }],
            whatYouAreAgreeingTo: ["Agreement 1"],
            backedByLaw: sources,
            isLegalDocument: true,
          };

          const { unmount, container } = render(<AnalysisOutput analysis={analysis} />);

          const anchors = container.querySelectorAll("a");
          expect(anchors.length).toBe(sources.length);

          sources.forEach((source, i) => {
            const anchor = anchors[i] as HTMLAnchorElement;
            expect(anchor.getAttribute("target")).toBe("_blank");
            expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
            expect(anchor.getAttribute("href")).toBe(source.url);
          });

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 8: Section color indicators are present ───────────────────────

describe("Property 8: Section color indicators are present", () => {
  it("blue on Key Obligations, red on Risks, green on What You Are Agreeing To", () => {
    // Feature: legal-ease, Property 8: Section color indicators are present
    fc.assert(
      fc.property(arbAnalysisResponse(true), (analysis) => {
        const { unmount, container } = render(<AnalysisOutput analysis={analysis} />);

        const obligationsSection = container.querySelector('[data-section="key-obligations"]');
        const risksSection = container.querySelector('[data-section="risks"]');
        const agreeingSection = container.querySelector('[data-section="what-you-are-agreeing-to"]');

        expect(obligationsSection).not.toBeNull();
        expect(risksSection).not.toBeNull();
        expect(agreeingSection).not.toBeNull();

        expect(obligationsSection!.className).toContain("bg-blue-50");
        expect(obligationsSection!.className).toContain("border-blue-300");

        expect(risksSection!.className).toContain("bg-red-50");
        expect(risksSection!.className).toContain("border-red-300");

        expect(agreeingSection!.className).toContain("bg-green-50");
        expect(agreeingSection!.className).toContain("border-green-300");

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Unit tests: UI states ───────────────────────────────────────────────────

describe("AnalysisOutput unit tests", () => {
  const baseAnalysis: AnalysisResponse = {
    whatThisMeansForYou: "This contract binds you to monthly payments.",
    keyObligations: ["Pay monthly", "Notify within 30 days"],
    risks: [{ clause: "Auto-renewal clause", explanation: "Renews without notice." }],
    whatYouAreAgreeingTo: ["Monthly subscription", "No refunds"],
    backedByLaw: [
      {
        claimId: "c1",
        title: "Smith v. Jones, 123 F.3d 456",
        url: "https://example.com/case/123",
        type: "caselaw",
      },
    ],
    isLegalDocument: true,
  };

  it("renders 'not a legal document' message when isLegalDocument is false", () => {
    const analysis: AnalysisResponse = { ...baseAnalysis, isLegalDocument: false };
    render(<AnalysisOutput analysis={analysis} />);
    expect(
      screen.getByText(
        /This doesn't appear to be a legal document\. Please submit a contract, policy, or legislation\./i
      )
    ).toBeInTheDocument();
  });

  it("does not render section headings when isLegalDocument is false", () => {
    const analysis: AnalysisResponse = { ...baseAnalysis, isLegalDocument: false };
    render(<AnalysisOutput analysis={analysis} />);
    expect(screen.queryByText("What This Means For You")).not.toBeInTheDocument();
    expect(screen.queryByText("Key Obligations")).not.toBeInTheDocument();
  });

  it("renders 'sources unavailable' notice when sourcesUnavailable is true", () => {
    render(<AnalysisOutput analysis={baseAnalysis} sourcesUnavailable={true} />);
    expect(screen.getByText("Legal sources are temporarily unavailable.")).toBeInTheDocument();
  });

  it("does not render sources unavailable notice when sourcesUnavailable is false", () => {
    render(<AnalysisOutput analysis={baseAnalysis} sourcesUnavailable={false} />);
    expect(
      screen.queryByText("Legal sources are temporarily unavailable.")
    ).not.toBeInTheDocument();
  });

  it("renders citation links with correct href, target, and rel", () => {
    render(<AnalysisOutput analysis={baseAnalysis} />);
    const link = screen.getByRole("link", { name: "Smith v. Jones, 123 F.3d 456" });
    expect(link).toHaveAttribute("href", "https://example.com/case/123");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders all five sections for a valid legal document", () => {
    render(<AnalysisOutput analysis={baseAnalysis} />);
    expect(screen.getByText("What This Means For You")).toBeInTheDocument();
    expect(screen.getByText("Key Obligations")).toBeInTheDocument();
    expect(screen.getByText("Risks")).toBeInTheDocument();
    expect(screen.getByText("What You Are Agreeing To")).toBeInTheDocument();
    expect(screen.getByText("Backed by Law")).toBeInTheDocument();
  });

  it("renders key obligations as list items", () => {
    render(<AnalysisOutput analysis={baseAnalysis} />);
    expect(screen.getByText("Pay monthly")).toBeInTheDocument();
    expect(screen.getByText("Notify within 30 days")).toBeInTheDocument();
  });

  it("renders risk clause and explanation", () => {
    render(<AnalysisOutput analysis={baseAnalysis} />);
    expect(screen.getByText("Auto-renewal clause")).toBeInTheDocument();
    expect(screen.getByText("Renews without notice.")).toBeInTheDocument();
  });

  it("shows 'No citations available' when backedByLaw is empty", () => {
    const analysis: AnalysisResponse = { ...baseAnalysis, backedByLaw: [] };
    render(<AnalysisOutput analysis={analysis} />);
    expect(screen.getByText("No citations available.")).toBeInTheDocument();
  });
});
