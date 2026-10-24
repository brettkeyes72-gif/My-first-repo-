# Glove Size Finder

A mobile web page that recommends a TRUCK glove size from one photo. The user lays their hand flat next to a credit card, ID card or coin, takes a photo from above, and drags markers onto the object and from their wrist crease to the tip of their longest finger. The known size of the object sets the scale, so the page can measure hand length and match it to the TRUCK sizing chart (sizes 3–11).

Everything runs in the browser. Photos are never uploaded anywhere, and the card is pixelated as soon as it has been marked.

How it works:

- **Camera:** the in-app camera shows a frame to fit the hand and card in, and a level that only enables the shutter when the phone is held flat. People can also pick an existing photo.
- **Marking:** pinch to zoom, drag with one finger to pan, and a zoom circle while dragging. Both measurement lines are kept within 15° of vertical, so the card's long edge and the hand should point up the photo.

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

Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → deploy from the `glove-size-finder` branch) to get a link you can open on your phone.
