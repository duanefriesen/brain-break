# Brain Break

A responsive React + TypeScript + Vite app that reads questions and answers directly from your published Google Sheets CSV. It has no database, login, or backend API.

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- A public/published CSV URL for the spreadsheet

## Run locally

1. Unzip the project and open a terminal in the `brain-break` directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local URL printed by Vite (usually `http://localhost:5173`).

## Spreadsheet source

The app uses the published CSV URL supplied for this project. In production, the browser requests the same-origin `/api/questions` Vercel Function, which fetches the public CSV server-side; this avoids depending on Google Sheets CORS headers. No credentials are used. During local `npm run dev`, Vite proxies `/api/questions` to the same CSV source. The client parses CSV with Papa Parse, matches the `Question` and `Answer` headers case-insensitively while ignoring surrounding header whitespace, preserves original cell text, and skips rows missing either value. Papa Parse handles quoted fields, commas, apostrophes, and embedded newlines.

If you need to change the source later, edit `CSV_URL` in `src/App.tsx`. The spreadsheet must remain published for anyone to access it. If the upstream fetch fails or the sheet is not published correctly, the API returns an error and the app displays it rather than showing made-up content.

## Production build

```bash
npm run build
npm run preview
```

The build output is written to `dist/`. The `api/questions.ts` endpoint is deployed by Vercel as a serverless function alongside the Vite static assets.

## Deploy to Vercel

### Option A: Import from Git (recommended)

1. Create a Git repository and push this project to GitHub, GitLab, or Bitbucket.
2. Sign in to [Vercel](https://vercel.com/), choose **Add New → Project**, and import the repository.
3. Vercel should detect Vite. Confirm:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
4. Select **Deploy**. The included `vercel.json` supplies the build/output settings and a fallback rewrite.

### Option B: Deploy with the Vercel CLI

From the project directory:

```bash
npm install
npm run build
npx vercel
```

Follow the CLI prompts. To deploy a production version, run:

```bash
npx vercel --prod
```

## How a round works

- The valid spreadsheet rows are shuffled when loaded and whenever a new round starts.
- Each entry appears once per round.
- Answers remain hidden until **Show Answer** is clicked.
- **Previous** returns to the prior entry and restores whether its answer was revealed.
- At the end of a round, a completion screen offers **Start New Round**.

## Troubleshooting

- **Could not load questions:** Check your connection and make sure the published CSV URL is accessible in a browser. The app reports fetch/parse failures and does not use fallback content.
- **Missing Question or Answer columns:** Verify the first row contains headers named `Question` and `Answer` (capitalization does not matter).
- **Zero valid entries:** Ensure at least one row has both a non-empty question and answer.
- **Changes to the sheet:** Reload the app to fetch the latest published CSV data.


## Integration verification note

The source URL is configured exactly as supplied. In the authoring environment, outbound DNS resolution for `docs.google.com` was unavailable (`curl` failed with “Could not resolve host”), and dependency installation timed out. Therefore the live CSV response, header names, valid-row count, and production build could not be independently verified here. The app deliberately does not claim a count until it successfully fetches and validates the real CSV. Verify the connection after deploying or from a network with external access.
