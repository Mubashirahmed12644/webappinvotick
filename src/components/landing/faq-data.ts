// FAQ content — shared by the on-page <FAQ> section and the FAQPage JSON-LD.
// Owner can refine the answers later.
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Is the invoice generator free?",
    a: "Yes — Invotick's invoice generator is 100% free. You can create an invoice and download it as a PDF without paying anything.",
  },
  {
    q: "Do I need an account to create an invoice?",
    a: "No. You can fill in and download an invoice without signing up. An account is only needed if you want to back up your invoices and access them on other devices.",
  },
  {
    q: "Can I download my invoice as a PDF?",
    // 0170: "no watermark" was false. The free tool's PDF carries the Invotick footer band, and that
    // band is deliberate — it is the growth surface that tells the client where the invoice was made
    // (G2). So the answer names it instead of denying it.
    a: "Yes. Every invoice can be downloaded as a print-ready PDF in one click, with no sign-up. The PDF carries a small Invotick line at the bottom of the page so your client can see where it was made.",
  },
  {
    q: "Is my data private?",
    a: "Your invoices are saved only in your browser. Nothing is sent to our servers unless you choose to sign in and back them up.",
  },
  {
    q: "Which currencies are supported?",
    a: "You can pick from major currencies including USD, EUR, GBP, PKR, INR, AUD, CAD and AED. The chosen currency applies to the whole invoice.",
  },
  {
    q: "Can I add my logo and choose a template?",
    a: "Yes. Upload your business logo and pick from professional templates for different industries — the live preview updates instantly.",
  },
];
