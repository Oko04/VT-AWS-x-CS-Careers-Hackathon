import type { Claim, Source } from "../types";

const COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v4/search/";

async function fetchCourtListener(claim: Claim, signal: AbortSignal): Promise<Source | null> {
  const url = `${COURTLISTENER_BASE}?q=${encodeURIComponent(claim.searchQuery)}&type=o&page_size=1&format=json`;
  const token = process.env.COURTLISTENER_API_KEY;
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetch(url, { headers, signal });
  if (!res.ok) return null;

  const data = await res.json();
  const results: Array<{ absolute_url: string; caseName?: string; case_name?: string }> =
    data?.results ?? [];

  if (results.length === 0) return null;

  const first = results[0];
  const caseName = first.caseName ?? first.case_name ?? "Court Opinion";
  const caseUrl = `https://www.courtlistener.com${first.absolute_url}`;

  return {
    claimId: claim.id,
    title: caseName,
    url: caseUrl,
    type: "caselaw",
  };
}

async function fetchGovInfo(claim: Claim, signal: AbortSignal): Promise<Source | null> {
  const apiKey = process.env.GOVINFO_API_KEY ?? "";
  const url =
    `https://api.govinfo.gov/search?query=${encodeURIComponent(claim.searchQuery)}` +
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
    const courtSource = await fetchCourtListener(claim, signal);
    if (courtSource) return courtSource;

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
