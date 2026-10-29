// Email the other side whenever someone leaves a message on the board.
//
// Who gets emailed lives in Firestore at settings/notify (not in this public repo):
//   { "from": "brett@…", "TRUCK": ["brett@…"], "SSC": ["mansab@…", "…"], "off": false }
// A message from SSC goes to the TRUCK list and the other way round.
// Mail goes out through Brevo (brevo.com); its API key is the BREVO_KEY secret, and
// "from" must be a sender verified in the Brevo account.
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const BREVO_KEY = defineSecret("BREVO_KEY");
const SITE = "https://truck-ssc-portal.web.app/";

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

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

exports.emailOnMessage = onDocumentCreated(
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
