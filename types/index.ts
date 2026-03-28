export type SectionKey =
  | "whatThisMeansForYou"
  | "keyObligations"
  | "risks"
  | "whatYouAreAgreeingTo"
  | "backedByLaw";

export interface Source {
  claimId: string;
  title: string;
  url: string;
  type: "caselaw" | "statute";
}

export interface Claim {
  id: string;
  text: string;
  searchQuery: string;
}

export interface RiskItem {
  clause: string;
  explanation: string;
}

export interface RawAnalysis {
  whatThisMeansForYou: string;
  keyObligations: string[];
  risks: RiskItem[];
  whatYouAreAgreeingTo: string[];
  claims: Claim[];
  isLegalDocument: boolean;
}

export interface AnalysisResponse {
  whatThisMeansForYou: string;
  keyObligations: string[];
  risks: RiskItem[];
  whatYouAreAgreeingTo: string[];
  backedByLaw: Source[];
  isLegalDocument: boolean;
  sourcesUnavailable?: boolean;
}

export interface ErrorResponse {
  error: string;
  retryable: boolean;
}
