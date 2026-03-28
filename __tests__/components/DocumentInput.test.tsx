// Feature: legal-ease, Property 1: Minimum character validation
// Unit tests: file size rejection, loading state, inline error messages

import * as fc from "fast-check";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DocumentInput from "../../components/DocumentInput";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderComponent(props?: Partial<Parameters<typeof DocumentInput>[0]>) {
  const onSubmit = vi.fn();
  const utils = render(
    <DocumentInput onSubmit={onSubmit} isLoading={false} {...props} />
  );
  return { ...utils, onSubmit };
}

function getTextarea() {
  return screen.getByRole("textbox");
}

function getSubmitButton() {
  return screen.getByRole("button", { name: /analyze document/i });
}

function fillTextarea(text: string) {
  fireEvent.change(getTextarea(), { target: { value: text } });
}

function submitForm() {
  fireEvent.click(getSubmitButton());
}

// ---------------------------------------------------------------------------
// Property 1: Minimum character validation
// Validates: Requirements 1.6
// ---------------------------------------------------------------------------

describe("Property 1: Minimum character validation", () => {
  it("rejects strings shorter than 50 characters (0–49)", () => {
    // Feature: legal-ease, Property 1: Minimum character validation
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 49 }),
        (shortText) => {
          const { onSubmit, unmount } = renderComponent();

          fillTextarea(shortText);
          submitForm();

          // onSubmit must NOT have been called
          expect(onSubmit).not.toHaveBeenCalled();

          // Inline validation error must be visible
          expect(
            screen.getByText("Please enter at least 50 characters.")
          ).toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("accepts strings of 50 or more non-whitespace characters", () => {
    // Feature: legal-ease, Property 1: Minimum character validation
    // The component trims text before checking length, so we generate strings
    // that are at least 50 chars after trimming (i.e., contain 50+ non-space chars).
    // Use printable ASCII chars (0x21-0x7E) which are never whitespace.
    const nonWhitespaceChar = fc
      .integer({ min: 0x21, max: 0x7e })
      .map((cp) => String.fromCharCode(cp));
    const longNonWhitespaceText = fc
      .array(nonWhitespaceChar, { minLength: 50, maxLength: 500 })
      .map((chars) => chars.join(""));

    fc.assert(
      fc.property(longNonWhitespaceText, (longText) => {
        const { onSubmit, unmount } = renderComponent();

        fillTextarea(longText);
        submitForm();

        // No inline text error should appear
        expect(
          screen.queryByText("Please enter at least 50 characters.")
        ).not.toBeInTheDocument();

        // onSubmit should have been called
        expect(onSubmit).toHaveBeenCalledTimes(1);

        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe("DocumentInput unit tests", () => {
  let onSubmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSubmit = vi.fn();
  });

  it("shows inline file error when a file > 10 MB is selected", () => {
    render(<DocumentInput onSubmit={onSubmit} isLoading={false} />);

    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    const bigFile = new File(["x".repeat(1)], "big.pdf", {
      type: "application/pdf",
    });
    // Override size property to simulate > 10 MB
    Object.defineProperty(bigFile, "size", { value: 11 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [bigFile] } });

    expect(screen.getByText("File exceeds the 10 MB limit.")).toBeInTheDocument();
  });

  it("disables submit button and shows loading text when isLoading is true", () => {
    render(<DocumentInput onSubmit={onSubmit} isLoading={true} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/analyzing/i);
  });

  it("renders error banner when error prop is provided", () => {
    const errorMsg = "Something went wrong. Please try again.";
    render(
      <DocumentInput onSubmit={onSubmit} isLoading={false} error={errorMsg} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(errorMsg);
  });

  it("does not show validation error for valid text input (50+ chars)", () => {
    render(<DocumentInput onSubmit={onSubmit} isLoading={false} />);

    const validText = "a".repeat(50);
    fillTextarea(validText);
    submitForm();

    expect(
      screen.queryByText("Please enter at least 50 characters.")
    ).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
