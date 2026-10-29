// Two alerts go out whenever someone leaves a message on the board:
//
// 1. Email to the other side, through Brevo (brevo.com). Who gets emailed lives in
//    Firestore at settings/notify (not in this public repo):
//      { "from": "brett@…", "TRUCK": ["brett@…"], "SSC": ["mansab@…"], "off": false }
//    A message from SSC goes to the TRUCK list and the other way round. The Brevo API
//    key is the BREVO_KEY secret; "from" must be a sender verified in Brevo.
//
// 2. A phone / computer notification to everyone else on the board whenever
// someone leaves a message.
//
// Each device that taps "Turn on alerts" saves a Web Push subscription in
// Firestore at pushsubs/{id} = { sub, uid, name, org, at }. When a message is
// created, every subscription except the sender's own gets a notification.
// The VAPID private key is the VAPID_PRIVATE secret; the public half is
// CONFIG.vapidKey in public/js/config.js.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();
const VAPID_PRIVATE = defineSecret("VAPID_PRIVATE");
// Declared only when email is on, so the deploy doesn't ask for a key that doesn't exist yet.
const BREVO_KEY = process.env.EMAIL_ALERTS === "on" ? defineSecret("BREVO_KEY") : null;
const VAPID_PUBLIC = "BEzIBFHdwvhMDP5sX-bcLeCD1VX951xF6Pz9eekYf_SehSScoCcRgB9flbbscSw-tq9r7QUAyZj1e7aVz4nVkFg";
const SITE = "https://truck-ssc-portal.web.app/";

// "custom:c4" → { label: "Park City Ski Patrol", link: "…#/custom/c4" }
function where(topic, board) {
  const [k, id] = (topic || "general").split(":");
  const list = { po: board.pos, custom: board.custom, sample: board.samples }[k] || [];
  const item = list.find(x => x.id === id);
  const page = { po: "production", custom: "custom", sample: "samples" }[k];
  return {
    label: item ? item.po || item.name : "General",
    link: SITE + (page && item ? `#/${page}/${id}` : `#/messages?topic=${encodeURIComponent(topic || "general")}`)
  };
}

exports.notifyOnMessage = onDocumentCreated(
  { document: "messages/{id}", region: "asia-south1", secrets: [VAPID_PRIVATE] },
  async event => {
    const m = event.data?.data();
    if (!m) return;
    const db = admin.firestore();
    const [subs, boardDoc] = await Promise.all([db.collection("pushsubs").get(), db.doc("board/current").get()]);
    const board = boardDoc.exists ? JSON.parse(boardDoc.data().json) : {};
    const w = where(m.topic, board);
    const what = m.kind === "video" ? "🎥 Video note" : m.kind === "audio" ? "🎙 Voice note" : "";
    const payload = JSON.stringify({
      title: `${m.name} (${m.org || "?"}) · ${w.label}`,
      body: [what, m.text].filter(Boolean).join(" — ").slice(0, 180) || "New message",
      url: w.link,
      tag: m.topic || "general"
    });

    webpush.setVapidDetails("mailto:brett@truckgloves.com", VAPID_PUBLIC, VAPID_PRIVATE.value());
    const targets = subs.docs.filter(d => d.data().uid !== m.uid);
    const results = await Promise.allSettled(targets.map(d =>
      webpush.sendNotification(d.data().sub, payload, { TTL: 7 * 86400, urgency: "high" }).catch(async err => {
        // 404/410: the browser dropped this subscription; forget it.
        if (err.statusCode === 404 || err.statusCode === 410) await d.ref.delete();
        throw err;
      })));
    const failed = results.filter(r => r.status === "rejected");
    failed.forEach(r => logger.warn("push failed", r.reason?.statusCode, r.reason?.body || r.reason?.message));
    logger.info(`pushed ${targets.length - failed.length}/${targets.length} for`, event.params.id);
  }
);

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Turned on in functions/.env (EMAIL_ALERTS=on) once the BREVO_KEY secret exists.
if (process.env.EMAIL_ALERTS === "on") exports.emailOnMessage = onDocumentCreated(
  { document: "messages/{id}", region: "asia-south1", secrets: [BREVO_KEY] },
  async event => {
    const m = event.data?.data();
    if (!m) return;
    const db = admin.firestore();
    const [settings, boardDoc] = await Promise.all([db.doc("settings/notify").get(), db.doc("board/current").get()]);
    const cfg = settings.exists ? settings.data() : {};
    if (cfg.off) return;
    const to = (m.org === "SSC" ? cfg.TRUCK : cfg.SSC) || [];
    if (!to.length || !cfg.from) { logger.info("no sender or recipients for", m.org); return; }

    const board = boardDoc.exists ? JSON.parse(boardDoc.data().json) : {};
    const w = where(m.topic, board);
    const what = m.kind === "video" ? "a video note" : m.kind === "audio" ? "a voice note" : "a message";
    const toSSC = m.org !== "SSC";
    const subject = `${m.name} (${m.org || "?"}) left ${what}: ${w.label}`;
    const text = `${m.name} left ${what} about ${w.label}.\n\n${m.text ? m.text + "\n\n" : ""}Open it: ${w.link}\n`;
    const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#171717">
      <p><b>${esc(m.name)}</b> (${esc(m.org)}) left ${what} about <b>${esc(w.label)}</b>.</p>
      ${toSSC ? `<p dir="rtl" style="font-size:18px">بورڈ پر نیا پیغام: <b>${esc(w.label)}</b></p>` : ""}
      ${m.text ? `<blockquote style="margin:16px 0;padding:12px 16px;background:#F7F0DE;border-left:4px solid #CEAF67;white-space:pre-line">${esc(m.text)}</blockquote>` : ""}
      <p><a href="${w.link}" style="display:inline-block;background:#BC5E3C;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Open on the board${toSSC ? " · بورڈ کھولیں" : ""}</a></p>
      <p style="font-size:13px;color:#6b6b6b">SSC × TRUCK board · reply on the board so the whole thread stays with the order.</p></div>`;

    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_KEY.value(), "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "SSC × TRUCK Board", email: cfg.from },
        to: to.map(email => ({ email })),
        subject, textContent: text, htmlContent: html
      })
    });
    if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
    logger.info("emailed", to.length, "about", event.params.id);
  }
);
