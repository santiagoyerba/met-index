# Art Index

A web index of religious artworks from the [Metropolitan Museum of Art](https://www.metmuseum.org/) public collection.

**Live site:** https://santiagoyerba.github.io/met-index/

---

## What it does

Fetches 100 objects from the MET API and displays them in two views:

- **List** — table with columns: Type, Title, Artist, Date, Period, Location, Dimensions
- **Grid** — image thumbnails

Filter chips (department, object type, country) let you narrow down the results. Non-matching items are dimmed rather than hidden.

Data is cached in `localStorage` for 24 hours to avoid repeated API calls.

## Running locally

Requires a local HTTP server (the MET API blocks `file://` requests):

```bash
cd met-index
python3 -m http.server 3000
```

Then open `http://localhost:3000`.

## Stack

Plain HTML, CSS, and JavaScript — no build step, no dependencies.

## API

Uses the [MET Museum Collection API](https://metmuseum.github.io/) (public, no auth required).
