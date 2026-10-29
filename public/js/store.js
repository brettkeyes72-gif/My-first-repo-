// Where the data lives. Two modes, same functions:
//   demo — board from a JSON file, messages kept on this device (IndexedDB)
//   live — board, messages, video notes and files in Firebase, shared by everyone
import { CONFIG } from "./config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
export const LIVE = !!CONFIG.firebase;

let fb = null; // { auth, db, st, m: {firestore fns}, s: {storage fns}, a: {auth fns} }

async function firebase() {
  if (fb) return fb;
  const [app, a, m, s] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-firestore.js"),
    import(FB + "firebase-storage.js")
  ]);
  const inst = app.initializeApp(CONFIG.firebase);
  // Long-polling copes better than WebChannel with patchy mobile networks and proxies.
  const db = m.initializeFirestore(inst, { experimentalAutoDetectLongPolling: true });
  fb = { auth: a.getAuth(inst), db, st: s.getStorage(inst), a, m, s };
  return fb;
}

/* ---------------- sign in (live mode only) ---------------- */

export async function watchUser(cb) {
  if (!LIVE) { cb({ demo: true }); return; }
  const f = await firebase();
  f.a.onAuthStateChanged(f.auth, u => cb(u ? { email: u.email, uid: u.uid } : null));
}

export async function signIn(email, password) {
  const f = await firebase();
  await f.a.setPersistence(f.auth, f.a.browserLocalPersistence);
  await f.a.signInWithEmailAndPassword(f.auth, email, password);
}

export async function resetPassword(email) {
  const f = await firebase();
  await f.a.sendPasswordResetEmail(f.auth, email);
}

export async function signOut() {
  const f = await firebase();
  await f.a.signOut(f.auth);
}

export function isAdmin(user) {
  return !!user && !!user.email && CONFIG.admins.map(e => e.toLowerCase()).includes(user.email.toLowerCase());
}

/* ---------------- the board ---------------- */

const CACHE = "ssc-truck-board-cache";

function cacheBoard(b) { try { localStorage.setItem(CACHE, JSON.stringify(b)); } catch (e) {} }
function cachedBoard() { try { return JSON.parse(localStorage.getItem(CACHE)); } catch (e) { return null; } }

async function fetchJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}

// cb(board, { offline }) is called now and again whenever the board changes.
export async function watchBoard(cb) {
  if (window.__BOARD__) { cb(window.__BOARD__, {}); return; }

  if (LIVE) {
    const f = await firebase();
    f.m.onSnapshot(f.m.doc(f.db, "board", "current"), async snap => {
      if (!snap.exists()) return cb(null, {});
      const d = snap.data();
      const board = JSON.parse(d.json);
      board._updatedAt = d.updatedAt?.toDate?.().toISOString?.() || null;
      await resolveFiles(board);
      cacheBoard(board);
      cb(board, {});
    }, () => {
      const c = cachedBoard();
      if (c) cb(c, { offline: true });
    });
    return;
  }

  let last = "";
  const load = async () => {
    try {
      let b;
      try { b = await fetchJson("data/board.json"); }
      catch (e) { b = await fetchJson("data/demo-board.json"); }
      const s = JSON.stringify(b);
      if (s !== last) { last = s; cacheBoard(b); cb(b, {}); }
    } catch (e) {
      const c = cachedBoard();
      if (c && !last) { last = JSON.stringify(c); cb(c, { offline: true }); }
    }
  };
  await load();
  setInterval(load, CONFIG.refreshSeconds * 1000);
}

// Board files can be full links (Google Drive) or paths like "files/CUS26-01/logo.png".
// In live mode those paths live in Firebase Storage; turn them into download links once.
async function resolveFiles(board) {
  const f = await firebase();
  const jobs = [];
  const fix = d => {
    if (!d || !d.url || /^https?:/.test(d.url)) return;
    jobs.push(f.s.getDownloadURL(f.s.ref(f.st, d.url)).then(u => { d.href = u; }).catch(() => { d.href = null; d.missing = true; }));
  };
  for (const p of board.pos || []) fix(p.doc);
  for (const c of [...(board.custom || []), ...(board.samples || [])]) (c.docs || []).forEach(fix);
  for (const smp of board.samples || []) fix(smp.image);
  await Promise.all(jobs);
}

export function href(doc) {
  if (!doc) return null;
  return doc.href || doc.url || null;
}

export async function saveBoard(board, by) {
  const f = await firebase();
  await f.m.setDoc(f.m.doc(f.db, "board", "current"), {
    json: JSON.stringify(board),
    updatedAt: f.m.serverTimestamp(),
    by: by || ""
  });
}

export async function uploadFile(path, file, onProgress) {
  const f = await firebase();
  const task = f.s.uploadBytesResumable(f.s.ref(f.st, path), file, { contentType: file.type || undefined });
  await new Promise((res, rej) => task.on("state_changed",
    s => onProgress && onProgress(s.bytesTransferred / s.totalBytes), rej, res));
  return path;
}

/* ---------------- alerts (Web Push) ---------------- */

export const PUSH_OK = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function swReady() {
  if (!swReady.p) swReady.p = navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready);
  return swReady.p;
}

// Is this device already signed up for alerts?
export async function pushStatus() {
  if (!LIVE || !PUSH_OK) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await swReady();
  return (await reg.pushManager.getSubscription()) && Notification.permission === "granted" ? "on" : "off";
}

function keyBytes(b64) {
  const s = atob((b64 + "=".repeat((4 - b64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function subId(endpoint) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

// Ask permission, subscribe this device and save it so the server can reach it.
export async function turnOnPush(who) {
  if (await Notification.requestPermission() !== "granted") throw new Error("permission");
  const reg = await swReady();
  const sub = await reg.pushManager.getSubscription()
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(CONFIG.vapidKey) });
  const f = await firebase();
  const json = JSON.parse(JSON.stringify(sub));
  await f.m.setDoc(f.m.doc(f.db, "pushsubs", await subId(json.endpoint)), {
    sub: json, uid: f.auth.currentUser?.uid || "", email: f.auth.currentUser?.email || "",
    name: who?.name || "", org: who?.org || "", at: Date.now()
  });
}

/* ---------------- messages ---------------- */

// A message: { id, at (ms), name, org, topic, kind: "text"|"video"|"audio", text, url|blob, mime }

let idb = null;
function openIdb() {
  if (idb) return idb;
  idb = new Promise((res, rej) => {
    const r = indexedDB.open("ssc-truck", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("messages", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return idb;
}

async function idbAll() {
  const db = await openIdb();
  return new Promise((res, rej) => {
    const q = db.transaction("messages").objectStore("messages").getAll();
    q.onsuccess = () => res(q.result.sort((a, b) => b.at - a.at));
    q.onerror = () => rej(q.error);
  });
}

async function idbPut(m) {
  const db = await openIdb();
  return new Promise((res, rej) => {
    const tx = db.transaction("messages", "readwrite");
    tx.objectStore("messages").put(m);
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
}

const chan = "BroadcastChannel" in window ? new BroadcastChannel("ssc-truck-messages") : null;

// cb(list) newest first, called now and on every change.
export async function watchMessages(cb) {
  if (LIVE) {
    const f = await firebase();
    const q = f.m.query(f.m.collection(f.db, "messages"), f.m.orderBy("at", "desc"), f.m.limit(300));
    f.m.onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return;
  }
  const push = async () => { try { cb(await idbAll()); } catch (e) { cb([]); } };
  if (chan) chan.onmessage = push;
  await push();
  watchMessages._push = push;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// msg: { name, org, topic, kind, text, blob? }
export async function sendMessage(msg, onProgress) {
  const m = { id: newId(), at: Date.now(), name: msg.name, org: msg.org || "", topic: msg.topic || "general", kind: msg.kind, text: msg.text || "" };
  if (LIVE) {
    const f = await firebase();
    if (msg.blob) {
      const ext = msg.blob.type.includes("mp4") ? "mp4" : msg.blob.type.includes("ogg") ? "ogg" : "webm";
      const path = `messages/${m.id}.${ext}`;
      await uploadFile(path, msg.blob, onProgress);
      m.url = await f.s.getDownloadURL(f.s.ref(f.st, path));
      m.mime = msg.blob.type;
    }
    m.uid = f.auth.currentUser?.uid || "";
    await f.m.setDoc(f.m.doc(f.db, "messages", m.id), m);
    return;
  }
  if (msg.blob) { m.blob = msg.blob; m.mime = msg.blob.type; }
  await idbPut(m);
  if (chan) chan.postMessage("new");
  if (watchMessages._push) watchMessages._push();
}
