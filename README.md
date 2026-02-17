# Art Index

A web index of religious and devotional artworks from the [Metropolitan Museum of Art](https://www.metmuseum.org/) public collection.

**Live site:** https://santiagoyerba.github.io/met-index/

---

## What it does

Fetches objects from the MET public API and displays them in three views:

- **List** — sortable table with columns: Type, Title, Artist, Date, Period, Location, Dimensions. Click any column header to sort; click again to reverse.
- **Grid** — image thumbnails in a responsive grid. Click an image to open the detail modal (cards without an available image are not clickable).
- **Timeline** — canvas-based node graph. Rows by country (derived from country, culture, or artist nationality), nodes are individual artworks, left-to-right chronological axis with density-based spacing. Click a row to expand it full-width; click a node to open the detail modal.

The header provides **Search** (expands inline, filters by title, artist, or type across all views), a **List/Grid** toggle, a **Filters** toggle, and a **Timeline** view button.

Clicking a row in List view, an image card in Grid, or a node in expanded Timeline opens a detail modal overlaid on a semi-transparent background, showing the full image with title, artist, medium, and credit line.

Filter chips (department, object type) let you narrow down results. Each active filter is assigned a color from a palette; matching items are highlighted in that color across all views — text in List, bottom border in Grid, node fill in Timeline. Non-matching items are dimmed rather than hidden. Multiple active filters show a gradient where applicable. Search and filters apply simultaneously.

All objects load instantly from a pre-built `data.json` generated at deploy time. No API calls at runtime.

## Running locally

```bash
cd met-index
npm install
npm run fetch-data   # generates public/data.json (~2 min)
npm run dev
```

Then open `http://localhost:5173/met-index/`.

## Stack

- [Vite](https://vite.dev/) + [React](https://react.dev/)
- Plain CSS (no framework)
- Canvas 2D API for Timeline visualization
- [MET Museum Collection API](https://metmuseum.github.io/) (public, no auth required)

## Deploy

Pushes to `main` automatically run `fetch-data`, build, and deploy to GitHub Pages via GitHub Actions. `public/data.json` is generated in CI and not committed to the repo.
