import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import * as fc from "fast-check";

fc.configureGlobal({ numRuns: 100 });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: [],
    globals: true,
  },
});
