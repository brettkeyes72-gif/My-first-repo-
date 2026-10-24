# Glove Size Finder

A mobile web page that recommends a glove size from one photo. The user lays their hand flat next to a credit card, ID card or coin, takes a photo from above, and drags markers onto the object and across their knuckles. The known size of the object sets the scale, so the page can measure the hand.

Everything runs in the browser. Photos are never uploaded anywhere.

## Files

- `index.html` – the page
- `styles.css` – the look (colors are at the top of the file)
- `app.js` – the measuring and sizing logic

## Customizing

In `app.js`:

- `SIZE_CHART` – the size boundaries. Replace these with your own brand's chart.
- `REFERENCES` – the objects users can pick for scale.
- `CIRCUMFERENCE_PER_WIDTH` – how hand circumference is estimated from palm width (2.5 by default).

## Trying it

Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → deploy from the `main` branch) to get a link you can open on your phone.
