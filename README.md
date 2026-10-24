# Glove Size Finder

A mobile web page that recommends a TRUCK glove size from one photo. The user lays their hand flat next to a credit card, ID card or coin, takes a photo from above, and drags markers onto the object and from their wrist crease to the tip of their longest finger. The known size of the object sets the scale, so the page can measure hand length and match it to the TRUCK sizing chart (sizes 3–11).

Everything runs in the browser. Photos are never uploaded anywhere, and the card is pixelated as soon as it has been marked.

How it works:

- **Camera:** the in-app camera shows a frame with a center line for the middle finger and card. The frame turns green when the phone is flat (within 5°, smoothed), and the photo takes itself after 1.2 seconds of holding level. People can also tap the shutter or pick an existing photo.
- **Marking:** pinch to zoom, drag with one finger to pan, and a zoom circle while dragging. Both measurement lines are locked vertical, so the card and hand should be lined up with the photo's center line.
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

Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → deploy from the `glove-size-finder` branch) to get a link you can open on your phone.
