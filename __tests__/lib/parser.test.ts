import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseDocument, ParseError } from "../../lib/parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Single printable ASCII character (0x20–0x7E) */
const printableAsciiChar = fc
  .integer({ min: 0x20, max: 0x7e })
  .map((cp) => String.fromCharCode(cp));

/**
 * Build a minimal but valid single-page PDF containing the given text.
 * The PDF is constructed by hand so the test has no external fixture dependency.
 */
function buildMinimalPdf(text: string): Buffer {
  // Escape special PDF string characters
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const streamLen = Buffer.byteLength(stream, "latin1");

  const objects: string[] = [];

  // Object 1 – catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  // Object 2 – pages
  objects.push(
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj"
  );
  // Object 3 – page
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj"
  );
  // Object 4 – content stream
  objects.push(
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${stream}\nendstream\nendobj`
  );
  // Object 5 – font
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj"
  );

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += obj + "\n";
  }

  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += "xref\n";
  body += `0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const off of offsets) {
    body += String(off).padStart(10, "0") + " 00000 n \n";
  }
  body += "trailer\n";
  body += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += "startxref\n";
  body += `${xrefOffset}\n`;
  body += "%%EOF";

  return Buffer.from(body, "latin1");
}

// ---------------------------------------------------------------------------
// Property 2: Parser strips disallowed characters
// Feature: legal-ease, Property 2: Parser strips disallowed characters
// Validates: Requirements 5.2
// ---------------------------------------------------------------------------

describe("Property 2: Parser strips disallowed characters", () => {
  it("output contains no null bytes or disallowed control chars", async () => {
    // Disallowed code points: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F-0x9F
    const disallowedChar = fc
      .integer({ min: 0, max: 0x9f })
      .filter((cp) => {
        if (cp >= 0x20 && cp <= 0x7e) return false; // printable ASCII — allowed
        if (cp === 0x09 || cp === 0x0a || cp === 0x0d) return false; // \t \n \r — allowed
        return true;
      })
      .map((cp) => String.fromCharCode(cp));

    // Mix printable ASCII with disallowed chars
    const stringWithDisallowed = fc
      .array(fc.oneof(printableAsciiChar, disallowedChar), {
        minLength: 1,
        maxLength: 200,
      })
      .map((parts) => parts.join(""));

    await fc.assert(
      fc.asyncProperty(stringWithDisallowed, async (input) => {
        const output = await parseDocument(input);
        const disallowedRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/;
        expect(disallowedRegex.test(output)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Parser plain-text passthrough
// Feature: legal-ease, Property 3: Parser plain-text passthrough
// Validates: Requirements 5.4
// ---------------------------------------------------------------------------

describe("Property 3: Parser plain-text passthrough", () => {
  it("clean plain-text output equals whitespace-normalized input", async () => {
    // Allowed chars: printable ASCII (0x20-0x7E) + \n \r \t
    const allowedChar = fc.oneof(
      fc.constantFrom("\n", "\r", "\t"),
      printableAsciiChar
    );

    // Build strings from allowed chars, then normalize any accidental whitespace runs
    const cleanString = fc
      .array(allowedChar, { minLength: 0, maxLength: 200 })
      .map((chars) => chars.join("").replace(/[ \t]{2,}/g, " "));

    await fc.assert(
      fc.asyncProperty(cleanString, async (input) => {
        const output = await parseDocument(input);
        // Expected: same normalization applied to input
        const expected = input.replace(/[ \t]{2,}/g, " ");
        expect(output).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: PDF round-trip preserves human-readable content
// Feature: legal-ease, Property 4: PDF round-trip preserves human-readable content
// Validates: Requirements 1.3, 5.1, 5.3
// ---------------------------------------------------------------------------

describe("Property 4: PDF round-trip preserves human-readable content", () => {
  it("extracted text contains all expected readable strings from fixture PDF", async () => {
    const knownTexts = ["Hello", "World", "LegalEase"];

    for (const text of knownTexts) {
      const pdfBuffer = buildMinimalPdf(text);
      const output = await parseDocument(pdfBuffer);
      expect(output).toContain(text);
    }
  });

  it("property: any safe alphanumeric text embedded in a PDF is preserved after round-trip", async () => {
    // Use only alphanumeric chars + common punctuation that Helvetica Type1 reliably encodes
    // Backtick, tilde, and some other chars may not map correctly in standard PDF encoding
    const safeChar = fc
      .integer({ min: 0, max: 61 })
      .map((i) => {
        // 0-9, A-Z, a-z
        if (i < 10) return String.fromCharCode(0x30 + i); // '0'-'9'
        if (i < 36) return String.fromCharCode(0x41 + i - 10); // 'A'-'Z'
        return String.fromCharCode(0x61 + i - 36); // 'a'-'z'
      });

    const safeText = fc
      .array(safeChar, { minLength: 3, maxLength: 40 })
      .map((chars) => chars.join(""));

    await fc.assert(
      fc.asyncProperty(safeText, async (text) => {
        const pdfBuffer = buildMinimalPdf(text);
        const output = await parseDocument(pdfBuffer);
        expect(output).toContain(text);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests: edge cases
// ---------------------------------------------------------------------------

describe("parseDocument edge cases", () => {
  it("input with only whitespace returns whitespace-only string (no crash)", async () => {
    const output = await parseDocument("     \t\t   ");
    expect(output.trim()).toBe("");
  });

  it("input at exactly 50 chars passes through correctly", async () => {
    const input = "a".repeat(50);
    const output = await parseDocument(input);
    expect(output).toBe(input);
  });

  it("corrupt PDF buffer throws ParseError", async () => {
    const corruptBuffer = Buffer.from("this is not a valid pdf", "utf-8");
    await expect(parseDocument(corruptBuffer)).rejects.toThrow(ParseError);
  });

  it("corrupt PDF buffer throws ParseError with descriptive message", async () => {
    const corruptBuffer = Buffer.from("%PDF-1.4 corrupt garbage", "utf-8");
    await expect(parseDocument(corruptBuffer)).rejects.toThrow(
      "Could not read the PDF"
    );
  });
});
