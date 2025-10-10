# Flow Ledger – Finance Tracker

A minimal, mobile-ready finance tracker built with React and Vite. It keeps spending aligned to five key life buckets and supports drag-and-drop to reorganize transactions as priorities shift.

## Getting started

```bash
npm install
npm run dev
```

- `npm run dev` – start the Vite development server on port 5173.
- `npm run build` – type-check and build the production bundle.
- `npm run preview` – locally preview the production build.

### Enabling Google sign-in

1. In the Google Cloud Console, enable **Google Identity Services** and create a Web OAuth client ID.
2. Either set `VITE_GOOGLE_CLIENT_ID` in a `.env` file at the project root or update `src/config/googleClient.ts` with a hostname entry that maps to the client ID.
3. Restart the dev server so Vite can pick up the value. Once the ID is present, the landing page will render the Google sign-in button and forward the credential back to the app.

### Deploying with Google sign-in

When deploying to Netlify (or any other host), create a separate OAuth client ID in the Google Cloud Console and add the deployed domain under **Authorized JavaScript origins**. Then provide the client ID to the app in one of two ways:

- Set a Netlify environment variable named `VITE_GOOGLE_CLIENT_ID` with the production client ID.
- Or, set `VITE_GOOGLE_CLIENT_ID_MAP` to a JSON object such as `{ "your-site.netlify.app": "oauth-client-id.apps.googleusercontent.com" }` so the app automatically selects the right ID based on `window.location.host`.

Without this configuration Google will respond with an `origin_mismatch` error when users try to sign in from the deployed site.

## Features

- Five curated categories: financial obligations, lifestyle & recurring, personal & family, savings & investments, and miscellaneous.
- Add transactions with cadence, type (expense, savings, or income), and optional notes.
- Drag and drop transactions between categories using native HTML5 interactions.
- Dashboard summary of monthly expenses, savings cadence, and net cash flow.
- Designed with a responsive layout that translates cleanly to a future mobile app.

## Preventing binary-file PR errors

The repository includes a `.gitattributes` file that forces all source files to use LF line endings and be treated as text while keeping real binary assets flagged as binary. If you pulled the project before this rule existed, run the following once to re-normalize your working tree:

```bash
git add --renormalize .
```

Then commit as usual—your pull request diffs will stay in text mode.
