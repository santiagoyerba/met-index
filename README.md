# Art Index

A web index of religious and devotional artworks from the [Metropolitan Museum of Art](https://www.metmuseum.org/) public collection.

**Live site:** https://santiagoyerba.github.io/met-index/

---

## What it does

Fetches objects from the MET public API and displays them in five views. **Timeline and Stats are desktop-only** — on mobile, List, Grid, and Map are available.

- **List** — sortable table with columns: Type, Title, Artist, Date, Period, Location, Dimensions. Click any column header to sort; click again to reverse.
- **Grid** — image thumbnails in a responsive grid. Click an image to open the detail modal. Cards without an available image show a text placeholder and are not clickable.
- **Map** — Interactive orthographic globe with a horizon effect. Countries with artworks are highlighted; drag to rotate the globe. Artwork dots are always visible across all countries. Click a country to animate the globe to face it, zoom to fit it (scale computed from geographic bounds, excluding overseas territories), and enlarge its dots. Click outside to reset. Dots with images are clickable and open the detail modal. A starfield of ambient particles fills the space outside the globe.
- **Timeline** — canvas-based node graph. Rows by country (derived from country, culture, or artist nationality), nodes are individual artworks, left-to-right chronological axis with density-based spacing. Click a row to expand it full-width; click a node to open the detail modal.
- **Stats** — canvas-based Sankey chart: Country → Object Type → Period. Node heights use a square-root scale so dominant categories don't overwhelm smaller ones. Hover any node or flow band to highlight its connections; click to pin a node and keep it highlighted while exploring. Ambient colors are assigned per country and propagate through the chart.

The header provides **Search** (expands inline, filters by title, artist, or type across all views), **Filters**, a **List/Grid** toggle, and **Map**, **Timeline**, **Stats** view buttons.

Clicking a row in List view, an image card in Grid, a dot in Map, or a node in expanded Timeline opens a detail modal. The thumbnail appears immediately and the full-resolution image fades in when ready.

Filter chips (department, object type) let you narrow down results. Each active filter is assigned a color from a palette; matching items are highlighted in that color across all views — text in List, bottom border in Grid, node fill in Timeline and Stats, country stroke and dot color in Map. Non-matching items are dimmed rather than hidden. Search and filters apply simultaneously.

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
- Canvas 2D API for Stats, Timeline, and Map particle layer
- [D3](https://d3js.org/) + [world-atlas](https://github.com/topojson/world-atlas) + [topojson-client](https://github.com/topojson/topojson-client) for the Map view
- [MET Museum Collection API](https://metmuseum.github.io/) (public, no auth required)

## Deploy

Pushes to `main` automatically run `fetch-data`, build, and deploy to GitHub Pages via GitHub Actions. `public/data.json` is generated in CI and not committed to the repo.
