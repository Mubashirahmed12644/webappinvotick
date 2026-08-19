D="/private/tmp/claude-501/-Users-ahmedmubashir-Documents-Webinvotick/9fda48c5-6e66-400f-b8e8-37cc4460a0f4/scratchpad"
logo=open(f"{D}/logo.b64").read(); photo=open(f"{D}/hdr4.b64").read()
REG=open(f"{D}/nunito_regular.b64").read(); BOLD=open(f"{D}/nunito_bold.b64").read()
CSS=open(f"{D}/css6.txt").read()
REF="CL2608014"; DATE="Aug 19, 2026"

HEAD=f'''<div class="hd">
  <img class="photo" src="data:image/png;base64,{photo}" alt="">
  <div class="logo"><div class="mark"><b>CL</b><span>Codlytics LLC</span></div></div>
  <div class="ttl">Letter</div>
</div>'''

# The reference row goes on EVERY page; the inside address only on the first.
# A letter to a bank is photocopied, stamped and filed a sheet at a time, so a page that arrives on
# its own still has to say which letter it belongs to and when it was written. The recipient does
# not repeat — an inside address is where a letter opens, not a running head.
REFDATE=f'''<div class="grid3">
  <div><p class="inline"><span class="lbl">Reference:</span> {REF}</p></div>
  <div></div>
  <div class="right"><p class="inline"><span class="lbl">Date:</span> {DATE}</p></div>
</div>'''

TO='''<div class="to">
  <p class="lbl">To</p>
  <p class="v first">The Manager / Head of Trade &amp; Compliance</p>
  <p class="v">Bank Alfalah Limited</p>
  <p class="v">[Branch Name &amp; Address]</p>
</div>'''

PHONE='<svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z"/></svg>'
LINK='<svg viewBox="0 0 24 24"><path d="M3.9 12c0-1.7 1.4-3.1 3.1-3.1h4V7H7c-2.8 0-5 2.2-5 5s2.2 5 5 5h4v-1.9H7c-1.7 0-3.1-1.4-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.7 0 3.1 1.4 3.1 3.1s-1.4 3.1-3.1 3.1h-4V17h4c2.8 0 5-2.2 5-5s-2.2-5-5-5z"/></svg>'
PIN='<svg viewBox="0 0 24 24"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>'

def FOOT(n,t):
    return f'''<div class="ft">
  <div class="contact">
    <div class="ci"><div class="ico">{PHONE}</div><div class="tx"><b>+92 300 0000000</b>+92 42 0000000</div></div>
    <div class="ci"><div class="ico">{LINK}</div><div class="tx"><b>hello@codlytics.com</b>www.codlytics.com</div></div>
    <div class="ci"><div class="ico">{PIN}</div><div class="tx"><b>[Office address]</b>Lahore, Pakistan</div></div>
  </div>
  <div class="bar">
    <span class="made"><span class="chip"><img src="data:image/png;base64,{logo}" alt=""></span>Made with <b>Invotick</b></span>
    <span class="pageno">PAGE {n} OF {t}</span>
  </div></div>'''

P=[]
P.append('''<div class="subj">Subject: Submission of supporting documents and request for realisation of inward remittance under SBP Purpose Code 9185 – A/C 02671007641224, Codlytics</div>
<div class="facts">
  <div><span>Account Title</span><span>Codlytics</span></div>
  <div><span>Account No.</span><span>02671007641224</span></div>
  <div><span>PSEB Registration No.</span><span>Z-25-9961/23</span></div>
  <div><span>Amount</span><span>USD 428.31</span></div>
  <div><span>Remitter</span><span>Google Asia Pacific Pte. Ltd., Singapore</span></div>
</div>
<p>Dear Sir/Madam,</p>
<p>We refer to your email requesting a copy of the agreement between us and Google and the related
Google payment receipt in respect of the above inward remittance currently held pending
documentation. The requested documents are enclosed, together with an explanation of the nature of
the transaction.</p>
<h3>1. Nature of our business</h3>
<p>Codlytics is a software house engaged in the development and publication of mobile software
applications. We are registered with the Pakistan Software Export Board under Registration No.
Z-25-9961/23 and our export receipts arise from software developed in Pakistan and distributed
internationally.</p>''')

P.append('''<h3>2. Nature of the receipt</h3>
<p>The remittance represents advertising revenue share earned through the Google AdMob programme.
AdMob is an advertising SDK integrated by our development team into the source code of mobile
applications. Google serves advertisements within these applications and remits the publisher's
share of the resulting revenue. The receipt therefore arises from the operation of software, and the
corresponding invoice has been raised under Purpose Code 9185 – Other Computer Service.</p>
<h3>3. Contractual basis – in response to your request for a copy of the agreement</h3>
<p>Google does not issue or execute a signed bilateral contract with publishers. The relationship is
governed exclusively by the Google AdSense Online Terms of Service, which are accepted
electronically and which expressly state that they constitute the entire agreement between the
parties. A complete copy is enclosed. We draw attention to the following clauses:</p>
<ul>
  <li>Section 1, which defines “Google” as Google Asia Pacific Pte. Ltd., the same entity shown as
    remitter on the enclosed payment receipt and on our invoice;</li>
  <li>Section 2, which includes mobile applications within the definition of “Properties” on which
    the services are used;</li>
  <li>Section 9, which refers to the distribution of content via the AdMob SDK;</li>
  <li>Section 16, which confirms that AdMob is a service governed by these Terms, read with the
    AdMob Publisher Guidelines and Policies.</li>
</ul>''')

P.append('''<p>No document other than these Terms exists, and none is issued by Google on request. This
is the standard contracting position for all AdMob publishers worldwide.</p>
<h3>4. Payment trail</h3>
<p>The enclosed Google Payment Receipt (Payment Number GG104GCHKK, dated 21 July 2026, USD 428.31,
issued by Google Asia Pacific Pte. Ltd.) corresponds exactly to our invoice dated 5 July 2026 and to
the remittance held with the Bank. The enclosed AdMob transaction statement shows the underlying earnings
for the period reconciling to the same amount.</p>
<h3>5. Tax classification</h3>
<p>We request that, at the time of realisation, the proceeds be treated under Section 154A of the
Income Tax Ordinance, 2001 and not under Section 154B.</p>''')

P.append('''<p>Section 154B, inserted by the Finance Act, 2026, applies to a “digital content creator”
or “social media influencer” deriving income from the creation, publication or monetisation of
content on social media platforms such as YouTube, Facebook, Instagram and TikTok. These receipts do
not fall within that description. They arise from in-application advertising served within mobile
software, and not from content published on any social media platform.</p>
<p>The enclosed AdMob transaction statement evidences this directly: the earnings lines are
attributable to mobile advertising and mediation networks — AdMob Applications, Pangle, Mintegral,
AppLovin and Liftoff Monetize. No social media platform appears in the earnings breakdown.</p>
<p>Export proceeds in respect of computer software and IT services fall under Section 154A, for which
the Finance Act, 2026 extended the concessionary final tax rate of 0.25% for PSEB-registered
exporters through Tax Year 2029. This is also consistent with the Bank's own classification of these
proceeds under Purpose Code 9185.</p>''')

P.append('''<h3>6. Request</h3>
<p>We accordingly request that the Bank:</p>
<ol type="a">
  <li>accept the enclosed documents in satisfaction of the pending documentary requirement and
    release the remittance;</li>
  <li>realise the proceeds under SBP Purpose Code 9185 – Other Computer Service; and</li>
  <li>apply Section 154A at the rate applicable to PSEB-registered exporters, rather than
    Section 154B.</li>
</ol>
<p>If the Bank requires further comfort on the tax classification, we are willing to obtain a
determination or exemption certificate from the concerned Commissioner Inland Revenue, and request
written confirmation of whether this is required.</p>
<h3>Enclosures</h3>
<ol>
  <li>Google AdSense Online Terms of Service (complete copy)</li>
  <li>Google Payment Receipt – Payment No. GG104GCHKK dated 21 July 2026</li>
  <li>AdMob transaction statement for the period June–July 2026</li>
  <li>Commercial invoice dated 5 July 2026</li>
  <li>PSEB Certificate of Registration No. Z-25-9961/23</li>
  <li>NTN certificate and SECP incorporation documents</li>
</ol>
<p>We shall be grateful for your review and early release of the remittance.</p>
<div class="sign">Yours faithfully,<div class="rule"></div>
<b>[Name]</b><br>[Designation]<br>Codlytics LLC</div>''')

JS=open(f"{D}/paginate.js").read()
sheets=(f'<template id="t-head">{HEAD}</template>'
        f'<template id="t-refdate">{REFDATE}</template>'
        f'<template id="t-to">{TO}</template>'
        f'<template id="t-foot">{FOOT("n","N")}</template>'
        f'<div id="src" style="display:none">{"".join(P)}</div>'
        f'<div id="out"></div>')

html=f'''<meta charset="utf-8">\n<title>Codlytics Letterhead</title>
<style>
@font-face{{font-family:"Nunito";font-weight:400;src:url(data:font/ttf;base64,{REG}) format("truetype")}}
@font-face{{font-family:"Nunito";font-weight:700;src:url(data:font/ttf;base64,{BOLD}) format("truetype")}}
:root{{--page:#eceaf0;--ink:#1b1b1f;--muted:#44464f;--primary:#0D4DC0}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--page:#0c0d10;--ink:#e3e2e6;--muted:#c5c6d0}}}}
:root[data-theme="dark"]{{--page:#0c0d10;--ink:#e3e2e6;--muted:#c5c6d0}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--page);color:var(--ink);font-family:"Nunito",system-ui,sans-serif;
  padding:clamp(16px,3vw,40px);line-height:1.5}}
.wrap{{max-width:880px;margin:0 auto;display:flex;flex-direction:column;gap:24px}}
h1{{font-size:clamp(22px,3vw,30px);font-weight:700;margin:0;letter-spacing:-.02em}}
.lede{{margin:0;color:var(--muted);font-size:15px;max-width:64ch}}
.eyebrow{{font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0}}
.note{{border-left:3px solid var(--primary);padding:2px 0 2px 14px;color:var(--muted);font-size:14.5px;max-width:70ch}}
.note b{{color:var(--ink)}}
.scroller{{overflow-x:auto;padding-bottom:6px}}
.sheets{{display:flex;flex-direction:column;align-items:center;width:794px;margin:0 auto}}
{CSS}
</style>
<div class="wrap">
  <header style="display:flex;flex-direction:column;gap:9px">
    <p class="eyebrow">Invotick · Letter Maker</p>
    <h1>Codlytics letterhead</h1>
    <p class="lede">The invoice's template, carrying a letter. Same masthead, same From / To /
      Details row, same footer — so a client who receives an invoice in this design receives a letter
      in it too. The recipient sits where a letter puts it — left, under the reference line.</p>
  </header>
  <div class="scroller"><div class="sheets">{sheets}</div></div>
  <p class="note"><b>This is not a letterhead that resembles the invoice — it is the invoice's own
    template.</b> Header 165&nbsp;px with the logo at 112 and the title at 53/900 over
    <code>header_4</code>; content inset 32&nbsp;px; the three-column From / To / Details row at
    15&nbsp;px labels over 14&nbsp;px body; the promotional footer at #F5F5F5, height 95, 62&nbsp;px
    tiles. Every one of those numbers is read out of <code>InvoiceDocument.tsx</code>. The items table
    is the only thing replaced — by the letter.</p>
  <p class="note"><b>One gap in a letter is deliberately double.</b> Block format puts two blank
    lines between the date line and the inside address, and one blank line everywhere else — that
    difference is what tells a reader where the running head stops and the letter starts. This gap
    was 34&nbsp;px, or 1.55 baselines, barely more than the single gaps around it, so the letter
    appeared to begin nowhere in particular. It is 44 now: exactly two lines.</p>
  <p class="note"><b>Reference and date repeat on every page; the recipient does not.</b> A letter to
    a bank is photocopied, stamped and filed a sheet at a time, so a page that arrives on its own has
    to say which letter it belongs to and when it was written — the same reason the masthead and the
    page number repeat. An inside address is where a letter opens, not a running head.</p>
  <p class="note"><b>The recipient moved out of the middle column.</b> On an invoice that cell is
    “Bill To” and belongs in the header row. On a letter the inside address is its own block, left,
    under the reference line and above the subject — that is where a reader looks for it, and where a
    window envelope expects it. The invoice's three-column grid is still there; the middle cell is
    simply empty.</p>
  <p class="note"><b>Below the row, the letterhead takes over.</b> Body at 11&nbsp;pt on a
    22&nbsp;px baseline with every space 11, 22 or 33; the contact strip and the bar carrying the
    credit and the page number. The invoice's promotional block is not here — the sender's own
    contact details are the footer of a letter.</p>
  <p class="note"><b>One inset, 32&nbsp;px, carries all of it.</b> The earlier letterhead used 76,
    and mixing the two would have left the body indented from the row above it — half-alignment reads
    as a mistake rather than a choice. The paragraphs cap their measure at 640&nbsp;px instead, so the
    column starts where everything else does and prose still stops short of 135 characters a line.</p>
</div>
<script>{JS}</script>'''
open(f"{D}/letter-brand.html","w").write(html)

# ── print build ──────────────────────────────────────────────────────────────────────────────
# 794px at 96dpi is 210.0mm, so a sheet already IS an A4 page; it only has to stop being a card on
# a desk. Shadows, the page background and the explanatory notes come off, `@page` margin goes to 0
# because the sheet carries its own, and each sheet breaks after itself. print-color-adjust keeps
# the masthead photo and the coloured bar — browsers drop backgrounds when printing otherwise, which
# would send a letterhead to the printer with no letterhead on it.
print_css = """
@page { size: A4; margin: 0; }
html,body { margin:0; padding:0; background:#fff; }
.sheet { width:210mm; height:297mm; margin:0; border-radius:0; box-shadow:none;
         break-after:page; page-break-after:always; }
.sheet:last-child { break-after:auto; page-break-after:auto; }
* { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
"""
head_end = html.index("</style>")
print_html = html[:head_end] + print_css + html[head_end:]
# The sheets AND the paginator — cutting at .wrap used to drop the script with the notes, so the
# print build shipped an empty #out and Chrome rendered a single blank page.
print_html = (print_html[:print_html.index('<div class="wrap">')]
              + f'<div class="sheets">{sheets}</div>'
              + f'<script>{JS}</script>')
open(f"{D}/letter-print.html","w").write(print_html)
print("blocks:", sum(c.count("<p")+c.count("<h3")+c.count("<ul")+c.count("<ol")+c.count('class="facts"')+c.count('class="callout"')+c.count('class="sign"')+c.count('class="subj"') for c in P),
      " screen:",len(html)," print:",len(print_html), " (page count is decided at load by the paginator)")
