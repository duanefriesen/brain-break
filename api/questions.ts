/**
 * Same-origin Vercel Function proxy for the published Google Sheets CSV.
 * Keeping the upstream request server-side avoids relying on Google Sheets CORS
 * headers in production. No credentials are used or exposed.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbXz-sp7-Dr8jKlLb7ISnyr-2eSQCCALagNew4dBA5QL9iQxTz9P6984CD8qSlC3CBvisamzrhRwKd/pub?gid=348674422&single=true&output=csv";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const upstream = await fetch(CSV_URL, {
      signal: controller.signal,
      headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.8" },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Google Sheets returned HTTP ${upstream.status}.` });
      return;
    }

    const csv = await upstream.text();
    if (!csv.trim()) {
      res.status(502).json({ error: "Google Sheets returned an empty CSV response." });
      return;
    }

    // The client performs CSV parsing and header/row validation with Papa Parse.
    // Reject obvious HTML error pages instead of passing them off as spreadsheet data.
    if (/^\s*<!doctype html|^\s*<html[\s>]/i.test(csv)) {
      res.status(502).json({
        error: "Google Sheets returned a web page instead of CSV. Confirm the sheet is published as CSV.",
      });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.send(csv);
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The request to Google Sheets timed out."
      : "The published Google Sheets CSV could not be reached.";
    res.status(502).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
}
