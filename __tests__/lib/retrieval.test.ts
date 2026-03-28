// Feature: legal-ease, Property 6: Retrieval cascade — CAP first, GovInfo fallback, omit on miss

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { fetchSources } from "../../lib/retrieval";
import type { Claim } from "../../types";

// ---------------------------------------------------------------------------
// Helpers to build mock fetch responses
// ---------------------------------------------------------------------------

function capResponse(hasResult: boolean, name = "Smith v. Jones", url = "https://cap.example/1") {
  return {
    ok: true,
    json: async () => ({
      results: hasResult ? [{ id: "1", name_abbreviation: name, frontend_url: url }] : [],
    }),
  };
}

function govInfoResponse(
  hasResult: boolean,
  title = "U.S.C. § 1",
  detailsLink = "https://govinfo.example/1"
) {
  return {
    ok: true,
    json: async () => ({
      results: {
        packages: hasResult ? [{ packageId: "pkg1", title, detailsLink }] : [],
      },
    }),
  };
}

function makeClaim(id: string, searchQuery: string): Claim {
  return { id, text: `claim ${id}`, searchQuery };
}

// ---------------------------------------------------------------------------
// Property 6 — PBT
// ---------------------------------------------------------------------------

describe("Property 6: Retrieval cascade", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("CAP has results → Source from CAP, GovInfo not called", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        async (id, query) => {
          const govInfoSpy = vi.fn();
          vi.stubGlobal(
            "fetch",
            vi.fn((url: string) => {
              if (url.includes("case.law")) {
                return Promise.resolve(capResponse(true));
              }
              govInfoSpy();
              return Promise.resolve(govInfoResponse(true));
            })
          );

          const claims = [makeClaim(id, query)];
          const sources = await fetchSources(claims);

          expect(sources).toHaveLength(1);
          expect(sources[0].type).toBe("caselaw");
          expect(sources[0].claimId).toBe(id);
          expect(govInfoSpy).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("CAP empty + GovInfo has results → Source from GovInfo", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        async (id, query) => {
          vi.stubGlobal(
            "fetch",
            vi.fn((url: string) => {
              if (url.includes("case.law")) {
                return Promise.resolve(capResponse(false));
              }
              return Promise.resolve(govInfoResponse(true));
            })
          );

          const claims = [makeClaim(id, query)];
          const sources = await fetchSources(claims);

          expect(sources).toHaveLength(1);
          expect(sources[0].type).toBe("statute");
          expect(sources[0].claimId).toBe(id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("both empty → no Source for that claim", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            query: fc.string({ minLength: 1, maxLength: 30 }),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (claimDefs) => {
          vi.stubGlobal(
            "fetch",
            vi.fn((url: string) => {
              if (url.includes("case.law")) {
                return Promise.resolve(capResponse(false));
              }
              return Promise.resolve(govInfoResponse(false));
            })
          );

          const claims = claimDefs.map((c) => makeClaim(c.id, c.query));
          const sources = await fetchSources(claims);

          expect(sources).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — error scenarios
// ---------------------------------------------------------------------------

describe("fetchSources error scenarios", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("CAP unavailable (fetch throws) → returns empty Source[]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network error")))
    );

    const sources = await fetchSources([makeClaim("c1", "breach of contract")]);
    expect(sources).toEqual([]);
  });

  it("both APIs unavailable → returns empty Source[]", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network error")))
    );

    const claims = [
      makeClaim("c1", "breach of contract"),
      makeClaim("c2", "negligence"),
    ];
    const sources = await fetchSources(claims);
    expect(sources).toEqual([]);
  });

  it("10-second timeout per claim → claim omitted, no crash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<never>((_, reject) => {
            // Simulate AbortError (timeout)
            const err = new DOMException("The operation was aborted.", "AbortError");
            setTimeout(() => reject(err), 0);
          })
      )
    );

    const sources = await fetchSources([makeClaim("c1", "due process")]);
    expect(sources).toEqual([]);
  });

  it("returns sources only for claims where at least one API succeeds", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        callCount++;
        // First claim: CAP succeeds; second claim: both fail
        if (url.includes("case.law") && callCount === 1) {
          return Promise.resolve(capResponse(true, "Roe v. Wade", "https://cap.example/roe"));
        }
        return Promise.reject(new Error("Network error"));
      })
    );

    const claims = [makeClaim("c1", "privacy"), makeClaim("c2", "commerce")];
    const sources = await fetchSources(claims);

    expect(sources).toHaveLength(1);
    expect(sources[0].claimId).toBe("c1");
    expect(sources[0].type).toBe("caselaw");
  });
});
