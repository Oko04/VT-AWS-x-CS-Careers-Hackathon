import type { Claim, Source } from "../types";

const CAP_BASE = "https://api.case.law/v1/cases/";
const GOVINFO_BASE = "https://api.govinfo.gov/search";

async function fetchCAP(claim: Claim, signal: AbortSignal): Promise<Source | null> {
  const url = `${CAP_BASE}?search=${encodeURIComponent(claim.searchQuery)}&page_size=1`;
  const headers: Record<string, string> = {};
  const apiKey = process.env.CAP_API_KEY;
  if (apiKey) {
    headers["Authorization"] = `Token ${apiKey}`;
  }

  const res = await fetch(url, { headers, signal });
  if (!res.ok) return null;

  const data = await res.json();
  const results: Array<{ id: string; name_abbreviation: string; frontend_url: string }> =
    data?.results ?? [];

  if (results.length === 0) return null;

  const first = results[0];
  return {
    claimId: claim.id,
    title: first.name_abbreviation,
    url: first.frontend_url,
    type: "caselaw",
  };
}

async function fetchGovInfo(claim: Claim, signal: AbortSignal): Promise<Source | null> {
  const apiKey = process.env.GOVINFO_API_KEY ?? "";
  const url =
    `${GOVINFO_BASE}?query=${encodeURIComponent(claim.searchQuery)}` +
    `&pageSize=1&offset=0&collection=USCODE&api_key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, { signal });
  if (!res.ok) return null;

  const data = await res.json();
  const packages: Array<{ packageId: string; title: string; detailsLink: string }> =
    data?.results?.packages ?? [];

  if (packages.length === 0) return null;

  const first = packages[0];
  return {
    claimId: claim.id,
    title: first.title,
    url: first.detailsLink,
    type: "statute",
  };
}

async function lookupClaim(claim: Claim): Promise<Source | null> {
  const signal = AbortSignal.timeout(10000);

  try {
    const capSource = await fetchCAP(claim, signal);
    if (capSource) return capSource;

    const govSource = await fetchGovInfo(claim, signal);
    return govSource;
  } catch {
    return null;
  }
}

export async function fetchSources(claims: Claim[]): Promise<Source[]> {
  const results = await Promise.allSettled(claims.map(lookupClaim));

  const sources: Source[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value !== null) {
      sources.push(result.value);
    }
  }
  return sources;
}
