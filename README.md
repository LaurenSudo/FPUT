# The Fermi–Pasta–Ulam–Tsingou Problem

An interactive visualization of the Fermi–Pasta–Ulam–Tsingou (FPUT) problem: a chain of masses on weakly nonlinear springs that, instead of thermalizing as statistical mechanics predicts, keeps recurring back toward its initial mode.

The page simulates the chain live in the browser, plots the displacement of each mass over time, and breaks the energy down by normal mode so you can watch the recurrence happen.

The site also includes a short remembrance of Mary Tsingou, whose contributions to the original 1955 study were long uncredited, along with photos and a list of her publications.

## Running it

This is a static site with no build step or dependencies. Just open `index.html` in a browser, or serve the folder locally, e.g.:

```
npx serve .
```

## Files

- `index.html` — page structure and content
- `style.css` — styling
- `app.js` — UI wiring, canvas rendering, and charts
- `fput-engine.js` — the physics: the chain's equations of motion, integrated with a 4th-order Yoshida integrator
- `photos/` — images used in the Mary Tsingou remembrance section
