// Every line of an invoice is on exactly one page, and nothing a page carries is cut off.
//
// Why this exists: a 45-line invoice whose lines wrapped to two rows came out with lines 22–25 on NO
// page — on screen, in the PDF and on paper — while the total still counted them (found 2026-10-03
// while building Print, decision 0202). A line that is on no page is the worst thing an invoice can
// do (G3), and nothing measured it: every other check here renders markup on the server, where there
// is no layout at all, so it could not see a row the browser had pushed past the bottom of a page.
//
// So this check uses a real browser. It builds the app's offline bundle (renderer/, the same
// A4PagedFrame + InvoiceDocument the web's /i/{token} and /embed/render draw), opens it in headless
// Chrome, hands it each document of a matrix through the app's own `window.__setInvoice`, and then
// reads the laid-out page: for every line it asks which page shows it IN FULL — inside every box
// that clips it and clear of the footer band. Each line must be shown exactly once, in order, and
// every summary block (totals, notes) must be shown in full on the last page.
//
//   node scripts/checks/run-paged-rows-check.mjs                  # build the bundle, check it
//   node scripts/checks/run-paged-rows-check.mjs --bundle FILE    # check a built bundle (an app copy)
//   CHROME=/path/to/chrome node scripts/checks/run-paged-rows-check.mjs
//
// No dependency is added: Chrome is driven over its DevTools protocol with Node's own WebSocket.
// Without Chrome the check FAILS — a check that skips itself is a check that cannot fail.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = process.argv.slice(2);
const bundleArg = args.includes("--bundle") ? args[args.indexOf("--bundle") + 1] : null;
const only = args.includes("--only") ? new RegExp(args[args.indexOf("--only") + 1]) : null;

// ── 1. The bundle ──────────────────────────────────────────────────────────────────────────────────
let bundlePath = bundleArg;
if (!bundlePath) {
  const { build } = await import("vite");
  const outDir = join(root, "node_modules/.cache/paged-rows-bundle");
  await build({
    configFile: join(root, "renderer/vite.config.ts"),
    build: { outDir, emptyOutDir: true },
    logLevel: "warn",
  });
  bundlePath = join(outDir, "index.html");
}
if (!existsSync(bundlePath)) {
  console.error(`FAIL: no bundle at ${bundlePath}`);
  process.exit(1);
}

// ── 2. The documents ───────────────────────────────────────────────────────────────────────────────
// Line names sized against the description column (32.9 % of the table, 13 px bold Nunito): SHORT
// stays on one row, TWO wraps to two, THREE to three or more.
const SHORT = (i) => `Item ${i}`;
const TWO = (i) => `Consulting services for the quarterly account review, part ${i}`;
const THREE = (i) => `Installation, configuration and on-site testing of the complete network equipment for branch office number ${i}`;
const NAMES = {
  short: () => SHORT,
  two: () => TWO,
  three: () => THREE,
  // Every third line wraps, every seventh wraps further: mixed heights on every page.
  mixed: () => (i) => (i % 7 === 0 ? THREE(i) : i % 3 === 0 ? TWO(i) : SHORT(i)),
  // One row's height stood for every row until 2026-10-03, and it was the FIRST row's. A tall first
  // line made every page look roomier than it was (lines pushed off the bottom: on no page); a short
  // first line made it look tighter (pages of one line). These two shapes are those two errors.
  firstLong: () => (i) => (i === 1 ? TWO(i) : SHORT(i)),
  firstShort: () => (i) => (i === 1 ? SHORT(i) : TWO(i)),
  // Every other line wraps.
  alternate: () => (i) => (i % 2 === 1 ? TWO(i) : SHORT(i)),
  // A short first page's worth, then wrapping lines.
  tailLong: () => (i) => (i <= 15 ? SHORT(i) : TWO(i)),
  // Wrapping lines only in the middle, straddling the first page break.
  middleLong: () => (i) => (i >= 15 && i <= 30 ? THREE(i) : SHORT(i)),
};

const business = {
  name: "Atelier Lumière",
  logo: null,
  emailAddress: "contact@atelier-lumiere.example",
  phone: "+33 1 42 00 00 00",
  addressLine1: "12 rue des Lilas",
  addressLine2: null,
  city: "Lyon",
  country: "France",
};
const client = {
  id: "c",
  name: "Claire Martin",
  companyName: "Martin & Fils SARL",
  emailAddress: "claire@martin-fils.example",
  phone: "+33 6 12 34 56 78",
  addressLine1: "4 place Bellecour",
  addressLine2: null,
  city: "Lyon",
  state: null,
  zipcode: null,
  country: "France",
};
const TOGGLES = { logo: false, title: true, sender: true, receiver: true, notes: true, payment: true, terms: true, signature: true, stamp: true, total: true, items: true };
// A 1×1 PNG: the stamp, signature and header slots need a picture, not a particular one.
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const LONG_TEXT = "Payment is due within 30 days of the invoice date. Late payments carry interest at 1.5 % per month. Goods remain our property until paid in full. ".repeat(4);

function doc(name, n, namer, o = {}) {
  const items = Array.from({ length: n }, (_, k) => {
    const i = k + 1;
    const unitPrice = 19.5 + k * 37.25;
    const quantity = (k % 4) + 1;
    return { sn: i, name: namer(i), quantity, unitPrice, discountValue: o.lineDiscount ? 5 : 0, discountType: "PERCENTAGE", taxRate: o.lineTax ? 10 : 0, amount: Math.round(unitPrice * quantity * 100) / 100 };
  });
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  return {
    name,
    data: {
      id: `paged-rows-${name}`,
      documentType: o.estimate ? "ESTIMATE" : "INVOICE",
      language: o.language ?? null,
      invoiceNumber: "INV-2026-0045",
      invoiceDate: "2026-10-03",
      dueDate: "2026-11-02",
      poNumber: o.po ? "PO-7781" : null,
      status: "SENT",
      currency: "USD",
      subtotal,
      discountAmount: o.discount ? 25 : 0,
      taxAmount: o.tax ? 120.5 : 0,
      shippingCost: o.shipping ? 15 : 0,
      total: subtotal,
      amountPaid: 100,
      balanceDue: subtotal - 100,
      paymentStatus: "PARTIALLY_PAID",
      notes: o.notes ? (o.notes === "long" ? LONG_TEXT : "Thank you for your business.") : null,
      paymentInstructions: o.payment ? (o.payment === "long" ? LONG_TEXT : "Bank transfer: IBAN FR76 3000 6000 0112 3456 7890 189") : null,
      terms: o.terms ? (o.terms === "long" ? LONG_TEXT : "Net 30.") : null,
      color: "#0D4DC0",
      titleColor: null,
      toggles: TOGGLES,
      business,
      client,
      headerImage: o.header ? PIXEL : null,
      backgroundImage: null,
      backgroundOpacity: 1,
      signatureImage: o.sign ? PIXEL : null,
      stampImage: o.sign ? PIXEL : null,
      hideInvotickFooter: o.premium ? true : null,
      items,
    },
  };
}

const COUNTS = [1, 9, 10, 15, 16, 17, 20, 21, 22, 24, 25, 26, 30, 40, 45, 46, 60, 100];
const DOCS = [];
for (const [shape, make] of Object.entries(NAMES)) {
  for (const n of COUNTS) DOCS.push(doc(`${shape}-${n}`, n, make(), { notes: true, payment: true, terms: true }));
}
// Summary and chrome variants, at the counts around a page break and at the reported 45.
for (const n of [20, 24, 25, 45]) {
  for (const shape of ["short", "two", "mixed"]) {
    const namer = NAMES[shape]();
    DOCS.push(doc(`${shape}-${n}-bare`, n, namer, {}));
    DOCS.push(doc(`${shape}-${n}-full`, n, namer, { discount: true, tax: true, shipping: true, lineDiscount: true, lineTax: true, po: true, notes: "long", payment: "long", terms: "long", sign: true, header: true }));
    DOCS.push(doc(`${shape}-${n}-premium`, n, namer, { premium: true, notes: true, payment: true, terms: true }));
    DOCS.push(doc(`${shape}-${n}-estimate`, n, namer, { estimate: true, notes: true }));
    for (const language of ["de", "ar", "fr", "zh"]) {
      DOCS.push(doc(`${shape}-${n}-${language}`, n, namer, { language, notes: true, payment: true, terms: true }));
    }
  }
}
// The longest line stored in production on 2026-10-03 is 746 characters: one such line must still be
// shown whole, alone, among short lines, and as the first line (the row that used to stand for all).
const LONGEST = (i) => `Line ${i}: ` + "Supply and installation of materials as per the agreed scope ".repeat(13).slice(0, 736);
for (const n of [1, 2, 9, 30]) {
  DOCS.push(doc(`longest-first-${n}`, n, (i) => (i === 1 ? LONGEST(i) : SHORT(i)), { notes: true, payment: true, terms: true }));
  DOCS.push(doc(`longest-all-${n}`, n, LONGEST, { notes: true, payment: true, terms: true }));
}

// `--docs FILE`: check these documents instead of the matrix — a JSON array of { name, data } with
// `data` an InvoiceRenderData (a shared link's snapshot is one). Used to measure real documents.
const docsArg = args.includes("--docs") ? args[args.indexOf("--docs") + 1] : null;
const source = docsArg ? JSON.parse(readFileSync(docsArg, "utf8")) : DOCS;
const docs = only ? source.filter((d) => only.test(d.name)) : source;

// ── 3. The browser ─────────────────────────────────────────────────────────────────────────────────
const CHROME = process.env.CHROME
  ?? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
if (!CHROME) {
  console.error("FAIL: no Chrome found (set CHROME=/path/to/chrome). This check needs a real layout engine.");
  process.exit(1);
}
const profile = mkdtempSync(join(tmpdir(), "paged-rows-"));
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
// A phone's WebView: 412 CSS px wide. The page is laid out at its own 794 px and scaled, so the width
// changes only the scale, never which line lands on which page.
await cdp("Emulation.setDeviceMetricsOverride", { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
await cdp("Page.navigate", { url: pathToFileURL(page).href });
const evaluate = async (expression) => {
  const r = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
for (let t = 0; t < 100 && !(await evaluate("typeof window.__setInvoice === 'function'")); t++) await new Promise((r) => setTimeout(r, 100));

// Runs in the page: hand it the document, let it settle, then read where every line landed.
const READ = `async (json) => {
  if (json) window.__setInvoice(json);
  await document.fonts.ready;
  // Settled = the same pages, the same row tops, for several frames in a row.
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  let last = "", same = 0;
  for (let k = 0; k < 400 && same < 6; k++) {
    await frame();
    const sig = [...document.querySelectorAll(".a4-stack .a4-sheet")].map((s) =>
      [...s.querySelectorAll("tbody tr")].map((tr) => tr.cells[0].textContent + "@" + Math.round(tr.getBoundingClientRect().top)).join(",")).join("|");
    same = sig === last ? same + 1 : 0;
    last = sig;
  }
  const inter = (a, b) => ({ top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom), left: Math.max(a.left, b.left), right: Math.min(a.right, b.right) });
  const sheets = [...document.querySelectorAll(".a4-stack .a4-sheet")];
  const out = { pages: sheets.length, shown: [], clipped: [], blocksCut: [] };
  sheets.forEach((sheet, p) => {
    const sr = sheet.getBoundingClientRect();
    // What sits over the bottom of the page: the footer band and the "Page X of Y" line — every
    // absolutely placed child pinned by its bottom edge.
    const bands = [...sheet.children].filter((c) => getComputedStyle(c).position === "absolute" && c.style.bottom !== "").map((c) => c.getBoundingClientRect());
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.height <= 0) return false;
      let clip = sr;
      for (let a = el.parentElement; a && a !== sheet; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX !== "visible" || cs.overflowY !== "visible") clip = inter(clip, a.getBoundingClientRect());
      }
      const eps = 0.5;
      if (r.top < clip.top - eps || r.bottom > clip.bottom + eps) return false;
      return !bands.some((b) => r.bottom > b.top + eps && r.top < b.bottom - eps && b.bottom - b.top > 0);
    };
    for (const tr of sheet.querySelectorAll("tbody tr")) {
      const sn = tr.cells[0].textContent.trim();
      if (!sn) continue;
      (visible(tr) ? out.shown : out.clipped).push([Number(sn), p + 1]);
    }
    for (const b of sheet.querySelectorAll("[data-block]")) if (!visible(b)) out.blocksCut.push(p + 1);
  });
  return out;
}`;

// ── 4. The verdict ─────────────────────────────────────────────────────────────────────────────────
let failed = 0;
const lines = [];
// Each document is read twice: as the screen shows it, and as it prints. Printing is how the share
// page's "Download PDF" reaches a desktop or an iPhone (the browser's print dialog), and print media
// hides the off-screen measuring copies — so a page that re-measures while printing must not lose
// its pages over it.
const MEDIA = (process.env.PAGED_ROWS_MEDIA ?? "screen,print").split(",");
for (const d of docs) for (const media of MEDIA) {
  await cdp("Emulation.setEmulatedMedia", { media: media === "screen" ? "" : media });
  // The print pass prints what the screen pass laid out, as a browser does: no new document.
  const r = await evaluate(`(${READ})(${media === MEDIA[0] ? JSON.stringify(JSON.stringify(d.data)) : "null"})`);
  const n = d.data.items.length;
  const count = new Map();
  for (const [sn] of r.shown) count.set(sn, (count.get(sn) ?? 0) + 1);
  const missing = [], twice = [];
  for (let i = 1; i <= n; i++) {
    const c = count.get(i) ?? 0;
    if (c === 0) missing.push(i);
    if (c > 1) twice.push(i);
  }
  const order = r.shown.map(([sn]) => sn);
  const inOrder = order.every((sn, k) => k === 0 || sn > order[k - 1]);
  const perPage = Array.from({ length: r.pages }, (_, p) => r.shown.filter(([, pg]) => pg === p + 1).length);
  const ok = missing.length === 0 && twice.length === 0 && inOrder && r.blocksCut.length === 0;
  const range = (xs) => xs.length > 6 ? `${xs.slice(0, 6).join(",")}…(${xs.length})` : xs.join(",");
  const line = `${ok ? "ok  " : "FAIL"} ${media.padEnd(6)} ${d.name.padEnd(24)} ${String(n).padStart(3)} lines → ${r.pages} page(s) [${perPage.join("+")}]`
    + (missing.length ? `  ON NO PAGE: ${range(missing)}` : "")
    + (r.clipped.length ? `  cut off: ${range(r.clipped.map(([sn, p]) => `${sn}@p${p}`))}` : "")
    + (twice.length ? `  TWICE: ${range(twice)}` : "")
    + (!inOrder ? "  OUT OF ORDER" : "")
    + (r.blocksCut.length ? `  summary cut on page ${r.blocksCut.join(",")}` : "");
  lines.push(line);
  if (!ok) failed++;
}

browser.close();
chrome.kill();
try { rmSync(profile, { recursive: true, force: true }); } catch { /* Chrome may still hold it */ }

console.log(lines.join("\n"));
console.log(`\n${docs.length} documents × ${MEDIA.join("+")}, ${docs.reduce((s, d) => s + d.data.items.length, 0)} lines checked in ${bundlePath}`);
if (docs.length === 0) {
  console.error("FAIL: no documents were checked");
  process.exit(1);
}
if (failed) {
  console.error(`FAIL: ${failed} of ${docs.length * MEDIA.length} readings drop, repeat or cut a line or the summary`);
  process.exit(1);
}
console.log("OK: every line on exactly one page, in order, and every summary shown in full");
