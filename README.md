# SSC × TRUCK Board

A live production board for TRUCK Gloves and SSC. It's a sister site to truckgloves.com, built so it's easy to read on a phone in Sialkot or a laptop in Salt Lake.

- **Production, Custom and Samples.** Each area has big tiles, a photo of every glove on the PO, the sizes as large chips, and a ship date with a countdown.
- **Custom artwork comes first.** Logos and mockups show at full size and open bigger when tapped. PO PDFs can open right on the page. Fonts and files are one tap to download, and each project links to its Google Drive art folder.
- **"Needs SSC OK" on the home page.** Anything waiting for SSC to confirm shows in red at the top.
- **English / اردو button on every page.** The whole interface switches to Urdu, right-to-left in Nastaliq script. Board notes can carry their own Urdu; a note without Urdu shows in English with a small "English" tag.
- **Messages.** Leave a **video note**, **voice note** or **text** for each other, like Marco Polo. Every PO, custom project and sample has a **Talk about this** button, so messages stay attached to the order. For a live call there is a one-tap Jitsi video call button.

## Folder layout

```
public/                 the website (plain HTML/CSS/JS, no build step)
  index.html
  css/app.css           TRUCK look: Oswald headings, rust accent, big rounded tiles
  js/config.js          ← switch demo → live here
  js/app.js             pages: home, production, custom, samples, messages, files, admin
  js/i18n.js            every word in English and Urdu
  js/store.js           data: JSON file (demo) or Firebase (live)
  data/demo-board.json  made-up demo orders
  img/gloves/           TRUCK product photos, one per model + colour
  fonts/                Oswald, Nunito, Noto Nastaliq Urdu (self-hosted)
tools/sync_board.py     turns the Mansab Production Board into board.json
firebase.json, firestore.rules, storage.rules
.github/workflows/deploy.yml   auto-deploy to Firebase on push to main
```

## Real data stays out of this repo

**This repository is public.** PO values, customer names, contacts and artwork must not be committed. `.gitignore` already blocks `public/data/board.json`, everything in `public/files/` except the demo picture, and `private/`.

In live mode the real board lives in Firestore and the files live in Firebase Storage, and both sit behind sign-in.

## Try it locally

```
cd public
python3 -m http.server 8000
# open http://localhost:8000
```

The demo board loads by default. To see real data on your own machine, put a real `board.json` in `public/data/`. It is ignored by git.

## Going live (Firebase)

Firebase is Google's hosting. It loads well in Pakistan: Google has serving locations in Karachi and Lahore, and the site doesn't depend on anything that's commonly blocked there. One free Firebase project covers the website, the shared board, the messages and the video and file storage.

1. Create a project at <https://console.firebase.google.com>, for example `truck-ssc`.
2. **Authentication → Sign-in method:** turn on **Email/Password**. Under **Users**, add one login per person (Brett, Mansab, Seqlain, …).
3. Create a **Firestore Database** (production mode) and **Storage**. Choose a region close to both of you; `asia-south1` (Mumbai) or `europe-west` both work well.
4. **Project settings → Your apps → Web app.** Copy the config object into `firebase:` in `public/js/config.js`.
5. Deploy the site and the security rules:
   ```
   npm i -g firebase-tools
   firebase login
   firebase use --add            # pick the project
   firebase deploy
   ```
6. Sign in at `https://<project>.web.app` with an admin email and open **Admin**:
   - **Upload board data:** choose the `board.json` made by `tools/sync_board.py`. Everyone's open page updates within seconds.
   - **Upload files:** type the folder (for example `files/CUS26-01/`) and pick the files. Board entries like `files/CUS26-01/PCPSPA_logo.png` then resolve to those files.

### Auto-deploy from GitHub (optional)

Add two repository secrets: `FIREBASE_SERVICE_ACCOUNT` (a service-account JSON key from Firebase) and `FIREBASE_PROJECT_ID`. Every push to `main` then redeploys the site. The workflow does nothing until those secrets exist.

## Keeping the board current

The Mansab Production Board is still the source. To refresh this site from it:

```
python3 tools/sync_board.py saved-board.html private/board.json --urdu private/urdu.json
```

Then upload `private/board.json` on the Admin page. The `--urdu` overlay adds Urdu to notes and instructions; its format is described at the top of the script.

### Board data format

This site reads the board's own data shape, so nothing needs converting:

- `pos[]`: production POs. Each has `po`, `label`, `hard` (ship no later than), `sscQuoted.current` (SSC's date), `needsOK` + `needsOKNote`, `mandatoryModels` (these ship first), `doc.url` (the PO file), and `lines[]` with `model`, `color` and `sizes: [[size, pairs, …]]`.
- `custom[]`: custom runs, with `stage`, `current` (ship date), `items` rows (`["Sizes", "7:10 · 8:55"]`, `["Needed by", "…"]`), `docs[]` (artwork, PO, font) and `art.url` (the Drive folder).
- `samples[]`: sample requests with `items`, `stage`, `current` and optional `docs`.
- Any item can carry `ur: { field: "Urdu text" }`.
- `shipments[]`: what has left SSC, as `{ ref, dispatched, arrived, cartons, pairs, via, note, lines: [{ po, model, color, sizes }] }`. Lines are counted against the matching PO line. Shipped sizes turn green, each PO shows shipped vs. still to ship, and the newest shipment shows on the home page.
- Any PO can carry `alert` + `alertHead`, an amber "please note" box (for example barcode or labelling instructions).

`tools/sync_board.py --patch` layers these updates (and fresh Shopify stock) on top of the production board, so they survive the next sync.

Glove photos are matched by model and colour, for example `M1 PRO` + `Brown` → `img/gloves/m1pro-brown.jpg`. To add a model, drop in a photo and add its name to `MODEL_KEYS` / `HAVE` in `js/app.js`.

## Look and icons

The styling follows truckgloves.com: white pages, Oswald uppercase headings, Poppins body, square black buttons, rust accents and a near-black band for the TRUCK / SSC message panel at the top of the home page. Category colours mark each area (Production = Work rust, Custom = Snow blue, Samples = Bike charcoal, Messages = sand, Files = leather). Everything lives in `public/css/app.css`.

The site ships with a simple built-in line icon set. To switch to the TRUCK icon set, put one SVG per name in `public/img/icons/` and set `iconSet: "img/icons/"` in `public/js/config.js`. Each icon is drawn in the text colour around it, so single-colour SVGs work best. Names used:

`home` `production` `custom` `samples` `messages` `files` `admin` `back` `video` `mic` `text` `download` `doc` `drive` `call` `alert` `bell`

## Alerts

- **Phone / computer alerts:** each person taps **Turn on alerts** once per device. On iPhone, add the board to the Home Screen first (Safari → Share → Add to Home Screen). The `notifyOnMessage` function in `functions/` sends an alert to everyone except the sender.
- **Email alerts:** `emailOnMessage` sends through Brevo. It switches on once the `BREVO_KEY` secret exists and `functions/.env` has `EMAIL_ALERTS=on`. Recipients live in Firestore at `settings/notify`.

## Notes for Pakistan connections

- Fonts are self-hosted, so nothing waits on Google Fonts.
- Pages poll gently in demo mode. Live mode uses Firestore long-polling, which copes with patchy mobile data.
- Video notes record at 640×360 and about 0.5 Mbps, so a 1-minute note is about 4 MB. Notes are capped at 2 minutes; change `maxVideoSeconds` in `config.js` to adjust.
- If the connection drops, the last copy of the board stays on screen with a "No internet" banner.
- On Android, Chrome → ⋮ → **Add to Home screen** installs the board like an app.
