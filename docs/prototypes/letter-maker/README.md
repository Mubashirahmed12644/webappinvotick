# Letter Maker — layout prototype

The letterhead a user gets is **their own invoice's template**, so whoever received the invoice
recognises the letter. Everything here is measured off `src/components/invoice/InvoiceDocument.tsx`
and `A4PagedFrame.tsx` — this is a prototype of the layout, not a second design.

- `build.py` — generates the screen build and the print build from the blocks + templates
- `letter.css` — the sheet, the masthead, the body system, the footer
- `paginate.js` — the measuring paginator (fill, continue, number, rule off)

## Assets are inlined, and are not kept here

`build.py` reads four base64 files that are **not** committed — they are large and derived:

| file | source |
|---|---|
| `hdr4.b64` | `public/system-assets/header_4.png` |
| `logo.b64` | `invoice-kmp-app/composeApp/src/androidMain/res/mipmap-xxxhdpi/ic_launcher_round.webp` |
| `nunito_regular.b64`, `nunito_bold.b64` | the Nunito faces the invoice already uses |

Regenerate with `base64 -i <file> -o <name>.b64`, into the same directory as `build.py`.

## Rendering

Serve the directory and point headless Chrome at `letter-print.html`:

    python3 build.py
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
      --no-pdf-header-footer --virtual-time-budget=10000 \
      --print-to-pdf=letter.pdf http://localhost:8777/letter-print.html

The page count is decided at load by the paginator, so it cannot be read from the generated HTML —
check `/Count` in the PDF, and expect `/MediaBox [0 0 595 842]`.

The full rationale, the numbers and the three traps are in
`~/.claude/projects/-Users-ahmedmubashir-Documents-Webinvotick/memory/letter-feature-layout.md`.
