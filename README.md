# Art Index

A web index of religious artworks from the [Metropolitan Museum of Art](https://www.metmuseum.org/) public collection.

**Live site:** https://santiagoyerba.github.io/met-index/

---

## What it does

Fetches objects from the MET public API and displays them in three views:

- **List** — table with columns: Type, Title, Artist, Date, Period, Location, Dimensions
- **Grid** — image thumbnails in a responsive grid
- **Timeline** — canvas-based node graph. Rows by country, nodes are individual artworks, left-to-right chronological axis with density-based spacing (denser time periods get proportionally more horizontal space). Click a row to expand it full-width with labeled nodes.

Clicking a row in list view (or a node in expanded Timeline) opens a detail modal with the full image, medium, and credit line.

Filter chips (department, object type, country, artist) let you narrow down results. Each active filter is assigned a color from a palette; matching items are highlighted in that color across all views — text in List, bottom border in Grid, node fill in Timeline. Non-matching items are dimmed rather than hidden. Multiple active filters show a gradient where applicable.

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
- Canvas 2D API for Timeline visualization
- [MET Museum Collection API](https://metmuseum.github.io/) (public, no auth required)

## Deploy

Pushes to `main` automatically build and deploy to GitHub Pages via GitHub Actions.
