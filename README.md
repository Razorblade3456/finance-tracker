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
