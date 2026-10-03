// The stamp and the signature on the invoice page: one touch selects, a fast finger keeps the box under
// it, the box never leaves the page, and a pinch is a pinch (decision 0204).
//
// Why this exists: on the owner's Pixel (2026-09-30) a stamp sometimes needed several taps before it would
// move, a quick swipe left it behind the finger, and it could be dragged out through the right edge of the
// page while the left edge held. Nothing measured any of it: the layout checks here render markup on the
// server, where no finger exists.
//
// So this check uses a real browser and REAL TOUCH. It builds the app's offline bundle (renderer/, the same
// A4PagedFrame + InvoiceDocument the web draws), opens it in headless Chrome as a phone, hands it a document
// through the app's own `window.__setInvoice`, and sends touch input through the DevTools protocol — the
// same input path a finger takes, so `touch-action`, pointer capture and `pointercancel` behave as on a
// device. `window.AndroidStamp` is defined here as the app's bridge is, so the drag/scroll hand-over the
// page reports to the host is observable too.
//
//   node scripts/checks/run-overlay-drag-check.mjs                  # build the bundle, check it
//   node scripts/checks/run-overlay-drag-check.mjs --bundle FILE    # check a built bundle (an app copy)
//   node scripts/checks/run-overlay-drag-check.mjs --json OUT.json  # also write the measurements
//   CHROME=/path/to/chrome node scripts/checks/run-overlay-drag-check.mjs
//
// No dependency is added: Chrome is driven over its DevTools protocol with Node's own WebSocket. Without
// Chrome the check FAILS — a check that skips itself is a check that cannot fail.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = process.argv.slice(2);
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const bundleArg = arg("--bundle");
const jsonOut = arg("--json");
const only = arg("--only") ? new RegExp(arg("--only")) : null;

// ── 1. The bundle ──────────────────────────────────────────────────────────────────────────────────
let bundlePath = bundleArg;
if (!bundlePath) {
  const { build } = await import("vite");
  const outDir = join(root, "node_modules/.cache/overlay-drag-bundle");
  await build({ configFile: join(root, "renderer/vite.config.ts"), build: { outDir, emptyOutDir: true }, logLevel: "warn" });
  bundlePath = join(outDir, "index.html");
}
if (!existsSync(bundlePath)) {
  console.error(`FAIL: no bundle at ${bundlePath}`);
  process.exit(1);
}

// ── 2. The documents ───────────────────────────────────────────────────────────────────────────────
const SHEET_W = 794;
const SHEET_H = 1123;
// A 1×1 PNG: the stamp and signature need a picture, not a particular one. Their BOX is what is checked.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const TOGGLES = { logo: false, title: true, sender: true, receiver: true, notes: true, payment: true, terms: true, signature: true, stamp: true, total: true, items: true };
const SIZE = 0.189; // the app's default: a box 0.189 of the sheet's width, square

function doc(items, o = {}) {
  const rows = Array.from({ length: items }, (_, k) => {
    const i = k + 1;
    return { sn: i, name: `Item ${i}`, quantity: 1, unitPrice: 20 + k, discountValue: 0, discountType: "PERCENTAGE", taxRate: 0, amount: 20 + k };
  });
  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  return {
    id: `overlay-drag-${items}`,
    documentType: "INVOICE",
    language: null,
    invoiceNumber: "INV-2026-0099",
    invoiceDate: "2026-10-03",
    dueDate: "2026-11-02",
    status: "SENT",
    currency: "USD",
    subtotal,
    discountAmount: 0,
    taxAmount: 0,
    shippingCost: 0,
    total: subtotal,
    amountPaid: 0,
    balanceDue: subtotal,
    paymentStatus: "UNPAID",
    notes: "Thank you for your business.",
    paymentInstructions: "Bank transfer: IBAN FR76 3000 6000 0112 3456 7890 189",
    terms: "Net 30.",
    color: "#0D4DC0",
    toggles: TOGGLES,
    business: { name: "Atelier Lumiere", logo: null, emailAddress: "contact@atelier.example", phone: "+33 1 42 00 00 00", addressLine1: "12 rue des Lilas", addressLine2: null, city: "Lyon", country: "France" },
    client: { id: "c", name: "Claire Martin", companyName: "Martin & Fils", emailAddress: "claire@martin.example", phone: "+33 6 12 34 56 78", addressLine1: "4 place Bellecour", addressLine2: null, city: "Lyon", state: null, zipcode: null, country: "France" },
    headerImage: null,
    backgroundImage: null,
    backgroundOpacity: 1,
    stampImage: PIXEL,
    signatureImage: PIXEL,
    stampSize: SIZE,
    signatureSize: SIZE,
    stampOffsetX: o.stamp?.[0] ?? 0.45,
    stampOffsetY: o.stamp?.[1] ?? 0.45,
    signatureOffsetX: o.sig?.[0] ?? 0.12,
    signatureOffsetY: o.sig?.[1] ?? 0.68,
    items: rows,
  };
}

// A real picture of a real weight: a w×h RGB PNG of noisy gradient, so the browser has something to decode and paint
// where a phone's invoice has a header photo, a background and a logo (the app sends them as base64 data URIs).
function bigPng(w, h) {
  const crc = (buf) => { let c, crcv = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crcv ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcv = (crcv >>> 8) ^ c; } return (crcv ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let seed = 7;
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w * 3; x++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; raw[y * (w * 3 + 1) + 1 + x] = ((x * 255) / (w * 3) + (seed >> 16) % 40 + y / 4) & 255; } }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return "data:image/png;base64," + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}

// ── 3. The browser ─────────────────────────────────────────────────────────────────────────────────
const CHROME = process.env.CHROME
  ?? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
if (!CHROME) {
  console.error("FAIL: no Chrome found (set CHROME=/path/to/chrome). This check needs a real browser and real touch.");
  process.exit(1);
}
const profile = mkdtempSync(join(tmpdir(), "overlay-drag-"));
const page = join(profile, "renderer.html");
writeFileSync(page, readFileSync(bundlePath));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${profile}`, "--remote-debugging-port=0", "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((resolve, reject) => {
  let buf = "";
  chrome.stderr.on("data", (d) => {
    buf += d;
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) resolve(m[1]);
  });
  chrome.on("exit", (c) => reject(new Error(`Chrome exited (${c}) before it listened:\n${buf}`)));
  setTimeout(() => reject(new Error("Chrome did not start in 20 s")), 20000);
});
const browser = new WebSocket(wsUrl);
await new Promise((r) => browser.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
browser.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  browser.send(JSON.stringify({ id, method, params, sessionId }));
});
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const cdp = (method, params) => send(method, params, sessionId);
await cdp("Page.enable");
await cdp("Runtime.enable");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expression) => {
  const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const frames = (n = 2) => evaluate(`new Promise((r) => { let k = ${n}; const f = () => (--k <= 0 ? r(true) : requestAnimationFrame(f)); requestAnimationFrame(f); })`);

// The app's bridge, as far as the page can see it. Installed before the bundle runs, so `?.` finds it.
const BRIDGE = `
  window.__bridge = { moved: [], sigMoved: [], dragging: [], dragCalls: 0 };
  window.AndroidStamp = {
    onMoved: (x, y) => window.__bridge.moved.push([x, y]),
    onSignatureMoved: (x, y) => window.__bridge.sigMoved.push([x, y]),
    setDragging: (v) => { window.__bridge.dragging.push(v); window.__bridge.dragCalls++; },
    onAtTop: () => {}, onPullDownAtTop: () => {}, onPullEnd: () => {},
  };
`;

let bridgeInstalled = false;
async function open(width, height, { cpu = 1 } = {}) {
  if (!bridgeInstalled) { await cdp("Page.addScriptToEvaluateOnNewDocument", { source: BRIDGE }); bridgeInstalled = true; }
  await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true });
  await cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await cdp("Emulation.setCPUThrottlingRate", { rate: cpu });
  await cdp("Page.navigate", { url: pathToFileURL(page).href });
  for (let t = 0; t < 100 && !(await evaluate("typeof window.__setInvoice === 'function'")); t++) await sleep(100);
}
const setDoc = async (data) => {
  await evaluate(`(async () => { window.__setInvoice(${JSON.stringify(JSON.stringify(data))}); await document.fonts.ready; })()`);
  // Settled: the same sheet geometry for several frames in a row.
  let last = "", same = 0;
  for (let k = 0; k < 200 && same < 5; k++) {
    await frames(1);
    const sig = await evaluate(`[...document.querySelectorAll('.a4-sheet')].map((s) => { const r = s.getBoundingClientRect(); return [r.left, r.top, r.width].map(Math.round).join(','); }).join('|') + '#' + document.querySelectorAll('img[alt=Stamp]').length`);
    same = sig === last ? same + 1 : 0;
    last = sig;
  }
  await evaluate("window.__bridge.moved.length = 0; window.__bridge.sigMoved.length = 0; window.__bridge.dragging.length = 0; window.__bridge.dragCalls = 0; true");
};

// What the page looks like right now, in screen pixels. The overlay is the img's parent box; the sheet is
// the page it sits on (the last one: that is where overlays live).
const READ = (alt) => `(() => {
  const img = document.querySelector('img[alt=${alt}]');
  if (!img) return null;
  const el = img.parentElement;
  const sheet = el.closest('.a4-sheet');
  const r = el.getBoundingClientRect(), s = sheet.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const frame = document.querySelector('.a4-frame');
  return { l: r.left, t: r.top, w: r.width, h: r.height, sl: s.left, st: s.top, sw: s.width, sh: s.height,
           selected: cs.borderTopStyle === 'dashed', scrollTop: frame ? frame.scrollTop : 0,
           vv: window.visualViewport ? window.visualViewport.scale : 1 };
})()`;
const read = (alt) => evaluate(READ(alt));
const center = (o) => ({ x: o.l + o.w / 2, y: o.t + o.h / 2 });
const inSheetFrac = (o) => ({ x: (o.l - o.sl) / o.sw, y: (o.t - o.st) / o.sh });

// Touch, through the browser's own input path.
const touch = (type, points) => cdp("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i, radiusX: 2, radiusY: 2, force: 1 })) });
async function tap(x, y, { jitter = 0, hold = 50 } = {}) {
  await touch("touchStart", [{ x, y }]);
  await sleep(hold);
  if (jitter) {
    for (let k = 1; k <= 3; k++) { await touch("touchMove", [{ x: x + (jitter * k) / 3, y: y + (jitter * k) / 6 }]); await sleep(12); }
  }
  await touch("touchEnd", []);
  await frames(2);
}
// Drag with a given path of pointer positions, `gap` ms between events (0 = as fast as the protocol sends).
async function drag(from, to, { steps = 10, gap = 8, release = true } = {}) {
  await touch("touchStart", [from]);
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    await touch("touchMove", [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }]);
    if (gap) await sleep(gap);
  }
  if (release) { await touch("touchEnd", []); await frames(2); }
}
const deselect = async () => {
  const o = await read("Stamp");
  // Empty paper: far left, just under the sheet's top edge — the top-left corner holds no stamp and no signature.
  await tap(o.sl + 6, o.st + 6);
  return !(await read("Stamp")).selected && !(await read("Signature")).selected;
};

// ── 4. The verdicts ────────────────────────────────────────────────────────────────────────────────
const results = [];
const m = {}; // the numbers, for the report
function verdict(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`);
}
const run = (name) => !only || only.test(name);

// A phone (412 × 915) and the widths around it. The page is laid out at its own 794 px and scaled to fit
// the pane, so the width changes the scale — which is what the clamp and the drag arithmetic must survive.
const WIDTHS = [360, 412, 768, 1024];

// ── T1 · selection happens on the FIRST touch, however the finger lands ───────────────────────────────
if (run("select")) {
  await open(412, 915);
  await setDoc(doc(5));
  let atDown = 0, atUp = 0, n = 0;
  const failures = [];
  for (const alt of ["Stamp", "Signature"]) {
    for (const jitter of [0, 3, 6, 10, 16, 24]) {
      for (const where of [[0.5, 0.5], [0.2, 0.25], [0.8, 0.75]]) {
        if (!(await deselect())) { verdict("select: could not deselect between trials", false); continue; }
        const o = await read(alt);
        const x = o.l + o.w * where[0], y = o.t + o.h * where[1];
        await touch("touchStart", [{ x, y }]);
        await frames(2);
        const down = (await read(alt)).selected;
        await sleep(40);
        if (jitter) for (let k = 1; k <= 3; k++) { await touch("touchMove", [{ x: x + (jitter * k) / 3, y: y + (jitter * k) / 6 }]); await sleep(12); }
        await touch("touchEnd", []);
        await frames(2);
        const up = (await read(alt)).selected;
        n++; if (down) atDown++; if (up) atUp++;
        if (!down) failures.push(`${alt} j${jitter}@${where}`);
        if (process.env.VERBOSE) console.log(`  ${alt} jitter ${jitter} at ${where}: down ${down} up ${up}`);
      }
    }
  }
  m.selectAtFirstPointerDown = `${atDown}/${n}`;
  m.selectAfterRelease = `${atUp}/${n}`;
  verdict("select: the FIRST touch selects (stamp + signature, finger jitter 0-24 px)", atDown === n,
    `${atDown}/${n} selected at the first pointerdown, ${atUp}/${n} after release` + (failures.length ? `; missed: ${failures.slice(0, 5).join(" ")}` : ""));
}

// ── T2 · a fast finger keeps the box under it ─────────────────────────────────────────────────────────
if (run("fast")) {
  await open(412, 915);
  await setDoc(doc(5));
  for (const [label, steps, gap] of [["one jump", 1, 0], ["4 events, no pause", 4, 0], ["swipe 25 events / 3 ms", 25, 3]]) {
    for (const alt of ["Stamp", "Signature"]) {
      await open(412, 915);
      await setDoc(doc(5));
      await deselect();
      // Select first (a plain tap), so the baseline and the fix are measured on the same footing.
      let o = await read(alt);
      await tap(center(o).x, center(o).y);
      o = await read(alt);
      const c = center(o);
      // Toward the middle of the sheet, 36 % of the sheet's width in each axis: far faster than a frame.
      const dx = (o.sl + o.sw / 2 > c.x ? 1 : -1) * Math.min(o.sw * 0.3, 120);
      const dy = (o.st + o.sh / 2 > c.y ? 1 : -1) * Math.min(o.sh * 0.25, 120);
      await drag(c, { x: c.x + dx, y: c.y + dy }, { steps, gap, release: false });
      await frames(2);
      const mid = await read(alt);
      const want = { x: c.x + dx, y: c.y + dy };
      const drift = Math.hypot(center(mid).x - want.x, center(mid).y - want.y);
      await touch("touchEnd", []);
      await frames(2);
      const key = `drift ${alt} ${label}`;
      m[key] = Math.round(drift * 100) / 100;
      verdict(`fast: ${alt} under the finger — ${label}`, drift <= 1, `${drift.toFixed(1)} px behind the pointer (${(drift / (o.sw / SHEET_W)).toFixed(1)} sheet px)`);
    }
  }
  // The same, from the very first touch — no select-first tap — which is what a quick "grab and move" is.
  for (const alt of ["Stamp", "Signature"]) {
    await open(412, 915);
    await setDoc(doc(5));
    await deselect();
    const o = await read(alt);
    const c = center(o);
    const dx = (o.sl + o.sw / 2 > c.x ? 1 : -1) * 90, dy = (o.st + o.sh / 2 > c.y ? 1 : -1) * 70;
    await drag(c, { x: c.x + dx, y: c.y + dy }, { steps: 6, gap: 0, release: false });
    await frames(2);
    const mid = await read(alt);
    const drift = Math.hypot(center(mid).x - (c.x + dx), center(mid).y - (c.y + dy));
    await touch("touchEnd", []);
    await frames(2);
    m[`drift ${alt} first touch`] = Math.round(drift * 100) / 100;
    verdict(`fast: ${alt} moves on the first gesture, no select-first tap`, drift <= 1, `${drift.toFixed(1)} px behind the pointer`);
  }
}

// ── T3 · the box stays on the page, on all four sides, at every scale ─────────────────────────────────
if (run("bounds")) {
  const worst = { left: 0, right: 0, top: 0, bottom: 0 };
  let cases = 0, outside = 0;
  for (const w of WIDTHS) {
    for (const alt of ["Stamp", "Signature"]) {
      for (const dir of ["left", "right", "up", "down"]) {
        await open(w, Math.round(w * 2.2));
        await setDoc(doc(5));
        await deselect();
        let o = await read(alt);
        await tap(center(o).x, center(o).y);
        o = await read(alt);
        const c = center(o);
        const reach = 900;
        const to = { x: c.x + (dir === "right" ? reach : dir === "left" ? -reach : 0), y: c.y + (dir === "down" ? reach : dir === "up" ? -reach : 0) };
        await drag(c, to, { steps: 12, gap: 4 });
        const e = await read(alt);
        const over = {
          left: Math.max(0, e.sl - e.l), right: Math.max(0, e.l + e.w - (e.sl + e.sw)),
          top: Math.max(0, e.st - e.t), bottom: Math.max(0, e.t + e.h - (e.st + e.sh)),
        };
        const k = e.sw / SHEET_W;
        for (const side of Object.keys(over)) worst[side] = Math.max(worst[side], over[side] / k);
        cases++;
        if (Object.values(over).some((v) => v > 0.5)) outside++;
      }
    }
  }
  m.overshootSheetPx = Object.fromEntries(Object.entries(worst).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  verdict("bounds: released far past every edge, the box is inside the page (4 edges × 2 overlays × 4 widths)", outside === 0,
    `${outside}/${cases} ended outside; worst overshoot in sheet px — left ${m.overshootSheetPx.left}, right ${m.overshootSheetPx.right}, top ${m.overshootSheetPx.top}, bottom ${m.overshootSheetPx.bottom}`);

  // A position saved outside the page (older builds clamped at 0.96) is drawn inside it, without being asked to move.
  await open(412, 915);
  await setDoc(doc(5, { stamp: [0.95, 0.97], sig: [-0.1, -0.2] }));
  const a = await read("Stamp"), b = await read("Signature");
  const inside = (o) => o.l >= o.sl - 0.5 && o.t >= o.st - 0.5 && o.l + o.w <= o.sl + o.sw + 0.5 && o.t + o.h <= o.st + o.sh + 0.5;
  verdict("bounds: a stored position outside the page is drawn inside it", inside(a) && inside(b), `stamp ${inside(a) ? "inside" : "OUTSIDE"}, signature ${inside(b) ? "inside" : "OUTSIDE"}`);
  const sent = await evaluate("window.__bridge.moved.length + window.__bridge.sigMoved.length");
  verdict("bounds: clamping at display reports nothing to the app (the stored value is left alone)", sent === 0, `${sent} moves reported`);
}

// ── T4 · a committed position is the one drawn, and reaches the app ───────────────────────────────────
if (run("commit")) {
  await open(412, 915);
  await setDoc(doc(5));
  await deselect();
  let o = await read("Stamp");
  await tap(center(o).x, center(o).y);
  o = await read("Stamp");
  const c = center(o);
  await drag(c, { x: c.x - 60, y: c.y + 45 }, { steps: 8, gap: 6 });
  const e = await read("Stamp");
  const f = inSheetFrac(e);
  const sent = await evaluate("window.__bridge.moved.slice()");
  const last = sent[sent.length - 1];
  const exact = last && Math.abs(last[0] - f.x) < 0.001 && Math.abs(last[1] - f.y) < 0.001;
  verdict("commit: one move reported, equal to where the box is drawn", sent.length === 1 && exact, `${sent.length} report(s); drawn ${f.x.toFixed(4)},${f.y.toFixed(4)} reported ${last ? last.map((v) => v.toFixed(4)).join(",") : "none"}`);
  const dragging = await evaluate("window.__bridge.dragging.slice()");
  verdict("commit: the host is told the overlay is held, then released", dragging.includes(true) && dragging[dragging.length - 1] === false, `setDragging calls: ${dragging.join(",")}`);
}

// ── T5 · a pinch is a pinch, and the page still scrolls ───────────────────────────────────────────────
if (run("pinch")) {
  await open(412, 915);
  await setDoc(doc(5));
  await deselect();
  let o = await read("Stamp");
  await tap(center(o).x, center(o).y);
  o = await read("Stamp");
  const before = inSheetFrac(o);
  const c = center(o);
  // Two fingers: one on the selected stamp, one a little away, spreading apart.
  const A = { x: c.x, y: c.y, id: 0 }, B = { x: c.x + 50, y: c.y + 10, id: 1 };
  await touch("touchStart", [A]);
  await touch("touchStart", [A, B]);
  for (let k = 1; k <= 12; k++) {
    await touch("touchMove", [{ x: A.x - k * 6, y: A.y - k * 3, id: 0 }, { x: B.x + k * 6, y: B.y + k * 3, id: 1 }]);
    await sleep(8);
  }
  await touch("touchEnd", []);
  await frames(3);
  const e = await read("Stamp");
  const after = inSheetFrac(e);
  const moveSheetPx = Math.hypot((after.x - before.x) * SHEET_W, (after.y - before.y) * SHEET_H);
  const reported = await evaluate("window.__bridge.moved.length");
  const dragging = await evaluate("window.__bridge.dragging.slice()");
  const leftHeld = dragging.length > 0 && dragging[dragging.length - 1] !== false;
  m.pinchMovedBoxSheetPx = Math.round(moveSheetPx * 100) / 100;
  verdict("pinch: two fingers with the stamp selected do not move it", moveSheetPx < 0.5 && reported === 0, `box moved ${moveSheetPx.toFixed(2)} sheet px, ${reported} move(s) reported`);
  verdict("pinch: the host is not left believing a stamp is held", !leftHeld, `setDragging calls: ${dragging.join(",") || "none"}`);
  m.pinchZoomScale = Math.round(e.vv * 100) / 100;
  verdict("pinch: the page zooms (visual viewport scale grows)", e.vv > 1.05, `scale ${e.vv.toFixed(2)}`);
}
if (run("scroll")) {
  await open(412, 915);
  await setDoc(doc(45));
  const tops = await evaluate("(() => { const f = document.querySelector('.a4-frame'); return [document.querySelectorAll('.a4-sheet').length, f.scrollHeight, f.clientHeight]; })()");
  // A swipe on empty paper — the page's own — scrolls the stack.
  await touch("touchStart", [{ x: 20, y: 700 }]);
  for (let k = 1; k <= 10; k++) { await touch("touchMove", [{ x: 20, y: 700 - k * 40 }]); await sleep(10); }
  await touch("touchEnd", []);
  await sleep(300);
  const st = (await evaluate("document.querySelector('.a4-frame').scrollTop"));
  verdict("scroll: a swipe on the page scrolls a multi-page invoice", st > 100, `${tops[0]} pages, scrolled ${Math.round(st)} px`);
  // Scroll to the last page and use the overlays there: bounds hold on the page they sit on.
  await evaluate("(() => { const f = document.querySelector('.a4-frame'); f.scrollTop = f.scrollHeight; })()");
  await frames(3);
  await deselect().catch(() => false);
  const o = await read("Stamp");
  await tap(center(o).x, center(o).y);
  const o2 = await read("Stamp");
  const c = center(o2);
  await drag(c, { x: c.x + 700, y: c.y + 500 }, { steps: 10, gap: 5 });
  const e = await read("Stamp");
  const over = Math.max(0, e.l + e.w - (e.sl + e.sw), e.t + e.h - (e.st + e.sh), e.sl - e.l, e.st - e.t);
  verdict("scroll: on the last page of a multi-page invoice the box stays on that page", over <= 0.5, `${tops[0]} pages, overshoot ${over.toFixed(1)} px`);
}

// ── T6 · what a drag costs, on a phone-speed CPU ──────────────────────────────────────────────────────
if (run("frames")) {
  const t = {};
  await open(412, 915, { cpu: 4 });
  // The weight of a real invoice: a header photo, a background and a logo, over 45 lines.
  const heavy = doc(45);
  heavy.headerImage = bigPng(1400, 420);
  heavy.backgroundImage = bigPng(1000, 1400);
  heavy.business.logo = bigPng(500, 500);
  heavy.toggles = { ...TOGGLES, logo: true };
  await setDoc(heavy);
  await evaluate("(() => { const f = document.querySelector('.a4-frame'); f.scrollTop = f.scrollHeight; })()");
  await frames(3);
  await evaluate(`(() => {
    window.__t = { down: [], up: [], gaps: [], busyDown: [], busyUp: [] };
    const two = (cb) => requestAnimationFrame(() => requestAnimationFrame(cb));
    // How long the main thread is kept busy after an event: ping a MessageChannel until three round trips in a row
    // find nothing else queued ahead of them, which is when React's own scheduled render has also run.
    const busy = (into) => { const t0 = performance.now(); const ch = new MessageChannel(); let n = 0; ch.port1.onmessage = () => { if (++n < 4) ch.port2.postMessage(0); else { into.push(performance.now() - t0); ch.port1.close(); } }; ch.port2.postMessage(0); };
    document.addEventListener('pointerdown', () => busy(window.__t.busyDown), true);
    document.addEventListener('pointerup', () => busy(window.__t.busyUp), true);
    document.addEventListener('pointerdown', () => { const t0 = performance.now(); two(() => window.__t.down.push(performance.now() - t0)); }, true);
    document.addEventListener('pointerup', () => { const t0 = performance.now(); two(() => window.__t.up.push(performance.now() - t0)); }, true);
    window.__rec = false; let last = 0;
    const tick = (ts) => { if (window.__rec && last) window.__t.gaps.push(ts - last); last = ts; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    true;
  })()`);
  await deselect();
  const o = await read("Stamp");
  const c = center(o);
  const downs = [];
  // Pointerdown → picture, with a stamp not yet selected (the tap that used to cost nothing and then cost a re-render).
  for (let k = 0; k < 3; k++) {
    await deselect();
    await tap(c.x, c.y);
  }
  await frames(3);
  await evaluate("window.__t.down.length = 0; window.__t.up.length = 0; window.__t.busyDown.length = 0; window.__t.busyUp.length = 0; true");
  // A long drag, 60 events a second, with the frame gaps recorded.
  await deselect();
  await tap(c.x, c.y);
  await evaluate("window.__t.down.length = 0; window.__t.up.length = 0; window.__t.busyDown.length = 0; window.__t.busyUp.length = 0; window.__t.gaps.length = 0; window.__rec = true; true");
  const to = { x: c.x - 70, y: c.y - 120 };
  await drag(c, to, { steps: 60, gap: 16, release: true });
  await evaluate("window.__rec = false; true");
  const T = await evaluate("window.__t");
  const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
  t.pointerDownToFrameMs = Math.round(T.down[0] ?? 0);
  t.pointerUpToFrameMs = Math.round(T.up[0] ?? 0);
  t.mainThreadBusyAfterDownMs = Math.round(T.busyDown[0] ?? 0);
  t.mainThreadBusyAfterUpMs = Math.round(T.busyUp[0] ?? 0);
  t.frameGapP50 = Math.round(q(T.gaps, 0.5));
  t.frameGapP95 = Math.round(q(T.gaps, 0.95));
  t.frameGapMax = Math.round(Math.max(0, ...T.gaps));
  t.framesOver50ms = T.gaps.filter((g) => g > 50).length;
  t.frames = T.gaps.length;
  void downs;
  m.frameTimes4xCpu = t;
  console.log(`info frames (CPU ×4, 45-line invoice with header photo, background and logo): pointerdown→frame ${t.pointerDownToFrameMs} ms, pointerup→frame ${t.pointerUpToFrameMs} ms, main thread busy after the grab ${t.mainThreadBusyAfterDownMs} ms and after the release ${t.mainThreadBusyAfterUpMs} ms, frame gap p50 ${t.frameGapP50} / p95 ${t.frameGapP95} / max ${t.frameGapMax} ms, ${t.framesOver50ms}/${t.frames} frames over 50 ms`);
  // Not a pass/fail on absolute numbers (this Mac is not a Pixel): the release must not take a long
  // frame to commit, and the start of a touch must not wait on a page-wide re-render.
  verdict("frames: pointerdown and pointerup each reach a frame within 100 ms at CPU ×4", t.pointerDownToFrameMs <= 100 && t.pointerUpToFrameMs <= 100, `down ${t.pointerDownToFrameMs} ms, up ${t.pointerUpToFrameMs} ms`);
}

browser.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }

const failed = results.filter((r) => !r.ok).length;
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ bundle: bundlePath, measurements: m, results }, null, 2));
console.log(`\n${results.length} checks, ${failed} failed, in ${bundlePath}`);
console.log(JSON.stringify(m));
if (results.length === 0) {
  console.error("FAIL: no checks ran");
  process.exit(1);
}
process.exit(failed ? 1 : 0);
