import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const publishedCsvPath =
  "/spreadsheets/d/e/2PACX-1vTbXz-sp7-Dr8jKlLb7ISnyr-2eSQCCALagNew4dBA5QL9iQxTz9P6984CD8qSlC3CBvisamzrhRwKd/pub?gid=348674422&single=true&output=csv";

export default defineConfig({
  plugins: [react()],
  // Local Vite development mirrors the same-origin /api/questions endpoint.
  // In production, Vercel serves the equivalent function from api/questions.ts.
  server: {
    proxy: {
      "/api/questions": {
        target: "https://docs.google.com",
        changeOrigin: true,
        secure: true,
        rewrite: () => publishedCsvPath,
      },
    },
  },
});
