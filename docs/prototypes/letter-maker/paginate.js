/* Fill every page, and leave space only where the next block genuinely will not fit.
 *
 * The pages used to be split by hand, which meant a page ended wherever the split happened to be
 * put — sometimes with a third of the sheet blank under it. On a letter to a bank that is not only
 * untidy: an unexplained gap is room for a clause to be typed in after signing. The controls a
 * formal letter uses for that are all here — fill the page, say "continued" wherever the letter
 * does not end, number every sheet n of N, and rule off whatever space is genuinely left.
 *
 * Blocks are moved one at a time and the page is measured after each; the one that overflows is
 * taken back and starts the next sheet. A heading is never left as the last thing on a page — it
 * travels with the block that follows it, or the reader turns over to find a section title with
 * nothing under it. */
(function () {
  const src = document.getElementById("src");
  const out = document.getElementById("out");
  const tpl = {
    head: document.getElementById("t-head").innerHTML,
    refdate: document.getElementById("t-refdate").innerHTML,
    to: document.getElementById("t-to").innerHTML,
    foot: document.getElementById("t-foot").innerHTML,
  };
  const blocks = Array.from(src.children);
  let page = null, letter = null, first = true;

  function newPage() {
    const s = document.createElement("div");
    s.className = "sheet";
    s.innerHTML =
      tpl.head +
      '<div class="pg">' + tpl.refdate + (first ? tpl.to : "") + '<div class="letter" lang="en-GB"></div></div>' +
      tpl.foot;
    out.appendChild(s);
    first = false;
    page = s;
    letter = s.querySelector(".letter");
  }
  // How much of the column is still empty.
  //
  // This is measured from the bottom of the last thing on the page to the bottom of the column,
  // and it has to be: scrollHeight was the obvious way to ask and it is the wrong one. It never
  // reports LESS than clientHeight, so on a page holding one short paragraph it answered 680 out
  // of 680 — the column's own height, not the content's. The old test compared that against
  // clientHeight and was therefore true on every single block: 27 sheets, one paragraph each.
  const spare = () => {
    const k = letter.children;
    const r = letter.getBoundingClientRect();
    return Math.round(r.bottom - (k.length ? k[k.length - 1].getBoundingClientRect().bottom : r.top));
  };
  // Room kept back for the "Continued…" line, which is added after the fill. Without it the marker
  // was pushed past the bottom of a page filled to the millimetre, and the column clips its
  // overflow — so on two pages it was written and then invisible.
  const RESERVE = 30;
  const overflows = () => spare() < RESERVE;

  newPage();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    letter.appendChild(b);
    if (!overflows()) continue;
    letter.removeChild(b);

    // A heading immediately before it would be stranded at the foot of the page, so it travels to
    // the new sheet with its block. It is MOVED there directly and never pushed back into the
    // queue: putting it back was the old behaviour, and it hung the page. The pair simply
    // re-collided on the next sheet, was split again, spliced back again — a new sheet minted
    // every time round, forever, which is why the browser never finished loading the letter.
    const h = letter.lastElementChild;
    const carry = h && h.tagName === "H3" && letter.children.length > 1 ? h : null;
    if (carry) letter.removeChild(carry);

    // A page with nothing left on it that still cannot hold this block means the block is taller
    // than a sheet. Turning over gains nothing — keep it here rather than ask for another page
    // that will fail the same way.
    if (!letter.children.length) { letter.appendChild(b); continue; }

    newPage();
    if (carry) letter.appendChild(carry);
    letter.appendChild(b);
  }

  // Number the sheets, mark the ones the letter continues past, and rule off leftover space.
  const sheets = Array.from(out.children);
  sheets.forEach((s, i) => {
    const n = i + 1, last = n === sheets.length;
    // Guarded: this line used to assume the node existed, and when the class was missing it threw
    // on the first sheet — taking the continued markers and the ruling down with it, silently.
    const pn = s.querySelector(".pageno");
    if (pn) pn.textContent = "PAGE " + n + " OF " + sheets.length;
    const l = s.querySelector(".letter");
    const k = l.children;
    const r = l.getBoundingClientRect();
    const left = Math.round(r.bottom - (k.length ? k[k.length - 1].getBoundingClientRect().bottom : r.top));
    if (!last) {
      const c = document.createElement("div");
      c.className = "cont";
      c.textContent = "Continued on page " + (n + 1) + " →";
      l.appendChild(c);
    }
    // Anything over half a page of unused space gets struck through, so nothing can be added to it
    // later without the alteration being obvious.
    if (left > 120) {
      const r = document.createElement("div");
      r.className = "ruled";
      r.style.height = (left - (last ? 0 : 26)) + "px";
      l.appendChild(r);
    }
  });
})();
