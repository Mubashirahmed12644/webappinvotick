"use client";

// Pushes locally-created free invoices into the signed-in user's account.
// Guarantees the owner asked for:
//   • Stable UUID per invoice (assigned at creation) — the dedup key.
//   • Only ever CREATES (POST) — never overwrites existing server data.
//   • The local `isSynced` flag means a pushed invoice is never pushed twice.
// Uses the app's existing create endpoints (same payloads the authenticated
// invoice/client forms use), so no backend change is required.
import { apiSend } from "@/lib/client-api";
import { computeLineItem } from "@/lib/invoice-calc";
import { getAllInvoices, putInvoice } from "./store";
import { totalsFor, uuid } from "./adapter";

export interface SyncResult {
  synced: number;
  alreadySynced: number;
  failed: number;
  needsBusiness: boolean;
}

// Invoices attach to a business; find the user's first one. Uses /v1/businesses
// (the client proxy only allows /v1/** paths — /v2/sync/pull is blocked).
async function fetchPrimaryBusinessId(): Promise<string | null> {
  try {
    const res = await fetch("/api/backend/v1/businesses");
    const json = await res.json();
    const businesses = Array.isArray(json?.data) ? json.data : [];
    return businesses[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function backupLocalInvoices(): Promise<SyncResult> {
  const all = await getAllInvoices();
  const pending = all.filter((i) => !i.isSynced);
  const alreadySynced = all.length - pending.length;
  if (pending.length === 0) return { synced: 0, alreadySynced, failed: 0, needsBusiness: false };

  const businessId = await fetchPrimaryBusinessId();
  if (!businessId) return { synced: 0, alreadySynced, failed: pending.length, needsBusiness: true };

  let synced = 0;
  let failed = 0;

  for (const inv of pending) {
    try {
      // 1) Create a client from the invoice's bill-to (client-supplied UUID).
      const clientId = uuid();
      const clientRes = await apiSend("/v1/clients", "POST", {
        id: clientId,
        businessId,
        name: inv.clientName || "Client",
        emailAddress: inv.clientEmail || null,
        addressLine1: inv.clientAddress || null,
        currencyCode: inv.currency,
        credit: 0,
        openingBalance: 0,
        rating: 0,
      });
      if (!clientRes.success) {
        failed++;
        continue;
      }

      // 2) Create the invoice with its stable UUID + line items.
      const totals = totalsFor(inv);
      const items = inv.items
        .filter((it) => it.description || it.rate)
        .map((it) => {
          const c = computeLineItem({ quantity: it.quantity, unitPrice: it.rate });
          return {
            id: uuid(),
            invoiceId: inv.id,
            inventoryItemId: uuid(),
            taxId: null,
            unitTypeId: null,
            itemCategoryId: null,
            name: it.description || "Item",
            description: null,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.rate) || 0,
            netPrice: c.netPrice,
            discount: null,
            discountType: null,
          };
        });

      const invoiceRes = await apiSend("/v1/invoices", "POST", {
        id: inv.id,
        clientId,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.issueDate,
        dueDate: inv.dueDate || null,
        poNumber: inv.poNumber || null,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        shippingCost: totals.shippingCost,
        totalAmount: totals.total,
        status: "DRAFT",
        discountType: inv.discountValue ? inv.discountType : null,
        discountValue: inv.discountValue ? Number(inv.discountValue) : null,
        taxId: null,
        termsId: null,
        paymentMethodId: null,
        notes: [inv.notes, inv.terms].filter(Boolean).join("\n\n") || null,
        templateId: null,
        signatureId: null,
        stampId: null,
        language: null,
        currency: inv.currency,
        items,
      });
      if (!invoiceRes.success) {
        failed++;
        continue;
      }

      await putInvoice({ ...inv, isSynced: true });
      synced++;
    } catch {
      failed++;
    }
  }

  return { synced, alreadySynced, failed, needsBusiness: false };
}
