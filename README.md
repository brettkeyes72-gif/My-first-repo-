# Glove Size Finder

A mobile web page that recommends a TRUCK glove size from one photo. The user lays their hand flat next to a credit card, ID card or coin, takes a photo from above, and drags markers onto the object and from their wrist crease to the tip of their longest finger. The known size of the object sets the scale, so the page can measure hand length and match it to the TRUCK sizing chart (sizes 3–11).

Everything runs in the browser. Photos are never uploaded anywhere, and the card is pixelated as soon as it has been marked.

How it works:

- **Camera:** the in-app camera shows a frame with a center line for the middle finger and card. The frame turns green when the phone is flat (within 5°, smoothed), and after the phone has been level for 3 seconds (with a 3-2-1 countdown, and not in the first 2 seconds after opening) the photo takes itself. People can also tap the shutter or pick an existing photo.
- **Marking:** pinch to zoom, drag with one finger to pan, and a zoom circle while dragging. Both measurement lines are locked vertical, so the card and hand should be lined up with the photo's center line.
- **Sharing:** "Send to a friend" on the start screen and "Send my size" on the result open the phone's share sheet (or copy to the clipboard), so someone buying gloves as a gift can send the finder and get the size back.
- **Hand length** runs from the tip of the longest finger to the wrist crease closest to the palm (the distal wrist crease).

## Files

- `index.html` – the page
- `styles.css` – the look (colors are at the top of the file)
- `app.js` – the measuring and sizing logic

## Customizing

In `app.js`:

- `SIZE_CHART` – hand length in mm for each glove size, from the TRUCK sizing chart.
- `SNAP_TO_SIZE` – how close a hand must be to a size to get that size instead of "between sizes".
- `REFERENCES` – the objects users can pick for scale.

## Trying it

Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → deploy from the `main` branch) to get a link you can open on your phone.

## Content pages (modular articles)

`content/` holds TRUCK blog content built from small, self-contained modules in the same look as the size finder.

- `content/shared/` – the brand styles (`tg-` prefixed so they never clash) and a tiny script for scroll reveal and the break-in slider
- `content/articles/<name>/article.json` – title, byline, link targets and the module order
- `content/articles/<name>/modules/*.html` – one file per section (hero, each benefit, myths, CTA…)
- `content/articles/glove-care/` – the redesigned Glove Care page (three videos, shown with click-to-play so YouTube loads only on demand)
- `content/articles/returns/` – the Returns & Exchanges page (terms kept word-for-word from the live page, with the ShipHero returns form embedded)
- `content/CONTENT-PLAN.md` – the spin-off pieces planned from the pillar article

Run `node content/build.mjs` to produce `content/dist/<slug>/`: the full article (`index.html`), each module as its own page (`modules/`) and as a bare fragment to embed (`fragments/`), plus `modules.json` indexing every piece.

### Publishing to Shopify

`node content/build.mjs` also writes `content/dist/<slug>/shopify.html`, `shopify.css` and `shopify.js` for articles that define `cdn` (image URLs) in `article.json`.

1. Upload images, `shopify.css` and `shopify.js` to the store's **Files** (the Admin API `fileCreate` takes a public URL; use a URL pinned to a commit SHA, since branch URLs can be served stale by GitHub's cache).
2. Put the resulting CDN URLs in `article.json` under `cdn` (images) and `assets` (css/js), then rebuild.
3. Create the article (unpublished first) with `shopify.html` as the body.

Current state: the leather article exists in TRUCK BLOG as an **unpublished draft** (handle `why-leather-still-wins-redesign-draft`). The live article is untouched. Uploaded filenames are versioned (`tg-content-v4.js` is current); change the version number whenever the css/js changes.
