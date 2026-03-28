/**
 * Typed error thrown when a PDF cannot be parsed.
 */
export class ParseError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ParseError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/**
 * Regex matching disallowed characters:
 *  - null byte \x00
 *  - C0 controls except \t (\x09), \n (\x0A), \r (\x0D): \x01-\x08, \x0B, \x0C, \x0E-\x1F
 *  - DEL \x7F
 *  - C1 controls \x80-\x9F
 */
const DISALLOWED_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

/**
 * Collapse runs of 2+ spaces or tabs (but NOT newlines) to a single space.
 */
const EXCESS_WHITESPACE = /[ \t]{2,}/g;

function normalizeText(text: string): string {
  return text
    .replace(DISALLOWED_CHARS, "")
    .replace(EXCESS_WHITESPACE, " ");
}

/**
 * Parse a document from either a plain-text string or a PDF Buffer.
 *
 * - If input is a Buffer, pdf-parse v2 is used to extract text.
 * - Strips null bytes and disallowed control characters.
 * - Collapses runs of 2+ spaces/tabs to a single space (newlines preserved).
 * - Throws ParseError on corrupt/unreadable PDF.
 * - Returns normalized UTF-8 string.
 */
export async function parseDocument(input: string | Buffer): Promise<string> {
  if (typeof input === "string") {
    return normalizeText(input);
  }

  // Buffer path — extract text via pdf-parse v2
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: input });
    const result = await parser.getText();
    return normalizeText(result.text);
  } catch (err) {
    if (err instanceof ParseError) throw err;
    throw new ParseError(
      "Could not read the PDF. Please paste the text manually.",
      err
    );
  }
}
