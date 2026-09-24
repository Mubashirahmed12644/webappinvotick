"use client";

import { useEffect, useMemo, useState } from "react";
import { CURRENCIES, type FreeInvoice, type FreeLineItem } from "@/lib/free-invoice/types";
import { createEmptyInvoice, nextInvoiceNumber, toRenderData, totalsFor, uuid } from "@/lib/free-invoice/adapter";
import { randomSample } from "@/lib/free-invoice/samples";
import { getAllInvoices, putInvoice, deleteInvoice, getActiveId, setActiveId, hasContent } from "@/lib/free-invoice/store";
import { initialCurrency, setPreferredCurrency } from "@/lib/free-invoice/currency-detect";
import { exportInvoicePdf } from "@/lib/free-invoice/pdf";
import { completionParams, isComplete, originAfterEdit, sourceOf, touchesContent } from "@/lib/free-invoice/funnel";
import { trackWebEvent, trackWebEventOnce } from "@/lib/analytics/client";
import type { InvoiceTemplate } from "@/lib/free-invoice/templates";

/**
 * The free invoice tool's whole brain, in one place, owned by **one** React tree.
 *
 * ## Why this exists, and what it is deliberately not
 *
 * The landing now shows a guided three-step flow over the same draft the full editor edits
 * (decision 0165). Two views of one invoice is the entire risk in that change: a second copy of the
 * state would mean two drafts, two autosaves racing over one IndexedDB row, two `downloadPdf`
 * implementations drifting apart, and — worst — the funnel events firing twice, which is §1.11's
 * defect arriving by a new road.
 *
 * So nothing was rewritten. Every line below was **moved** out of `FreeInvoiceTool` unchanged: the
 * same effects at the same moments, the same event names with the same parameters, the same PDF
 * call. The guided flow and the full editor are two renderers of this one object, and there is
 * exactly one of it per page.
 *
 * ## The one thing that did change shape, and why
 *
 * The hidden `<input type="file">` used to live inside `FreeInvoiceTool` with a ref beside it. Two
 * views both wanting a logo picker would have meant two inputs sharing one ref, where whichever
 * mounted last silently wins. **The input and its ref now belong to the shell**
 * (`GuidedFirstInvoice`), which renders exactly one and hands the "open it" function to the editor
 * as a prop. This hook only takes the file that comes back, through `onLogoFile`.
 *
 * Keeping the ref out of here is not only tidiness. `react-hooks/refs` treats anything reachable
 * from a returned object as a ref, so a `RefObject` on this value made all thirteen ordinary
 * `fi.something` reads in a render body report as "cannot access refs during render" — correct
 * code, thirteen errors, and a rule people then start switching off.
 */

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB, client-side only

// Deterministic initial state so server and client render identically (no
// hydration mismatch). The unique id / invoice number are assigned on mount.
function seedInvoice(): FreeInvoice {
  return { ...createEmptyInvoice(), id: "", invoiceNumber: "INV-000000" };
}

export type FreeInvoiceController = ReturnType<typeof useFreeInvoice>;

export function useFreeInvoice() {
  const [inv, setInv] = useState<FreeInvoice>(seedInvoice);
  const [saved, setSaved] = useState<FreeInvoice[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [showBizDetails, setShowBizDetails] = useState(false);
  const [showClientDetails, setShowClientDetails] = useState(false);
  const [showInvoiceMeta, setShowInvoiceMeta] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);

  const unsyncedCount = saved.filter((i) => !i.isSynced).length;
  // Progressive disclosure: keep cards compact, but auto-reveal the extra fields
  // whenever they already carry data (samples, restored drafts).
  const hasBizDetails = Boolean(inv.businessEmail || inv.businessPhone || inv.businessAddress);
  const bizDetailsOpen = showBizDetails || hasBizDetails;
  const hasClientDetails = Boolean(inv.clientAddress || inv.shipTo);
  const clientDetailsOpen = showClientDetails || hasClientDetails;

  /**
   * The value moment, and the G1 signal for this surface (decision 0163).
   *
   * **One row per press, carrying what happened** — the `premium_purchase_result` shape from
   * decision 0155, for the same reason: before it, a press whose result nobody recorded was simply
   * an unknown. `outcome=saved` is `jsPDF.save()` returning and nothing more; whether the browser
   * then wrote the file to disk is not something this page can see, which is why the name is
   * `free_invoice_pdf_download` and not `pdf_saved` (§1.14).
   *
   * `source` rides on this row so "how many REAL invoices came off this page" is one query rather
   * than a join back to `free_invoice_completed`.
   */
  async function downloadPdf() {
    setDownloading(true);
    const source = sourceOf(inv);
    try {
      await exportInvoicePdf("fi-paper", `${inv.invoiceNumber || "invoice"}.pdf`);
      trackWebEvent("free_invoice_pdf_download", { outcome: "saved", ...(source ? { source } : {}) });
      // The offer goes up only here: after the person has actually got something out of the page,
      // never before, and at most once a visit. `trackWebEventOnce` returning false means it has
      // already been offered in this tab, so a second download is left alone.
      if (trackWebEventOnce("install_offer_shown", "free_invoice_install_offer_shown", { trigger: "pdf_downloaded" })) {
        setOfferOpen(true);
      }
    } catch (e) {
      console.error("PDF export failed", e);
      trackWebEvent("free_invoice_pdf_download", {
        outcome: "failed",
        ...(source ? { source } : {}),
        // The class name only. A message can carry the business or client name that this page
        // promises never leaves the browser, and the route would refuse it in any case.
        ...(e instanceof Error && e.name ? { exception_class: e.name } : {}),
      });
    } finally {
      setDownloading(false);
    }
  }

  // Client-only mount: restore the last-open draft (redirect/reload safe) or give
  // the seed its real identifiers, and load the saved-invoices list.
  useEffect(() => {
    (async () => {
      const list = await getAllInvoices();
      setSaved(list);
      const active = list.find((i) => i.id === getActiveId());
      if (active) setInv(active);
      // New visitor / blank draft: open in the country-based (or last-picked) currency.
      else setInv((prev) => (prev.id ? prev : { ...prev, id: uuid(), invoiceNumber: nextInvoiceNumber(), currency: initialCurrency() }));
    })();
  }, []);

  // Autosave the current draft locally (debounced), skipping blank seeds.
  useEffect(() => {
    if (!inv.id || !hasContent(inv)) return;
    const t = setTimeout(async () => {
      await putInvoice(inv);
      setActiveId(inv.id);
      setSaved(await getAllInvoices());
    }, 600);
    return () => clearTimeout(t);
  }, [inv]);

  /**
   * The draft first reached invoice shape: a business name, a client name and at least one priced
   * line (`isComplete`). Once per draft per visit — the mark is keyed by the invoice id, so opening
   * a second invoice reports its own completion and re-opening the first does not.
   *
   * The parameters are read at that first moment on purpose: they say what the invoice was when it
   * became one, not what it grew into afterwards.
   */
  useEffect(() => {
    if (!inv.id || !isComplete(inv)) return;
    trackWebEventOnce(`completed:${inv.id}`, "free_invoice_completed", completionParams(inv));
  }, [inv]);

  /**
   * The web twin of the app's `business_form_text_typed` / `client_form_text_add` /
   * `item_form_text_add`: the first non-blank keystroke in a form's name field, once per form per
   * visit, with the form as a parameter rather than three names (§1.1).
   *
   * **It means exactly what the app's does and no more: typing started.** It is not evidence the
   * data is real. It cannot be — nothing here can tell "Acme Studio" from "asdf". `source` on
   * `free_invoice_completed` and `free_invoice_pdf_download` is what separates our sample words from
   * theirs, and even that does not judge what they typed.
   *
   * "✨ Surprise me" fills these fields through `setInv` and never through an input's `onChange`, so
   * it fires none of these. That is the honest result and it is worth keeping true: a sample press
   * is not a person typing.
   */
  function noteTyping(form: "business" | "client" | "item", value: string) {
    if (!value.trim()) return;
    trackWebEventOnce(`form_typed:${form}`, "free_invoice_form_typed", { form });
  }

  // Collapse the progressive-disclosure cards back to their compact state when
  // switching invoices (auto-open still kicks in for cards that carry data).
  function resetDisclosures() {
    setShowBizDetails(false);
    setShowClientDetails(false);
    setShowInvoiceMeta(false);
  }

  function applyTemplate(t: InvoiceTemplate) {
    if (t.id === "simple") {
      // Simple = solid band; keep the current colour rather than resetting it.
      set({ templateId: "simple", headerImage: null, titleColor: null });
    } else {
      set({ templateId: t.id, headerImage: t.headerImage, color: t.color, titleColor: t.titleColor ?? null });
    }
  }

  // "Surprise me": a random sample that already carries an industry-matched
  // template — so the header design, business and line items all fit together.
  function surpriseMe() {
    const s = randomSample();
    setInv(s);
    setActiveId(s.id);
    resetDisclosures();
  }

  function newInvoice() {
    const fresh = { ...createEmptyInvoice(), currency: initialCurrency() };
    setInv(fresh);
    setActiveId(fresh.id);
    resetDisclosures();
  }

  // Changing currency anywhere remembers it as the user's preference for next time.
  function changeCurrency(v: string) {
    set({ currency: v });
    setPreferredCurrency(v);
  }

  function openInvoice(id: string) {
    const found = saved.find((i) => i.id === id);
    if (found) {
      setInv(found);
      setActiveId(found.id);
      setShowSaved(false);
      resetDisclosures();
    }
  }

  async function removeSaved(id: string) {
    await deleteInvoice(id);
    setSaved(await getAllInvoices());
    if (id === inv.id) newInvoice();
  }

  // Editing anything of the person's own moves a "Surprise me" draft from `sample` to
  // `sample_edited`, one way only (see `funnel.ts`). A template, a colour or the currency is ours or
  // automatic and does not count as their data.
  const set = (patch: Partial<FreeInvoice>) =>
    setInv((prev) => ({
      ...prev,
      ...patch,
      ...(touchesContent(patch) ? { origin: originAfterEdit(prev.origin) } : {}),
      updatedAt: Date.now(),
    }));

  const setItem = (id: string, patch: Partial<FreeLineItem>) =>
    setInv((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      origin: originAfterEdit(prev.origin),
      updatedAt: Date.now(),
    }));

  const addItem = () =>
    set({ items: [...inv.items, { id: uuid(), description: "", quantity: "1", rate: "" }] });

  const removeItem = (id: string) =>
    set({ items: inv.items.length > 1 ? inv.items.filter((it) => it.id !== id) : inv.items });

  function onLogoFile(file?: File | null) {
    setLogoError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setLogoError("Please choose an image file.");
    if (file.size > MAX_LOGO_BYTES) return setLogoError("Logo must be under 2MB.");
    const reader = new FileReader();
    reader.onload = () => set({ logoDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  const totals = useMemo(() => totalsFor(inv), [inv]);
  const renderData = useMemo(() => toRenderData(inv), [inv]);

  return {
    inv,
    set,
    setItem,
    addItem,
    removeItem,
    saved,
    unsyncedCount,
    showSaved,
    setShowSaved,
    openInvoice,
    removeSaved,
    surpriseMe,
    newInvoice,
    changeCurrency,
    applyTemplate,
    noteTyping,
    downloadPdf,
    downloading,
    backupOpen,
    setBackupOpen,
    offerOpen,
    setOfferOpen,
    logoError,
    onLogoFile,
    showBizDetails,
    setShowBizDetails,
    bizDetailsOpen,
    hasBizDetails,
    showClientDetails,
    setShowClientDetails,
    clientDetailsOpen,
    hasClientDetails,
    showInvoiceMeta,
    setShowInvoiceMeta,
    totals,
    renderData,
    currencies: CURRENCIES,
  };
}
