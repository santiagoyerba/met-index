# Art Index

A web index of religious artworks from the [Metropolitan Museum of Art](https://www.metmuseum.org/) public collection.

**Live site:** https://santiagoyerba.github.io/met-index/

---

## What it does

Fetches objects from the MET public API and displays them in two views:

- **List** — table with columns: Type, Title, Artist, Date, Period, Location, Dimensions
- **Grid** — image thumbnails

Clicking a row in list view opens a detail modal with the full image, medium, and credit line.

Filter chips (department, object type, country) let you narrow down results using OR logic. Non-matching items are dimmed rather than hidden.

Objects load in batches of 50. Use **Load more** to fetch the next batch. Data is cached in `localStorage` for 24 hours.

## Running locally

```bash
cd met-index
npm install
npm run dev
```

Then open `http://localhost:5173/met-index/`.

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/)
- Plain CSS (no framework)
- [MET Museum Collection API](https://metmuseum.github.io/) (public, no auth required)

## Deploy

Pushes to `main` automatically build and deploy to GitHub Pages via GitHub Actions.
