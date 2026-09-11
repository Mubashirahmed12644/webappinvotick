import { systemAssetImage } from "./system-assets";

/**
 * The part of an invoice's render data that comes from its template: colour, which blocks show,
 * header and background, the item-table alignment.
 *
 * One function for every web producer of `InvoiceRenderData` from a template — the saved invoice's
 * page (`getInvoiceRenderData`) and the form's Preview — so the preview cannot fall back to a
 * different default from the page the invoice opens on once it is saved.
 */
export interface TemplateLookSource {
  color?: string | null;
  titleColor?: string | null;
  headerId?: string | null;
  backgroundId?: string | null;
  backgroundOpacity?: number | null;
  showBusinessLogo?: boolean;
  showTitle?: boolean;
  showSender?: boolean;
  showReceiver?: boolean;
  showNotes?: boolean;
  showSignature?: boolean;
  showStamp?: boolean;
  showTotal?: boolean;
  showItemsTable?: boolean;
  showTerms?: boolean;
  showPayment?: boolean;
  itemTableHeaderAlignment?: string | null;
  itemTableBodyAlignment?: string | null;
}

/** `images` are the header and background found for the template's ids, if the account has them. */
export function templateLook(
  t: TemplateLookSource | null | undefined,
  images: { header?: string | null; background?: string | null } = {},
) {
  const toggles: Record<string, boolean> = {
    logo: t?.showBusinessLogo ?? true,
    title: t?.showTitle ?? true,
    sender: t?.showSender ?? true,
    receiver: t?.showReceiver ?? true,
    notes: t?.showNotes ?? true,
    signature: t?.showSignature ?? true,
    stamp: t?.showStamp ?? true,
    total: t?.showTotal ?? true,
    items: t?.showItemsTable ?? true,
    terms: t?.showTerms ?? true,
    payment: t?.showPayment ?? true,
  };
  return {
    color: t?.color || "#0D4DC0",
    titleColor: t?.titleColor ?? null, // auto-applies when mobile/server sends it
    toggles,
    // A system-default header/background is not synced; the web ships the same image under its id.
    headerImage: images.header ?? systemAssetImage(t?.headerId),
    backgroundImage: images.background ?? systemAssetImage(t?.backgroundId),
    backgroundOpacity: t?.backgroundOpacity ?? 1,
    itemTableHeaderAlignment: t?.itemTableHeaderAlignment ?? null,
    itemTableBodyAlignment: t?.itemTableBodyAlignment ?? null,
  };
}
