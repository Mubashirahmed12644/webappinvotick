/**
 * The glimpse of an invoice under the headline — what the owner asked for as the middle of the
 * hybrid landing: the message, then a look at the thing, then the one button.
 *
 * ## It is a picture, not a preview
 *
 * It shows a finished Invotick invoice so that the promise above it is something you can see before
 * you press anything. It is **not** the real renderer (`InvoiceDocument`), and it must never become
 * one: that component is the invariant shared with the app's offline bundle (AGENTS.md §4.1), and
 * putting it on the landing page would mean a landing-page tweak could change what the app prints.
 * Every word in here is ours, fixed, and short.
 *
 * ## Why it cannot break on a phone
 *
 * Everything inside is sized in `cqw` — hundredths of *this card's own width* — so the whole thing
 * is one drawing that scales. At 320 px and at 1280 px it is the same picture at two sizes; there is
 * no width at which a label runs out of room, because no label has a size of its own to run out of.
 * That is also why it does not grow with the reader's font scale, and that is correct here and only
 * here: it is `aria-hidden` decoration carrying no information that is not also in the headline,
 * the subline and the FAQ in ordinary, scalable text.
 *
 * **It has no crop and no fade.** The first draft cut the card to a fixed A4-ish ratio and faded
 * the bottom out, and at 375 px the fade landed exactly on `Total $1,987.20` — a grand total half
 * dissolved into white, on the page whose whole job is to say *your numbers will be right*. That is
 * `LAYOUT_RULES.md`'s "money shrinks, never truncates" in a decorative element, and it is worse
 * there than in the app, because nobody typed this number and so nobody would think to check it.
 * The card is now exactly as tall as what is in it.
 *
 * It stays `dir="ltr"` inside a mirrored page for the same reason a photograph does: the sample is
 * an English invoice, and flipping it would not make it an Arabic one — it would make it a
 * backwards English one.
 */
export function InvoiceGlimpse() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]" aria-hidden="true" dir="ltr">
      {/* A soft brand wash behind the card, the same gesture the legal pages open with. */}
      <div className="pointer-events-none absolute -inset-4 rounded-[28px] bg-[var(--color-primary-container)]/45 blur-xl" />

      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[0_18px_48px_-18px_rgba(0,26,72,0.45)] ring-1 ring-black/5"
        style={{ containerType: "inline-size" }}
      >
        {/* Header band — the brand colour, the way the app's own "simple" template prints it. */}
        <div className="flex items-center justify-between bg-[var(--color-primary)]" style={{ padding: "5cqw 5.5cqw" }}>
          <div className="flex items-center" style={{ gap: "2.5cqw" }}>
            <div
              className="flex items-center justify-center rounded-md bg-white/20 font-extrabold text-white"
              style={{ width: "9cqw", height: "9cqw", fontSize: "4.4cqw" }}
            >
              A
            </div>
            <div>
              <div className="font-bold text-white" style={{ fontSize: "3.6cqw", lineHeight: 1.2 }}>
                Amberleaf Studio
              </div>
              <div className="text-white/70" style={{ fontSize: "2.5cqw", lineHeight: 1.4 }}>
                hello@amberleaf.co
              </div>
            </div>
          </div>
          <div className="text-end">
            <div className="font-extrabold tracking-[0.18em] text-white" style={{ fontSize: "4.6cqw" }}>
              INVOICE
            </div>
            <div className="text-white/70" style={{ fontSize: "2.5cqw" }}>
              INV-000241
            </div>
          </div>
        </div>

        <div style={{ padding: "4.5cqw 5.5cqw" }}>
          {/* Billed to / due — two short columns, each with its own room. */}
          <div className="flex items-start justify-between" style={{ gap: "4cqw" }}>
            <div>
              <Label>Billed to</Label>
              <div className="font-bold text-[#1c1b1f]" style={{ fontSize: "3.3cqw", lineHeight: 1.35 }}>
                Northgate Coffee Co.
              </div>
              <div className="text-[#6b6874]" style={{ fontSize: "2.7cqw", lineHeight: 1.45 }}>
                14 Mill Street, Leeds
              </div>
            </div>
            <div className="text-end">
              <Label>Due</Label>
              <div className="font-bold text-[#1c1b1f]" style={{ fontSize: "3.3cqw", lineHeight: 1.35 }}>
                30 Sep 2026
              </div>
            </div>
          </div>

          <div style={{ height: "4cqw" }} />

          <Row desc="Brand identity — logo & type" amount="$1,200.00" />
          <Row desc="Menu & packaging design" amount="$640.00" />

          <div className="mt-[3cqw] flex justify-end">
            <div style={{ width: "52%" }}>
              <Total label="Subtotal" value="$1,840.00" />
              <Total label="Tax 8%" value="$147.20" />
              <div
                className="mt-[2cqw] flex items-baseline justify-between rounded-md bg-[var(--color-primary-container)]"
                style={{ padding: "2.2cqw 3cqw" }}
              >
                <span className="font-bold text-[var(--color-on-primary-container)]" style={{ fontSize: "2.9cqw" }}>
                  Total
                </span>
                <span className="font-extrabold text-[var(--color-on-primary-container)]" style={{ fontSize: "4.2cqw" }}>
                  $1,987.20
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function Label({ children }: { children: string }) {
  return (
    <div
      className="font-bold uppercase tracking-[0.16em] text-[#9a96a3]"
      style={{ fontSize: "2.3cqw", marginBottom: "1cqw" }}
    >
      {children}
    </div>
  );
}

function Row({ desc, amount }: { desc: string; amount: string }) {
  return (
    <div
      className="flex items-center justify-between border-b border-[#efedf3]"
      style={{ gap: "3cqw", paddingBlock: "2.2cqw" }}
    >
      <span className="min-w-0 flex-1 truncate text-[#3f3b47]" style={{ fontSize: "2.9cqw" }}>
        {desc}
      </span>
      <span className="shrink-0 font-bold text-[#1c1b1f]" style={{ fontSize: "2.9cqw" }}>
        {amount}
      </span>
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between" style={{ gap: "2cqw", paddingBlock: "0.9cqw" }}>
      <span className="text-[#6b6874]" style={{ fontSize: "2.7cqw" }}>
        {label}
      </span>
      <span className="font-semibold text-[#1c1b1f]" style={{ fontSize: "2.7cqw" }}>
        {value}
      </span>
    </div>
  );
}
