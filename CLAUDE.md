# SSC × TRUCK board — notes for Claude sessions

This repo holds the **SSC × TRUCK board**, a live production site that TRUCK Gloves (Brett) shares with its factory, SSC in Sialkot (Mansab and Seqlain). Read this before changing anything. `README.md` covers the code in more detail.

## Where things live

- **Live site:** https://truck-ssc-portal.web.app (Firebase Hosting, project `truck-ssc-portal`, owner brett.keyes72@gmail.com).
- **Code:** this repo. Built on the branch `claude/ssc-truck-website-yrophw`; check which branch you are on before assuming the code is missing.
  - `public/`: the site, plain HTML/CSS/JS with no build step.
  - `functions/`: Cloud Functions (`notifyOnMessage` phone alerts; `emailOnMessage` Brevo email, off until a `BREVO_KEY` secret exists and `functions/.env` has `EMAIL_ALERTS=on`).
  - `firestore.rules`, `storage.rules`: who can read and write.
- **Live data (not in git; this repo is public):**
  - Firestore `board/current`: `{ json, updatedAt, by }`, where `json` is the whole board (pos, custom, samples, shipments, notes, changelog).
  - Firestore `messages/*`: board messages; `org` must match the login (admins are TRUCK, everyone else is SSC).
  - Firestore `settings/notify`: email-alert recipients. `pushsubs/*`: phone-alert devices.
  - Storage `files/**`: PO PDFs and artwork shown on the site (signed-in users read, admins write).
  - Storage `admin/board-sources/`: private working copies of `board.json`, `patch.json` (shipments, alerts, extra samples and changelog layered onto the production board by `tools/sync_board.py --patch`) and `urdu.json` (Urdu overlay). Not readable from the site. Download them before running a sync, and upload them back afterwards.
- **Secrets:** Secret Manager `VAPID_PRIVATE` (phone alerts). Logins are Firebase Auth users; never write passwords into this repo.

## People and logins

- TRUCK admins: the emails in `CONFIG.admins` (`public/js/config.js`). They can edit the board and upload files, and their messages are always filed as Brett · TRUCK.
- SSC: Mansab and Seqlain, one Firebase Auth login each. Their addresses are in Firebase Auth and Firestore `settings/notify`; keep them out of this public repo. Seqlain's address ends in `.com.pk`; the old one without `.pk` is dead.

## How to work on it

- Deploy needs Google credentials for the project (for example `gcloud auth application-default login` as the owner), then `firebase deploy --only hosting` (or `functions`, `firestore:rules`).
- To change board content, edit Firestore `board/current` (or run `tools/sync_board.py` with the files from `admin/board-sources/`, then upload the result). Keep `patch.json` in step so the next sync doesn't undo the change.
- Style follows truckgloves.com: Oswald uppercase headings, Poppins body, square black buttons, category colours (Production rust, Custom glacier blue, Samples charcoal, Messages sand, Files leather). Everything must fit from 320px phones up with no sideways scroll, and every string needs English and Urdu (`public/js/i18n.js`).
- Don't email SSC without Brett's go-ahead.

## Open items (as of Nov 5, 2026)

- Email alerts are waiting on a Brevo API key (sender brett@truckgloves.com).
- The TRUCK icon set will replace the built-in icons: drop SVGs in `public/img/icons/` and set `iconSet` in `public/js/config.js`.
- The sticker sample (`s5`) artwork is up; an email to SSC with the download link is drafted in Brett's Outlook, waiting for his OK.
