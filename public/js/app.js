import { CONFIG } from "./config.js";
import { t, getLang, setLang, applyDir, pick, color, fmtDate, fmtNum } from "./i18n.js";
import * as store from "./store.js";

/* ============================================================
   state
   ============================================================ */
let board = null;
let boardOffline = false;
let user = null;
let messages = [];
let busy = false; // true while recording — never re-render under the user's camera

const main = () => document.getElementById("main");

/* ============================================================
   small helpers
   ============================================================ */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysUntil(iso) {
  if (!iso) return null;
  const a = Date.parse(todayIso() + "T00:00:00Z"), b = Date.parse(iso + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

function me() {
  try { return JSON.parse(localStorage.getItem("ssc-truck-me")); } catch (e) { return null; }
}
function setMe(v) {
  try { localStorage.setItem("ssc-truck-me", JSON.stringify(v)); } catch (e) {}
}

const ICON = {
  production: '<path d="M3 21V10l6 4V10l6 4V6l6 4v11z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
  samples: '<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 15h10"/>',
  custom: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  messages: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  files: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  drive: '<path d="M8 4h8l5 9-4 7H7l-4-7z"/><path d="M8 4l5 9h8M3 13h10l-6 7"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'
};
const icon = (k, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

/* ---------- glove pictures ---------- */
const MODEL_KEYS = [
  ["DRIVER Unlined Economy", "driverunlined"],
  ["DRIVER Cut Resistant", "cl5"],
  ["DRIVER CL5", "cl5"],
  ["DRIVER Unlined", "driverunlined"],
  ["DRIVER Lined", "driverlined"],
  ["Pro Mitten", "promitten"],
  ["M1 PRO", "m1pro"],
  ["M1", "m1"],
  ["Palisade", "palisade"],
  ["Tour", "tour"],
  ["WG", "wg"]
];
const COLOR_KEYS = ["Bright Yellow:yellow", "Bright Orange:orange", "Black:black", "Brown:brown", "Coffee:coffee", "Silver:silver", "Sand:sand", "Tumbleweed:tumbleweed", "Gray:gray", "Sunshine:sunshine"]
  .map(s => s.split(":"));
const HAVE = new Set(["m1-brown", "m1-black", "m1pro-black", "m1pro-brown", "promitten-black", "promitten-brown", "palisade-orange", "palisade-yellow", "tour-gray", "tour-black", "driverlined-coffee", "driverlined-silver", "driverunlined-silver", "driverunlined-sand", "cl5-tumbleweed", "cl5-silver", "wg-black", "wg-sunshine"]);
const FALLBACK = { m1: "m1-brown", m1pro: "m1pro-brown", promitten: "promitten-brown", palisade: "palisade-orange", tour: "tour-black", driverlined: "driverlined-coffee", driverunlined: "driverunlined-silver", cl5: "cl5-tumbleweed", wg: "wg-black" };

function gloveKey(model, col) {
  const text = `${model || ""} ${col || ""}`;
  const mk = MODEL_KEYS.find(([n]) => text.toLowerCase().includes(n.toLowerCase()));
  if (!mk) return null;
  const ck = COLOR_KEYS.find(([n]) => text.toLowerCase().includes(n.toLowerCase()));
  const k = ck ? `${mk[1]}-${ck[1]}` : null;
  if (k && HAVE.has(k)) return k;
  return FALLBACK[mk[1]] || null;
}
function gloveSrc(model, col) {
  const k = gloveKey(model, col);
  return k ? `img/gloves/${k}.jpg` : null;
}
const GLOVE_SVG = `<svg class="glove-ph" viewBox="0 0 100 100" aria-hidden="true"><path d="M30 92V55l-8-14c-3-5 3-9 7-5l8 10V18c0-6 9-6 9 0v24-30c0-6 9-6 9 0v30-26c0-6 9-6 9 0v28-20c0-6 9-6 9 0v40c0 10-4 18-10 22v6z"/><path d="M30 80h40"/></svg>`;
function gloveImg(model, col, cls = "") {
  const src = gloveSrc(model, col);
  return src
    ? `<img class="glove ${cls}" src="${src}" alt="${esc(model)} ${esc(col)}" loading="lazy">`
    : `<div class="glove ${cls} ph">${GLOVE_SVG}</div>`;
}

const isImage = u => /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u || "");
const isPdf = u => /\.pdf(\?|$)/i.test(u || "");

/* ---------- status ---------- */
function poStatus(p) {
  if (p.unplaced) return { k: "notPlaced", tone: "gray" };
  const total = poPairs(p), sent = poShipped(p);
  if (total && sent >= total) return { k: "shipped", tone: "green", done: true };
  if (p.needsOK) return { k: "needsOkShort", tone: "red" };
  if (sent) return { k: "partShipped", tone: "blue" };
  if (p.built) return { k: "built", tone: "blue" };
  return { k: "inProgress", tone: "amber" };
}
function stageStatus(stage) {
  const s = (stage || "").toLowerCase();
  if (s.includes("ship")) return { k: "shipped", tone: "green", done: true };
  if (s.includes("ok")) return { k: "needsOkShort", tone: "red" };
  if (s.includes("confirm")) return { k: "confirmed", tone: "green" };
  if (s.includes("quote")) return { k: "quoted", tone: "gray" };
  if (s.includes("factory")) return { k: "withFactory", tone: "blue" };
  if (s.includes("request")) return { k: "requested", tone: "amber" };
  return { k: "inProgress", tone: "amber" };
}
const chip = st => `<span class="chip ${st.tone}">${esc(t(st.k))}</span>`;

function poShip(p) { return p.sscQuoted?.current || p.hard || null; }
function poPairs(p) { return (p.lines || []).reduce((a, l) => a + linePairs(l), 0); }
function linePairs(l) { return (l.sizes || []).reduce((a, s) => a + (Number(s[1]) || 0), 0); }

/* ---------- shipments: what has already left SSC ----------
   board.shipments[] = { id, ref, dispatched, arrived, cartons, pairs, via, note,
                         lines: [{ po, model, color, sizes: [[size, pairs]] }] }
   A shipment line counts against the PO line with the same po id, model and colour. */
const same = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();
function shipmentsFor(p) { return (board?.shipments || []).filter(sh => (sh.lines || []).some(x => x.po === p.id)); }
function lineShipped(p, l) {
  const out = {};
  for (const sh of board?.shipments || [])
    for (const x of sh.lines || [])
      if (x.po === p.id && same(x.model, l.model) && same(x.color, l.color))
        for (const [sz, q] of x.sizes || []) out[sz] = (out[sz] || 0) + (Number(q) || 0);
  return out;
}
function lineShippedPairs(p, l) { return Object.values(lineShipped(p, l)).reduce((a, b) => a + b, 0); }
function poShipped(p) { return (p.lines || []).reduce((a, l) => a + Math.min(lineShippedPairs(p, l), linePairs(l)), 0); }
function lastShipment() {
  return [...(board?.shipments || [])].sort((a, b) => (b.arrived || b.dispatched || "").localeCompare(a.arrived || a.dispatched || ""))[0] || null;
}

function itemRow(c, label) { return (c.items || []).find(r => (r[0] || "").toLowerCase() === label.toLowerCase()); }
function customPairs(c) {
  const first = (c.items || [])[0];
  const m = first && /^(\d+)\s*pr/.exec(first[0]);
  return m ? Number(m[1]) : null;
}
function customGlove(c) { return (c.items || [])[0]?.[1] || ""; }
function customHero(c) {
  const img = (c.docs || []).find(d => isImage(d.url) && /mockup|artwork|cuff/i.test(d.url + d.label))
    || (c.docs || []).find(d => isImage(d.url));
  return img ? store.href(img) : null;
}

/* ---------- date panel: the big "ship by / days left" block ---------- */
function datePanel(iso, labelKey = "shipBy", small = false) {
  const n = daysUntil(iso);
  let tone = "none", big = "—", sub = t("noDate");
  if (n !== null) {
    if (n < 0) { tone = "red"; big = fmtNum(-n); sub = t(-n === 1 ? "dayLate" : "daysLate"); }
    else if (n === 0) { tone = "red"; big = "0"; sub = t("today"); }
    else { tone = n <= 10 ? "red" : n <= 30 ? "amber" : "green"; big = fmtNum(n); sub = t(n === 1 ? "dayLeft" : "daysLeft"); }
  }
  return `<div class="datepanel ${small ? "sm" : ""}">
    <div class="dp-date"><span class="k">${esc(t(labelKey))}</span><b>${esc(fmtDate(iso))}</b><i>${iso ? iso.slice(0, 4) : ""}</i></div>
    <div class="dp-days ${tone}"><b>${big}</b><i>${esc(sub)}</i></div>
  </div>`;
}

function textBlock(obj, field, cls = "") {
  const { text, english } = pick(obj, field);
  if (!text) return "";
  return `<p class="txt ${cls}" ${english ? 'dir="ltr" lang="en"' : ""}>${english ? `<span class="enflag">${esc(t("englishOnly"))}</span>` : ""}${esc(text)}</p>`;
}

function talkButton(topic) {
  return `<a class="bigbtn purple talk" href="#/messages?topic=${encodeURIComponent(topic)}">${icon("messages")}<span><b>${esc(t("talk"))}</b><i>${esc(t("talkSub"))}</i></span></a>`;
}

function fileButton(d, opts = {}) {
  const u = store.href(d);
  if (!u) return `<span class="filebtn missing">${icon("doc")}<span><b>${esc(d.label || t("noPoFile"))}</b>${d.note ? `<i>${esc(d.note)}</i>` : ""}</span></span>`;
  const ico = /drive\.google/.test(u) ? "drive" : isPdf(u) || /export=download/.test(u) ? "download" : "download";
  return `<a class="filebtn ${opts.primary ? "primary" : ""}" href="${esc(u)}" target="_blank" rel="noopener" ${/drive\.google|claude\.ai/.test(u) ? "" : "download"}>${icon(ico)}<span><b>${esc(d.label || t("download"))}</b>${opts.sub ? `<i>${esc(opts.sub)}</i>` : ""}</span></a>`;
}

/* ============================================================
   page frame
   ============================================================ */
function renderFrame() {
  document.getElementById("app").innerHTML = `
    <header class="top">
      <div class="wrap topin">
        <a class="brand" href="#/" aria-label="${esc(t("home"))}">
          <img class="logo" src="img/truck-logo.png" alt="TRUCK">
          <span class="brandtxt"><b>${esc(t("siteName"))}</b><i>${esc(t("siteSub"))}</i></span>
        </a>
        <button class="langbtn" id="langbtn" type="button">
          <b>${esc(t("langButton"))}</b><i>${esc(t("langButtonSub"))}</i>
        </button>
      </div>
    </header>
    <div id="banner"></div>
    <main id="main" class="wrap"></main>
    <nav class="tabs" aria-label="Main">
      ${["home", "production", "custom", "samples", "messages", "files"].map(k =>
        `<a href="#/${k === "home" ? "" : k}" data-tab="${k}" class="tab ${k}">${icon(k)}<span>${esc(t(k))}</span></a>`).join("")}
    </nav>`;
  document.getElementById("langbtn").onclick = () => {
    setLang(getLang() === "en" ? "ur" : "en");
    renderFrame();
    route();
  };
}

function setBanner() {
  const b = document.getElementById("banner");
  if (!b) return;
  const bits = [];
  if (boardOffline) bits.push(`<div class="banner amber">${esc(t("offline"))}</div>`);
  if (!store.LIVE && !window.__BOARD_PREVIEW__) bits.push(`<div class="banner gray">${esc(t("demoBanner"))}</div>`);
  b.innerHTML = bits.join("");
}

function markTab(k) {
  document.querySelectorAll(".tabs .tab").forEach(a => a.classList.toggle("on", a.dataset.tab === k));
}

function pageHead(bucket, title, sub, backHref) {
  return `<div class="pagehead ${bucket}">
    <a class="backbtn" href="${backHref || "#/"}">${icon("back")}<span>${esc(t("back"))}</span></a>
    <div class="ph-title">${icon(bucket, "big")}<div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div></div>
  </div>`;
}

/* ============================================================
   router
   ============================================================ */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  const parts = path.split("/").filter(Boolean);
  const q = new URLSearchParams(qs || "");
  return { parts, q };
}

function route() {
  if (busy) return;
  const { parts, q } = parseHash();
  const [a, b] = parts;
  setBanner();

  if (store.LIVE && !user) { markTab(""); return renderSignIn(); }
  if (!board && a !== "messages") { main().innerHTML = `<div class="loading">${esc(t("loading"))}</div>`; return; }

  window.scrollTo({ top: 0 });
  switch (a) {
    case undefined: markTab("home"); return renderHome();
    case "production": markTab("production"); return b ? renderPO(b) : renderProduction();
    case "custom": markTab("custom"); return b ? renderCustomOne(b) : renderCustom();
    case "samples": markTab("samples"); return b ? renderSample(b) : renderSamples();
    case "messages": markTab("messages"); return renderMessages(q.get("topic") || "");
    case "files": markTab("files"); return renderFiles();
    case "admin": markTab(""); return renderAdmin();
    default: main().innerHTML = `<p class="empty">${esc(t("notFound"))}</p>`;
  }
}

// re-render after data changes without jumping the page to the top
function refresh() {
  if (busy) return;
  const y = window.scrollY;
  route();
  window.scrollTo({ top: y });
}

/* ============================================================
   HOME
   ============================================================ */
function nextDate(list) {
  const today = todayIso();
  return list.filter(Boolean).filter(d => d >= today).sort()[0] || null;
}

function renderHome() {
  const who = me();
  const pos = board.pos || [], cus = (board.custom || []), smp = board.samples || [];
  const cusActive = cus.filter(c => !stageStatus(c.stage).done);
  const needs = [
    ...pos.filter(p => p.needsOK).map(p => ({ href: `#/production/${p.id}`, title: p.po, sub: p.label, bucket: "production", img: gloveSrc(p.lines?.[0]?.model, p.lines?.[0]?.color) })),
    ...cus.filter(c => stageStatus(c.stage).k === "needsOkShort").map(c => ({ href: `#/custom/${c.id}`, title: c.name, sub: c.po || "", bucket: "custom", img: customHero(c) || gloveSrc(customGlove(c)) }))
  ];
  const recent = messages.filter(m => Date.now() - m.at < 7 * 86400000).length;

  const tile = (k, count, unit, date) => `
    <a class="bigtile ${k}" href="#/${k}">
      <span class="bt-ico">${icon(k)}</span>
      <span class="bt-name">${esc(t(k))}</span>
      <span class="bt-sub">${esc(t(k + "Sub"))}</span>
      ${count !== null ? `<span class="bt-count"><b>${fmtNum(count)}</b> ${esc(t(unit))}</span>` : ""}
      ${date !== undefined ? `<span class="bt-date">${esc(t("nextShip"))}: <b>${esc(fmtDate(date))}</b></span>` : ""}
    </a>`;

  main().innerHTML = `
    <section class="hello">
      <h1>${esc(who ? t("hello", { name: who.name }) : t("helloAnon"))}</h1>
      <p>${esc(t("pickArea"))}</p>
    </section>

    ${(() => { const sh = lastShipment(); return sh ? `<section class="arrived">
      ${icon("production", "big")}
      <div><h2>${esc(t(sh.arrived ? "shipmentArrived" : "shipmentOnWay"))}</h2>
        <p><b dir="ltr">${esc(sh.ref)}</b> · ${fmtNum(sh.pairs)} ${esc(t("pairs"))} · ${fmtNum(sh.cartons)} ${esc(t("cartons"))} · ${esc(fmtDate(sh.arrived || sh.dispatched, true))}</p>
        ${textBlock(sh, "note", "small")}</div>
    </section>` : ""; })()}

    ${needs.length ? `<section class="needs">
      <h2>${icon("alert")} ${esc(t("needsOk"))} <span class="count">${needs.length}</span></h2>
      <div class="needsrow">${needs.map(n => `
        <a class="needcard ${n.bucket}" href="${n.href}">
          ${n.img ? `<img src="${esc(n.img)}" alt="" loading="lazy">` : `<div class="ph">${GLOVE_SVG}</div>`}
          <span><b>${esc(n.title)}</b><i>${esc(n.sub)}</i></span>
        </a>`).join("")}</div>
    </section>` : ""}

    <section class="tilegrid">
      ${tile("production", pos.length, "orders", nextDate(pos.map(poShip)))}
      ${tile("custom", cusActive.length, "projects", nextDate(cusActive.map(c => c.current)))}
      ${tile("samples", smp.length, "requests", nextDate(smp.map(s => s.current)))}
      ${tile("messages", recent || null, "messages")}
      ${tile("files", null)}
      ${store.LIVE && store.isAdmin(user) ? `<a class="bigtile admin" href="#/admin"><span class="bt-ico">${icon("admin")}</span><span class="bt-name">${esc(t("admin"))}</span><span class="bt-sub">${esc(t("adminSub"))}</span></a>` : ""}
    </section>

    ${renderUpdates()}
    ${board._updatedAt ? `<p class="stamp">${esc(t("lastUpdated"))}: ${esc(new Date(board._updatedAt).toLocaleString())}</p>` : ""}
    ${store.LIVE ? `<p class="stamp"><button class="linkbtn" id="signout">${esc(t("signOut"))} (${esc(user?.email || "")})</button></p>` : ""}
  `;
  const so = document.getElementById("signout");
  if (so) so.onclick = () => store.signOut();
}

function renderUpdates() {
  const log = (board.changelog || []).slice(0, 3);
  if (!log.length) return "";
  return `<section class="card updates">
    <h2>${esc(t("recentUpdates"))}</h2>
    ${log.map(u => `<div class="upd"><b>${esc(fmtDate(u.date, true))}</b>${u.by ? ` · <i>${esc(u.by)}</i>` : ""}
      <ul ${getLang() === "ur" && !u.ur ? 'dir="ltr" lang="en"' : ""}>${(getLang() === "ur" && u.ur ? u.ur : u.items).map(i => `<li>${esc(i)}</li>`).join("")}</ul></div>`).join("")}
  </section>`;
}

/* ============================================================
   PRODUCTION
   ============================================================ */
function renderProduction() {
  const pos = [...(board.pos || [])].sort((a, b) => (poShip(a) || "9999").localeCompare(poShip(b) || "9999"));
  main().innerHTML = `
    ${pageHead("production", t("production"), t("productionSub"))}
    ${textBlock(board.notes ? { note: board.notes.production, ur: { note: board.notes.ur?.production } } : null, "note", "boardnote")}
    <div class="cards">
      ${pos.map(p => {
        const pics = (p.lines || []).filter(l => linePairs(l) > 0 || p.unplaced).slice(0, 3);
        const pairs = poPairs(p), sent = poShipped(p), st = poStatus(p);
        return `<a class="ordercard production ${p.needsOK && !st.done ? "alert" : ""} ${st.done ? "done" : ""}" href="#/production/${esc(p.id)}">
          <div class="oc-pics n${Math.max(pics.length, 1)}">${pics.length ? pics.map(l => gloveImg(l.model, l.color)).join("") : `<div class="glove ph">${GLOVE_SVG}</div>`}</div>
          <div class="oc-body">
            <div class="oc-top">${chip(st)}</div>
            <h2 dir="ltr">${esc(p.po)}</h2>
            <p class="oc-label">${esc(pick(p, "label").text)}</p>
            ${pairs ? `<p class="oc-pairs"><b>${fmtNum(pairs)}</b> ${esc(t("pairs"))}</p>` : ""}
            ${sent ? progressBar(sent, pairs) : ""}
          </div>
          ${datePanel(poShip(p), "shipBy", true)}
        </a>`;
      }).join("")}
    </div>`;
}

function progressBar(sent, total) {
  const pct = total ? Math.min(100, Math.round(sent / total * 100)) : 0;
  return `<div class="progress"><span style="width:${pct}%"></span></div>
    <p class="progtxt">✓ <b>${fmtNum(sent)}</b> ${esc(t("shippedOf"))} ${fmtNum(total)} · <b>${fmtNum(Math.max(0, total - sent))}</b> ${esc(t("toGo"))}</p>`;
}

// shipped = { size: pairs already sent }. A size that is fully sent turns green with a tick.
function sizeChips(sizes, shipped = {}) {
  const list = (sizes || []).filter(s => Number(s[1]) > 0);
  if (!list.length) return "";
  return `<div class="sizes">${list.map(s => {
    const q = Number(s[1]), sent = Math.min(shipped[s[0]] || 0, q), left = q - sent;
    const cls = sent && !left ? "done" : sent ? "part" : "";
    return `<span class="sz ${cls}"><i>${esc(t("size"))}</i><b>${esc(s[0])}</b><em>${sent && !left ? "✓ " + fmtNum(q) : fmtNum(left)}</em>${sent && left ? `<s>✓ ${fmtNum(sent)}</s>` : ""}</span>`;
  }).join("")}</div>`;
}

function renderPO(id) {
  const p = (board.pos || []).find(x => x.id === id);
  if (!p) { main().innerHTML = `<p class="empty">${esc(t("notFound"))}</p>`; return; }
  const st = poStatus(p);
  const mand = new Set((p.mandatoryModels || []).map(s => s.toLowerCase()));
  const isDone = l => linePairs(l) && lineShippedPairs(p, l) >= linePairs(l);
  const lines = [...(p.lines || [])].sort((a, b) => (isDone(a) - isDone(b)) || (mand.has(b.model.toLowerCase()) - mand.has(a.model.toLowerCase())) || (a.tier || 9) - (b.tier || 9));
  const ships = shipmentsFor(p);
  const hist = p.sscQuoted?.history || [];

  main().innerHTML = `
    ${pageHead("production", p.po, pick(p, "label").text, "#/production")}
    <section class="hero production">
      <div class="hero-l">
        ${chip(st)}
        <div class="facts">
          <div><span>${esc(t("totalPairs"))}</span><b>${fmtNum(poPairs(p))}</b></div>
          <div><span>${esc(t("poDate"))}</span><b>${esc(fmtDate(p.poDate, true))}</b></div>
          ${p.hard && p.hard !== poShip(p) ? `<div><span>${esc(t("shipByLong"))}</span><b>${esc(fmtDate(p.hard, true))}</b></div>` : ""}
          ${poShipped(p) ? `<div><span>${esc(t("alreadyShipped"))}</span><b>${fmtNum(poShipped(p))}</b></div><div><span>${esc(t("stillToShip"))}</span><b>${fmtNum(poPairs(p) - poShipped(p))}</b></div>` : ""}
        </div>
      </div>
      ${st.done ? "" : datePanel(poShip(p), poShipped(p) ? "balanceShipBy" : "shipBy")}
    </section>

    ${p.alert ? `<section class="todo amber">${icon("alert", "big")}<div><h2>${esc(pick(p, "alertHead").text || t("heads"))}</h2>${textBlock(p, "alert")}</div></section>` : ""}

    ${p.needsOK && !st.done ? `<section class="todo red">${icon("alert", "big")}<div><h2>${esc(t("whatToDo"))}</h2>${textBlock(p, "needsOKNote")}</div></section>` : ""}

    ${p.mandatoryText || mand.size ? `<section class="todo amber"><div><h2>⭐ ${esc(t("priorityText"))}</h2>
      ${mand.size ? `<p class="mands" dir="ltr">${[...(p.mandatoryModels || [])].map(m => `<span>${esc(m)}</span>`).join("")}</p>` : ""}
      ${textBlock(p, "mandatoryText")}</div></section>` : ""}

    <section class="filesrow">
      ${p.doc ? fileButton({ ...p.doc, label: p.doc.url ? `${t("downloadPo")} · ${p.po}` : p.doc.label }, { primary: true }) : ""}
      ${talkButton("po:" + p.id)}
    </section>

    <h2 class="sech">${esc(t("gloves"))}</h2>
    <div class="glovegrid">
      ${lines.map(l => {
        const n = linePairs(l), shipped = lineShipped(p, l), sent = Math.min(lineShippedPairs(p, l), n);
        const done = n && sent >= n, pri = mand.has(l.model.toLowerCase()) && !done;
        return `<article class="glovecard ${pri ? "pri" : ""} ${n ? "" : "zero"} ${done ? "sent" : ""}">
          ${pri ? `<span class="ribbon">⭐ ${esc(t("priority"))}</span>` : ""}
          ${done ? `<span class="ribbon green">✓ ${esc(t("shipped"))}</span>` : sent ? `<span class="ribbon blue">✓ ${fmtNum(sent)} ${esc(t("shipped"))}</span>` : ""}
          <div class="gc-pic">${gloveImg(l.model, l.color, "lg")}</div>
          <div class="gc-body">
            <h3 dir="ltr">${esc(l.model)}</h3>
            <p class="gc-color">${esc(color(l.color))}</p>
            <p class="gc-pairs"><b>${fmtNum(n)}</b> ${esc(t("pairs"))}</p>
            ${sizeChips(l.sizes, shipped)}
            ${sent && !done ? `<p class="progtxt"><b>${fmtNum(n - sent)}</b> ${esc(t("toGo"))}</p>` : ""}
            ${textBlock(l, "note", "small")}
          </div>
        </article>`;
      }).join("")}
    </div>

    ${ships.length ? `<section class="card shipments"><h2>${esc(t("shipments"))}</h2>
      ${ships.map(sh => {
        const mine = (sh.lines || []).filter(x => x.po === p.id);
        const n = mine.reduce((a, x) => a + (x.sizes || []).reduce((b, s) => b + (Number(s[1]) || 0), 0), 0);
        return `<div class="shiprow">
          <div class="sr-top"><b dir="ltr">${esc(sh.ref)}</b><span class="chip green">${esc(t(sh.arrived ? "arrived" : "onTheWay"))} · ${esc(fmtDate(sh.arrived || sh.dispatched, true))}</span></div>
          <p>${fmtNum(n)} ${esc(t("pairs"))} ${esc(t("fromThisPo"))}${sh.via ? ` · <span dir="auto">${esc(pick(sh, "via").text)}</span>` : ""}</p>
          <ul>${mine.map(x => `<li dir="ltr">${esc(x.model)} ${esc(x.color)} — ${(x.sizes || []).map(s => `${esc(s[0])}:${fmtNum(s[1])}`).join(" · ")}</li>`).join("")}</ul>
        </div>`;
      }).join("")}
    </section>` : ""}

    ${(p.amended || p.specialTerms || p.payTerms) ? `<section class="card notes">
      <h2>${esc(t("notes"))}</h2>
      ${p.amendedHead ? `<h3>${esc(p.amendedHead)}</h3>` : ""}${textBlock(p, "amended")}
      ${p.specialTermsHead ? `<h3>${esc(p.specialTermsHead)}</h3>` : ""}${textBlock(p, "specialTerms")}
      ${p.payTerms ? `<h3>${esc(t("payments"))}</h3>${textBlock(p, "payTerms")}` : ""}
    </section>` : ""}

    ${hist.length ? `<section class="card"><h2>${esc(t("shipDateHistory"))}</h2>
      <ol class="hist">${hist.map(h => `<li><b>${esc(fmtDate(h.date, true))}</b><span dir="auto">${esc(h.note)}</span></li>`).join("")}</ol></section>` : ""}
  `;
}

/* ============================================================
   CUSTOM
   ============================================================ */
function customCard(c) {
  const st = stageStatus(c.stage);
  const hero = customHero(c);
  const pairs = customPairs(c);
  return `<a class="ordercard custom ${st.k === "needsOkShort" ? "alert" : ""} ${st.done ? "done" : ""}" href="#/custom/${esc(c.id)}">
    <div class="oc-pics n1 ${hero ? "art" : ""}">${hero ? `<img class="glove" src="${esc(hero)}" alt="" loading="lazy">` : gloveImg(customGlove(c), customGlove(c))}</div>
    <div class="oc-body">
      <div class="oc-top">${chip(st)}${c.replacement ? `<span class="chip gray">RPL</span>` : ""}</div>
      <h2>${esc(c.name)}</h2>
      <p class="oc-label" dir="auto">${esc(c.po || c.account || "")}</p>
      ${pairs ? `<p class="oc-pairs"><b>${fmtNum(pairs)}</b> ${esc(t("pairs"))} · <span dir="ltr">${esc(customGlove(c).split(/[—,(]/)[0].trim())}</span></p>` : ""}
    </div>
    ${st.done ? "" : datePanel(c.current, "shipBy", true)}
  </a>`;
}

function renderCustom() {
  const list = board.custom || [];
  const active = list.filter(c => !stageStatus(c.stage).done).sort((a, b) => (a.current || "9999").localeCompare(b.current || "9999"));
  const done = list.filter(c => stageStatus(c.stage).done);
  main().innerHTML = `
    ${pageHead("custom", t("custom"), t("customSub"))}
    ${textBlock(board.notes ? { note: board.notes.custom, ur: { note: board.notes.ur?.custom } } : null, "note", "boardnote")}
    <div class="cards">${active.map(customCard).join("")}</div>
    ${done.length ? `<details class="donefold"><summary>${esc(t("doneSection"))} · ${esc(t("doneCount", { n: done.length }))}</summary>
      <div class="cards">${done.map(customCard).join("")}</div></details>` : ""}`;
}

function docGallery(docs) {
  const imgs = docs.filter(d => isImage(d.url) && store.href(d));
  const pdfs = docs.filter(d => isPdf(d.url) && store.href(d));
  const other = docs.filter(d => !imgs.includes(d) && !pdfs.includes(d));
  let html = "";
  if (imgs.length) html += `<section class="card art">
      <h2>${esc(t("artwork"))}</h2><p class="hint">${esc(t("artworkSub"))}</p>
      <div class="artgrid">${imgs.map(d => `<figure>
        <button class="zoom" data-src="${esc(store.href(d))}" type="button"><img src="${esc(store.href(d))}" alt="${esc(d.label)}" loading="lazy"></button>
        <figcaption>${esc(d.label)} <a href="${esc(store.href(d))}" download>${icon("download")}</a></figcaption></figure>`).join("")}</div>
    </section>`;
  if (pdfs.length || other.length) html += `<section class="card">
      <h2>${esc(t("allFiles"))}</h2>
      <div class="filelist">${[...pdfs, ...other].map(d => `<div class="fileitem">
        ${fileButton(d)}
        ${isPdf(d.url) && store.href(d) ? `<button class="pdftoggle" type="button" data-src="${esc(store.href(d))}">${esc(t("viewPdf"))}</button><div class="pdfbox"></div>` : ""}
      </div>`).join("")}</div>
    </section>`;
  return html;
}

function wireGallery() {
  main().querySelectorAll(".zoom").forEach(b => b.onclick = () => lightbox(b.dataset.src));
  main().querySelectorAll(".pdftoggle").forEach(b => b.onclick = () => {
    const box = b.nextElementSibling;
    if (box.innerHTML) { box.innerHTML = ""; b.textContent = t("viewPdf"); return; }
    box.innerHTML = `<iframe src="${esc(b.dataset.src)}#view=FitH" title="PDF"></iframe>`;
    b.textContent = t("hidePdf");
  });
}

function lightbox(src) {
  const d = document.createElement("div");
  d.className = "lightbox";
  d.innerHTML = `<img src="${esc(src)}" alt=""><button type="button" aria-label="Close">✕</button>`;
  d.onclick = () => d.remove();
  document.body.appendChild(d);
}

function renderCustomOne(id) {
  const c = (board.custom || []).find(x => x.id === id);
  if (!c) { main().innerHTML = `<p class="empty">${esc(t("notFound"))}</p>`; return; }
  const st = stageStatus(c.stage);
  const sizes = itemRow(c, "Sizes");
  const needed = itemRow(c, "Needed by");
  const glove = customGlove(c);
  const sizeList = sizes ? sizes[1].split("·").map(s => s.trim().split(":")).filter(s => s.length === 2) : [];
  const rest = (c.items || []).slice(1).filter(r => !["sizes"].includes((r[0] || "").toLowerCase()));

  main().innerHTML = `
    ${pageHead("custom", c.name, c.account, "#/custom")}
    <section class="hero custom">
      <div class="hero-l">
        ${chip(st)}
        <div class="facts">
          ${customPairs(c) ? `<div><span>${esc(t("totalPairs"))}</span><b>${fmtNum(customPairs(c))}</b></div>` : ""}
          ${c.po ? `<div><span>PO</span><b dir="ltr">${esc(c.po)}</b></div>` : ""}
          ${c.ssc ? `<div><span>${esc(t("payments"))}</span><b>${esc(/not/i.test(c.ssc) ? t("notPaid") : t("paid"))}</b></div>` : ""}
        </div>
      </div>
      ${st.done ? "" : datePanel(c.current, "shipBy")}
    </section>

    ${st.k === "needsOkShort" ? `<section class="todo red">${icon("alert", "big")}<div><h2>${esc(t("whatToDo"))}</h2>${textBlock(c, "note")}</div></section>` : ""}

    <section class="glovehero card">
      <div class="gh-pic">${gloveImg(glove, glove, "xl")}</div>
      <div class="gh-body">
        <h2 dir="ltr">${esc(glove)}</h2>
        ${sizeList.length ? `<div class="sizes">${sizeList.map(([s, q]) => `<span class="sz"><i>${esc(t("size"))}</i><b>${esc(s)}</b><em>${esc(q)}</em></span>`).join("")}</div>` : ""}
        ${needed ? `<p class="needed"><span>${esc(t("neededBy"))}</span> <b dir="auto">${esc(needed[1])}</b></p>` : ""}
      </div>
    </section>

    ${docGallery(c.docs || [])}

    <section class="filesrow">
      ${c.art?.url ? fileButton({ url: c.art.url, label: t("artFolder") }, { sub: c.art.folder }) : ""}
      ${talkButton("custom:" + c.id)}
    </section>

    ${rest.length ? `<section class="card"><h2>${esc(t("items"))}</h2>
      <dl class="kv">${rest.map(r => `<dt>${esc(r[0])}</dt><dd dir="auto">${esc(r[1])}</dd>`).join("")}</dl></section>` : ""}

    ${st.k !== "needsOkShort" && c.note ? `<section class="card notes"><h2>${esc(t("notes"))}</h2>${textBlock(c, "note")}</section>` : ""}
  `;
  wireGallery();
}

/* ============================================================
   SAMPLES
   ============================================================ */
function renderSamples() {
  const list = board.samples || [];
  main().innerHTML = `
    ${pageHead("samples", t("samples"), t("samplesSub"))}
    ${textBlock(board.notes ? { note: board.notes.samples, ur: { note: board.notes.ur?.samples } } : null, "note", "boardnote")}
    <div class="cards">${list.map(s => {
      const st = stageStatus(s.stage);
      const pics = (s.items || []).map(i => gloveSrc(i[1])).filter(Boolean).slice(0, 3);
      return `<a class="ordercard samples" href="#/samples/${esc(s.id)}">
        <div class="oc-pics n${Math.max(pics.length, 1)}">${pics.length ? pics.map(src => `<img class="glove" src="${src}" alt="" loading="lazy">`).join("") : `<div class="glove ph">${GLOVE_SVG}</div>`}</div>
        <div class="oc-body">
          <div class="oc-top">${chip(st)}</div>
          <h2>${esc(s.name)}</h2>
          <p class="oc-label" dir="auto">${esc(pick(s, "detail").text)}</p>
        </div>
        ${datePanel(s.current, "neededBy", true)}
      </a>`;
    }).join("")}</div>`;
}

function renderSample(id) {
  const s = (board.samples || []).find(x => x.id === id);
  if (!s) { main().innerHTML = `<p class="empty">${esc(t("notFound"))}</p>`; return; }
  main().innerHTML = `
    ${pageHead("samples", s.name, pick(s, "detail").text, "#/samples")}
    <section class="hero samples">
      <div class="hero-l">${chip(stageStatus(s.stage))}</div>
      ${datePanel(s.current, "neededBy")}
    </section>
    <h2 class="sech">${esc(t("items"))}</h2>
    <div class="glovegrid">${(s.items || []).map(i => `
      <article class="glovecard">
        <div class="gc-pic">${gloveImg(i[1], i[1], "lg")}</div>
        <div class="gc-body"><p class="gc-pairs"><b dir="ltr">${esc(i[0])}</b></p><h3 class="wrap-ok" dir="ltr">${esc(i[1])}</h3></div>
      </article>`).join("")}</div>
    ${docGallery(s.docs || [])}
    <section class="filesrow">${talkButton("sample:" + s.id)}</section>
    ${s.note ? `<section class="card notes"><h2>${esc(t("notes"))}</h2>${textBlock(s, "note")}</section>` : ""}
  `;
  wireGallery();
}

/* ============================================================
   FILES
   ============================================================ */
function renderFiles() {
  const dr = board.drive || {};
  const group = (k, rows) => rows.length ? `<section class="card filegroup ${k}"><h2>${icon(k)} ${esc(t(k))}</h2>${rows.join("")}</section>` : "";
  const prod = (board.pos || []).filter(p => p.doc).map(p => `<div class="frow"><h3 dir="ltr">${esc(p.po)}</h3><div class="filelist">${fileButton({ ...p.doc, label: p.doc.url ? t("downloadPo") : p.doc.label })}</div></div>`);
  const cus = (board.custom || []).filter(c => (c.docs || []).length || c.art).map(c => `<div class="frow"><h3>${esc(c.name)}</h3><div class="filelist">
      ${(c.docs || []).map(d => fileButton(d)).join("")}${c.art?.url ? fileButton({ url: c.art.url, label: t("artFolder") }) : ""}</div></div>`);
  const smp = (board.samples || []).filter(s => (s.docs || []).length).map(s => `<div class="frow"><h3>${esc(s.name)}</h3><div class="filelist">${s.docs.map(d => fileButton(d)).join("")}</div></div>`);

  main().innerHTML = `
    ${pageHead("files", t("files"), t("filesSub"))}
    ${dr.root ? `<section class="card filegroup"><h2>${icon("drive")} ${esc(t("driveFolders"))}</h2><div class="filelist">
      ${fileButton({ url: dr.root, label: t("driveRoot") }, { primary: true, sub: dr.label })}
      ${dr.production ? fileButton({ url: dr.production, label: t("production") }) : ""}
      ${dr.custom ? fileButton({ url: dr.custom, label: t("custom") }) : ""}
      ${dr.samples ? fileButton({ url: dr.samples, label: t("samples") }) : ""}
    </div></section>` : ""}
    ${group("production", prod)}${group("custom", cus)}${group("samples", smp)}`;
}

/* ============================================================
   MESSAGES — video, voice and text notes (like Marco Polo)
   ============================================================ */
function topicLabel(topic) {
  if (!topic || topic === "general") return t("general");
  const [k, id] = topic.split(":");
  if (k === "po") { const p = (board?.pos || []).find(x => x.id === id); return p ? p.po : topic; }
  if (k === "custom") { const c = (board?.custom || []).find(x => x.id === id); return c ? c.name : topic; }
  if (k === "sample") { const s = (board?.samples || []).find(x => x.id === id); return s ? s.name : topic; }
  if (["production", "custom", "samples"].includes(k)) return t(k);
  return topic;
}
function topicHref(topic) {
  const [k, id] = (topic || "").split(":");
  return { po: `#/production/${id}`, custom: `#/custom/${id}`, sample: `#/samples/${id}` }[k] || null;
}
function topicBucket(topic) {
  const k = (topic || "").split(":")[0];
  return { po: "production", production: "production", custom: "custom", sample: "samples", samples: "samples" }[k] || "messages";
}

function renderMessages(topic) {
  const who = me();
  if (!who) return renderWho(() => renderMessages(topic));
  const topics = ["", "general", "production", "custom", "samples"];
  if (topic && !topics.includes(topic)) topics.push(topic);

  main().innerHTML = `
    ${pageHead("messages", t("messages"), t("messagesSub"))}
    <div class="topics">${topics.map(tp => `<a class="tchip ${topicBucket(tp)} ${tp === topic ? "on" : ""}" href="#/messages${tp ? "?topic=" + encodeURIComponent(tp) : ""}">${esc(tp ? topicLabel(tp) : t("allTopics"))}</a>`).join("")}</div>

    <section class="composer card">
      <div class="whoami"><span class="avatar ${who.org === "SSC" ? "ssc" : "truck"}">${esc(who.name[0] || "?")}</span>
        <b>${esc(who.name)}</b> <i>${esc(who.org || "")}</i>
        <button class="linkbtn" id="changeme" type="button">${esc(t("change"))}</button>
        ${topic ? `<span class="chip ${topicBucket(topic)}">${esc(t("topic"))}: ${esc(topicLabel(topic))}</span>` : ""}
      </div>
      <div class="modes">
        <button class="bigbtn red" data-mode="video" type="button">${icon("video")}<span><b>${esc(t("recordVideo"))}</b></span></button>
        <button class="bigbtn blue" data-mode="audio" type="button">${icon("mic")}<span><b>${esc(t("recordVoice"))}</b></span></button>
        <button class="bigbtn green" data-mode="text" type="button">${icon("text")}<span><b>${esc(t("typeText"))}</b></span></button>
      </div>
      <div id="panel"></div>
    </section>

    <div id="feed" class="feed"></div>

    <a class="bigbtn gray callbtn" href="https://meet.jit.si/TRUCK-SSC-${encodeURIComponent((topic || "general").replace(/[^a-z0-9]/gi, "-"))}" target="_blank" rel="noopener">${icon("call")}<span><b>${esc(t("liveVideoCall"))}</b><i>${esc(t("liveVideoCallSub"))}</i></span></a>
  `;
  document.getElementById("changeme").onclick = () => renderWho(() => renderMessages(topic), true);
  main().querySelectorAll("[data-mode]").forEach(b => b.onclick = () => openPanel(b.dataset.mode, topic));
  drawFeed(topic);
}

function drawFeed(topic) {
  const el = document.getElementById("feed");
  if (!el) return;
  const list = messages.filter(m => !topic || m.topic === topic || (["production", "custom", "samples"].includes(topic) && topicBucket(m.topic) === topic));
  if (!list.length) { el.innerHTML = `<p class="empty big">${esc(t("noMessages"))}</p>`; return; }
  const mine = me()?.name;
  el.innerHTML = list.map(m => {
    const src = m.url || (m.blob ? URL.createObjectURL(m.blob) : null);
    const th = topicHref(m.topic);
    const body = m.kind === "video" && src ? `<video src="${esc(src)}" controls playsinline preload="metadata"></video>`
      : m.kind === "audio" && src ? `<audio src="${esc(src)}" controls preload="metadata"></audio>` : "";
    return `<article class="msg ${m.name === mine ? "mine" : ""}">
      <span class="avatar ${m.org === "SSC" ? "ssc" : "truck"}">${esc((m.name || "?")[0])}</span>
      <div class="bubble">
        <header><b>${esc(m.name)}</b> <i>${esc(m.org || "")}</i> <time>${esc(new Date(m.at).toLocaleString())}</time></header>
        ${m.topic && m.topic !== "general" ? `<a class="chip ${topicBucket(m.topic)}" ${th ? `href="${th}"` : ""}>${esc(topicLabel(m.topic))}</a>` : ""}
        ${body}
        ${m.text ? `<p dir="auto">${esc(m.text)}</p>` : ""}
      </div>
    </article>`;
  }).join("");
}

function openPanel(mode, topic) {
  const panel = document.getElementById("panel");
  const who = me();
  const done = () => { busy = false; panel.innerHTML = `<p class="sentok">✓ ${esc(t("sent"))}</p>`; setTimeout(() => { if (panel.isConnected && panel.querySelector(".sentok")) panel.innerHTML = ""; }, 2500); };

  if (mode === "text") {
    panel.innerHTML = `<div class="textpanel"><textarea id="msgtext" rows="3" dir="auto" placeholder="${esc(t("typeMessage"))}"></textarea>
      <button class="bigbtn green" id="sendtext" type="button"><span><b>${esc(t("send"))}</b></span></button></div>`;
    const ta = document.getElementById("msgtext");
    ta.focus();
    document.getElementById("sendtext").onclick = async () => {
      const text = ta.value.trim();
      if (!text) return;
      panel.innerHTML = `<p class="sentok">${esc(t("sending"))}</p>`;
      try {
        await store.sendMessage({ name: who.name, org: who.org, topic: topic || "general", kind: "text", text });
        done();
      } catch (e) { panel.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
    };
    return;
  }

  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
    panel.innerHTML = `<p class="err">${esc(t("noRecorder"))}</p>`;
    return;
  }

  const video = mode === "video";
  panel.innerHTML = `<div class="recpanel">
      ${video ? `<video id="live" autoplay muted playsinline></video>` : `<div class="mic-anim">${icon("mic", "big")}</div>`}
      <div class="recbar"><span id="rectime" class="rectime">0:00</span>
        <button class="bigbtn red" id="recgo" type="button"><span><b>${esc(t("startRec"))}</b></span></button>
        <button class="bigbtn gray" id="reccancel" type="button"><span><b>${esc(t("cancel"))}</b></span></button></div>
      <textarea id="caption" rows="2" dir="auto" placeholder="${esc(t("typeMessage"))}"></textarea>
    </div>`;

  let stream, rec, chunks = [], timer, started = 0;
  const stopAll = () => { clearInterval(timer); stream?.getTracks().forEach(tr => tr.stop()); };
  busy = true;

  navigator.mediaDevices.getUserMedia(video
    // small video on purpose: uploads stay quick on a 3G/4G connection
    ? { video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 }, facingMode: "user" }, audio: true }
    : { audio: true }
  ).then(s => {
    stream = s;
    if (video) document.getElementById("live").srcObject = s;
  }).catch(() => { busy = false; panel.innerHTML = `<p class="err">${esc(t("camError"))}</p>`; });

  document.getElementById("reccancel").onclick = () => { if (rec && rec.state !== "inactive") { rec.onstop = null; rec.stop(); } stopAll(); busy = false; panel.innerHTML = ""; };

  const go = document.getElementById("recgo");
  go.onclick = () => {
    if (!stream) return;
    if (!rec) {
      const types = video ? ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm"] : ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
      const mimeType = types.find(x => MediaRecorder.isTypeSupported(x));
      rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 450000, audioBitsPerSecond: 48000 });
      rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stopAll();
        const blob = new Blob(chunks, { type: rec.mimeType || mimeType });
        const caption = document.getElementById("caption")?.value.trim() || "";
        panel.innerHTML = `<p class="sentok">${esc(t("sending"))} <span id="pct"></span></p>`;
        try {
          await store.sendMessage({ name: who.name, org: who.org, topic: topic || "general", kind: video ? "video" : "audio", text: caption, blob },
            f => { const p = document.getElementById("pct"); if (p) p.textContent = Math.round(f * 100) + "%"; });
          done();
        } catch (e) { busy = false; panel.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
      };
      rec.start(1000);
      started = Date.now();
      go.querySelector("b").textContent = t("stopRec");
      go.classList.add("pulse");
      timer = setInterval(() => {
        const s = Math.floor((Date.now() - started) / 1000);
        const el = document.getElementById("rectime");
        if (el) el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        if (s >= CONFIG.maxVideoSeconds) rec.stop();
      }, 250);
    } else if (rec.state === "recording") {
      rec.stop();
    }
  };
}

function renderWho(next, force) {
  const cur = me();
  if (cur && !force) return next();
  main().innerHTML = `
    ${pageHead("messages", t("whoAreYou"), t("whoSub"))}
    <div class="whogrid">
      ${CONFIG.people.map((p, i) => `<button class="whobtn ${p.org === "SSC" ? "ssc" : "truck"}" data-i="${i}" type="button"><span class="avatar">${esc(p.name[0])}</span><b>${esc(p.name)}</b><i>${esc(p.org)}</i></button>`).join("")}
    </div>
    <section class="card whoother">
      <label for="othername">${esc(t("otherName"))}</label>
      <div class="row"><input id="othername" type="text" dir="auto" autocomplete="name">
      <select id="otherorg"><option>SSC</option><option>TRUCK</option></select>
      <button class="bigbtn green" id="saveother" type="button"><span><b>${esc(t("save"))}</b></span></button></div>
    </section>`;
  main().querySelectorAll(".whobtn").forEach(b => b.onclick = () => { setMe(CONFIG.people[+b.dataset.i]); next(); });
  document.getElementById("saveother").onclick = () => {
    const name = document.getElementById("othername").value.trim();
    if (!name) return;
    setMe({ name, org: document.getElementById("otherorg").value });
    next();
  };
}

/* ============================================================
   SIGN IN + ADMIN (live mode)
   ============================================================ */
function renderSignIn() {
  main().innerHTML = `
    <section class="card signin">
      <img class="logo" src="img/truck-logo.png" alt="TRUCK">
      <h1>${esc(t("signIn"))}</h1>
      <label>${esc(t("email"))}<input id="em" type="email" autocomplete="username" dir="ltr"></label>
      <label>${esc(t("password"))}<input id="pw" type="password" autocomplete="current-password" dir="ltr"></label>
      <button class="bigbtn green" id="go" type="button"><span><b>${esc(t("signIn"))}</b></span></button>
      <p class="err" id="err"></p>
    </section>`;
  const go = async () => {
    try { await store.signIn(document.getElementById("em").value.trim(), document.getElementById("pw").value); }
    catch (e) { document.getElementById("err").textContent = t("signInError"); }
  };
  document.getElementById("go").onclick = go;
  document.getElementById("pw").onkeydown = e => { if (e.key === "Enter") go(); };
}

function renderAdmin() {
  if (!store.LIVE || !store.isAdmin(user)) {
    main().innerHTML = `${pageHead("admin", t("admin"), t("adminSub"))}<section class="card"><p class="txt">Admin works in live mode for the emails listed in js/config.js. See README.md.</p></section>`;
    return;
  }
  main().innerHTML = `
    ${pageHead("admin", t("admin"), t("adminSub"))}
    <section class="card">
      <h2>${esc(t("uploadBoard"))}</h2>
      <input type="file" id="bj" accept="application/json,.json">
      <p class="hint" id="bjmsg"></p>
    </section>
    <section class="card">
      <h2>${esc(t("uploadFiles"))}</h2><p class="hint">${esc(t("uploadFilesSub"))}</p>
      <div class="row"><input type="text" id="fpath" value="files/" dir="ltr"><input type="file" id="ff" multiple></div>
      <ul id="fmsg" class="hint"></ul>
    </section>`;
  document.getElementById("bj").onchange = async e => {
    const msg = document.getElementById("bjmsg");
    try {
      const b = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(b.pos)) throw new Error("This file has no 'pos' list — is it a board file?");
      await store.saveBoard(b, user.email);
      msg.textContent = "✓ " + t("uploaded");
    } catch (err) { msg.textContent = "✗ " + err.message; }
  };
  document.getElementById("ff").onchange = async e => {
    let dir = document.getElementById("fpath").value.trim().replace(/^\/+/, "");
    if (dir && !dir.endsWith("/")) dir += "/";
    const ul = document.getElementById("fmsg");
    for (const f of e.target.files) {
      const li = document.createElement("li");
      li.textContent = dir + f.name + " …";
      ul.appendChild(li);
      try {
        await store.uploadFile(dir + f.name, f, p => { li.textContent = `${dir}${f.name} ${Math.round(p * 100)}%`; });
        li.textContent = `✓ ${dir}${f.name}`;
      } catch (err) { li.textContent = `✗ ${dir}${f.name}: ${err.message}`; }
    }
  };
}

/* ============================================================
   start
   ============================================================ */
applyDir();
renderFrame();
window.addEventListener("hashchange", route);
route();

store.watchUser(u => {
  user = u;
  route();
  if (store.LIVE && !u) return;
  store.watchBoard((b, info) => { board = b; boardOffline = !!info.offline; refresh(); });
  store.watchMessages(list => {
    messages = list;
    if (parseHash().parts[0] === "messages") drawFeed(parseHash().q.get("topic") || "");
  });
});
