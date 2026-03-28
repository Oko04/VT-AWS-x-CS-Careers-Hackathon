"use client";

import { useRef, useState } from "react";

interface DocumentInputProps {
  onSubmit: (formData: FormData) => void;
  isLoading: boolean;
  error?: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MIN_TEXT_LENGTH = 50;

export default function DocumentInput({
  onSubmit,
  isLoading,
  error,
}: DocumentInputProps) {
  const [textValue, setTextValue] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const file = fileInputRef.current?.files?.[0] ?? null;
    const hasText = textValue.trim().length > 0;
    const hasFile = file !== null;

    // Reset inline errors
    setTextError(null);
    setFileError(null);

    // Validate: at least one input must be provided
    if (!hasText && !hasFile) {
      setTextError("Please enter at least 50 characters.");
      return;
    }

    // Validate text length if text is provided
    if (hasText && textValue.trim().length < MIN_TEXT_LENGTH) {
      setTextError("Please enter at least 50 characters.");
      return;
    }

    // Validate file size if file is provided
    if (hasFile && file.size > MAX_FILE_SIZE) {
      setFileError("File exceeds the 10 MB limit.");
      return;
    }

    const formData = new FormData();
    if (hasText) formData.append("text", textValue);
    if (hasFile) formData.append("file", file);

    onSubmit(formData);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && file.size > MAX_FILE_SIZE) {
      setFileError("File exceeds the 10 MB limit.");
      setSelectedFileName(null);
    } else {
      setFileError(null);
      setSelectedFileName(file?.name ?? null);
    }
  }

  function handleRemoveFile() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSelectedFileName(null);
    setFileError(null);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Document submission form">
      {/* Error banner from parent */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {error}
        </div>
      )}

      {/* Text input */}
      <div className="mb-4">
        <label
          htmlFor="legal-text"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Paste legal document text
        </label>
        <textarea
          id="legal-text"
          name="text"
          rows={10}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          placeholder="Paste your contract, privacy policy, terms of service, or other legal text here…"
          aria-describedby={textError ? "text-error" : undefined}
          aria-invalid={textError ? "true" : "false"}
          className="w-full rounded-md border border-gray-300 p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {textError && (
          <p id="text-error" role="alert" className="mt-1 text-sm text-red-600">
            {textError}
          </p>
        )}
      </div>

      {/* File input */}
      <div className="mb-6">
        <label
          htmlFor="legal-file"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Or upload a PDF file
        </label>
        <div className="flex items-center gap-2">
          <input
            id="legal-file"
            name="file"
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            onChange={handleFileChange}
            aria-describedby={fileError ? "file-error" : undefined}
            aria-invalid={fileError ? "true" : "false"}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {selectedFileName && (
            <button
              type="button"
              onClick={handleRemoveFile}
              aria-label="Remove selected file"
              className="shrink-0 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              Remove
            </button>
          )}
        </div>
        {fileError && (
          <p id="file-error" role="alert" className="mt-1 text-sm text-red-600">
            {fileError}
          </p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
        className="flex w-full items-center justify-center rounded-md bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
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
            Analyzing…
          </>
        ) : (
          "Analyze Document"
        )}
      </button>
    </form>
  );
}
