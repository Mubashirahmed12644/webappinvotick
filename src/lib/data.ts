import "server-only";
import { cache } from "react";
import { config } from "./config";
import { backendFetch } from "./backend";
import { mockClients, mockInvoices, mockStats } from "./mock";
import { templateLook } from "./render-look";
import { localDate, summarizeInvoices } from "./invoice-status";
import { sortByOrder } from "./givens";
import { savedItemsOf, type SavedInvoiceItem } from "./invoice-preview";
import type { Client, InvoiceStatus, InvoiceSummary } from "./types";

interface RawInvoice {
  id: string;
  businessId?: string | null;
  clientId: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  poNumber?: string | null;
  subtotal?: string | null;
  discountAmount?: string | null;
  taxAmount?: string | null;
  shippingCost?: string | null;
  totalAmount: string;
  currency?: string | null;
  status: InvoiceStatus;
  notes?: string | null;
  templateId?: string | null;
  signatureId?: string | null;
  stampId?: string | null;
  isDeleted?: boolean;
}

interface RawInvoiceItem {
  id: string;
  invoiceId?: string | null;
  // The item's links. The edit form sends them back as they are (savedItemsOf).
  inventoryItemId?: string | null;
  taxId?: string | null;
  unitTypeId?: string | null;
  itemCategoryId?: string | null;
  name: string;
  description?: string | null;
  quantity: string;
  unitPrice: string;
  netPrice: string;
  discountValue?: string | null;
  discountAmount?: string | null;
  discountType?: string | null;
  taxRate?: string | null;
  taxAmount?: string | null;
  taxType?: string | null;
  total?: string | null;
  orderIndex?: number | null; // forward-compatible: server doesn't send this yet
  createdAt?: string | null;
  isDeleted?: boolean;
}

interface RawClient {
  id: string;
  businessId?: string | null;
  name: string;
  companyName?: string | null;
  emailAddress?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  currencyCode?: string | null;
  city?: string | null;
  country?: string | null;
  isDeleted?: boolean;
}

interface RawProduct {
  id: string;
  name: string;
  unitPrice?: string | null;
  taxRate?: string | null;
  isDeleted?: boolean;
}

interface RawTax {
  id: string;
  name: string;
  rate?: string | null;
  isDeleted?: boolean;
}

interface RawBusiness {
  id: string;
  name: string;
  currencyCode?: string | null;
  logo?: string | null;
  isDeleted?: boolean;
}

interface RawTemplate {
  id: string;
  templateName?: string | null;
  color?: string | null;
  templateStyle?: number | null;
  headerId?: string | null;
  backgroundId?: string | null;
  backgroundOpacity?: number | null;
  headerAlpha?: number | null;
  titleColor?: string | null; // forward-compatible: server doesn't send this yet
  signatureId?: string | null;
  stampId?: string | null;
  showBusinessLogo?: boolean;
  showTitle?: boolean;
  showInvoiceMeta?: boolean;
  showSender?: boolean;
  showReceiver?: boolean;
  showPayment?: boolean;
  showNotes?: boolean;
  showSignature?: boolean;
  showStamp?: boolean;
  showTerms?: boolean;
  showTotal?: boolean;
  showItemsTable?: boolean;
  itemTableHeaderAlignment?: string | null;
  itemTableBodyAlignment?: string | null;
  isDeleted?: boolean;
}

interface RawAsset {
  id: string;
  name?: string | null;
  image?: string | null;
  isDeleted?: boolean;
}

interface RawMerchant {
  id: string;
  name: string;
  isDeleted?: boolean;
}

interface RawExpense {
  id: string;
  merchantId?: string | null;
  date: string;
  category?: string | null;
  total: string;
  description?: string | null;
  isDeleted?: boolean;
}

interface RawPayment {
  id: string;
  clientId?: string | null;
  paymentNumber: string;
  amount: string;
  paymentDate: string;
  status?: string | null;
  isDeleted?: boolean;
}

interface RawEstimate {
  id: string;
  customerId?: string | null;
  estimateNumber: string;
  estimateDate?: string | null;
  totalAmount: string;
  currency?: string | null;
  estimateStatus?: string | null;
  isDeleted?: boolean;
}

// One payment applied to one invoice (sync `invoicePayments`). An invoice's paid amount is the sum of
// its rows that are not deleted — the same sum as the app's totalPaidAmount (InvoiceDao).
interface RawInvoicePayment {
  id: string;
  invoiceId: string;
  amountApplied?: string | null;
  isDeleted?: boolean;
}

interface SyncPullData {
  clients?: RawClient[] | null;
  invoices?: RawInvoice[] | null;
  invoiceItems?: RawInvoiceItem[] | null;
  invoicePayments?: RawInvoicePayment[] | null;
  inventoryItems?: RawProduct[] | null;
  taxes?: RawTax[] | null;
  businesses?: RawBusiness[] | null;
  merchants?: RawMerchant[] | null;
  expenses?: RawExpense[] | null;
  payments?: RawPayment[] | null;
  estimates?: RawEstimate[] | null;
  templates?: RawTemplate[] | null;
  signatures?: RawAsset[] | null;
  stamps?: RawAsset[] | null;
  headers?: RawAsset[] | null;
  backgrounds?: RawAsset[] | null;
}

export interface Business {
  id: string;
  name: string;
  currencyCode?: string | null;
  logo?: string | null;
}

export interface InvoiceAsset {
  id: string;
  name: string;
  image?: string | null;
}

export interface Template {
  id: string;
  name: string;
  color: string;
  headerId?: string | null;
  signatureId?: string | null;
  stampId?: string | null;
  // The rest of what the template draws with, so the form's Preview matches the saved invoice.
  titleColor?: string | null;
  backgroundId?: string | null;
  backgroundOpacity?: number | null;
  itemTableHeaderAlignment?: string | null;
  itemTableBodyAlignment?: string | null;
  showBusinessLogo: boolean;
  showTitle: boolean;
  showSender: boolean;
  showReceiver: boolean;
  showPayment: boolean;
  showNotes: boolean;
  showSignature: boolean;
  showStamp: boolean;
  showTerms: boolean;
  showTotal: boolean;
  showItemsTable: boolean;
}
export interface Merchant {
  id: string;
  name: string;
}
export interface Expense {
  id: string;
  merchantId?: string | null;
  date: string;
  category?: string | null;
  total: string;
  description?: string | null;
}
export interface Payment {
  id: string;
  clientId?: string | null;
  paymentNumber: string;
  amount: string;
  paymentDate: string;
  status?: string | null;
}
export interface Estimate {
  id: string;
  customerId?: string | null;
  estimateNumber: string;
  estimateDate?: string | null;
  totalAmount: string;
  currency: string;
  status: string;
}

export interface Product {
  id: string;
  name: string;
  unitPrice: string;
  taxRate?: string | null;
}

export interface Tax {
  id: string;
  name: string;
  rate: string;
}

export interface WorkspaceData {
  clients: Client[];
  invoices: InvoiceSummary[];
  products: Product[];
  taxes: Tax[];
  businesses: Business[];
  merchants: Merchant[];
  expenses: Expense[];
  payments: Payment[];
  estimates: Estimate[];
  templates: Template[];
  signatures: InvoiceAsset[];
  stamps: InvoiceAsset[];
  headers: InvoiceAsset[];
  backgrounds: InvoiceAsset[];
  primaryBusinessId: string | null;
  stats: {
    totalRevenue: number;
    paid: number;
    outstanding: number;
    invoiceCount: number;
    clientCount: number;
  };
}

function num(v: string | number | null | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
}

export interface InvoiceItemDetail {
  id: string;
  name: string;
  description?: string | null;
  quantity: string;
  unitPrice: string;
  netPrice: string;
  discount?: string | null;
  discountType?: string | null;
}

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  poNumber?: string | null;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  shippingCost: string;
  totalAmount: string;
  status: InvoiceStatus;
  discountType?: string | null;
  discountValue: string;
  notes?: string | null;
  currency: string;
  clientId: string;
  templateId?: string | null;
  signatureId?: string | null;
  stampId?: string | null;
  // The form shows none of these, and an edit sends each back as it is (keptInvoiceFields): the
  // update copies every field of the request, so one left out would be erased.
  termsId?: string | null;
  paymentInstructionId?: string | null;
  language?: string | null;
  signatureOffset?: string | null;
  stampOffset?: string | null;
  signatureScale?: string | null;
  stampScale?: string | null;
  items: InvoiceItemDetail[];
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const res = await backendFetch<InvoiceDetail>(`/v1/invoices/${id}`);
  return res.success ? res.data : null;
}

/**
 * The invoice's items for the edit form, from the sync pull: what the invoice's page shows, each with
 * its own tax and its links (savedItemsOf). The same cached pull getWorkspace reads, so no extra call.
 * null when the pull does not have the invoice (the pull failed, or mock mode): the form must not
 * start from a guess.
 */
export async function getInvoiceItemsForEdit(id: string): Promise<SavedInvoiceItem[] | null> {
  const data = await getRawSync();
  if (!(data.invoices ?? []).some((i) => i.id === id && !i.isDeleted)) return null;
  return savedItemsOf(id, data.invoiceItems ?? []);
}

export interface ClientDetail {
  id: string;
  businessId?: string | null;
  name: string;
  currencyCode?: string | null;
  emailAddress?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  country?: string | null;
  companyName?: string | null;
  faxNumber?: string | null;
  additionalNotes?: string | null;
  openingBalance?: string | null;
}

export async function getClientDetail(id: string): Promise<ClientDetail | null> {
  const res = await backendFetch<ClientDetail>(`/v1/clients/${id}`);
  return res.success ? res.data : null;
}

export interface Profile {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string | null;
  isVerified?: boolean;
  country?: string | null;
  city?: string | null;
}

export async function getProfile(): Promise<Profile | null> {
  const res = await backendFetch<Profile>("/v1/profile/me");
  return res.success ? res.data : null;
}

export interface BusinessDetail {
  id: string;
  name: string;
  shortName?: string | null;
  emailAddress?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  currencyCode?: string | null;
}

export async function getBusinessDetail(id: string): Promise<BusinessDetail | null> {
  const res = await backendFetch<BusinessDetail>(`/v1/businesses/${id}`);
  return res.success ? res.data : null;
}

// Full, faithful invoice render bundle sourced from sync (has per-item tax,
// businessId, header image and currency that the REST detail endpoint omits).
export interface RenderItem {
  sn: number;
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  discountValue: number;
  discountType: string;
  taxRate: number;
  amount: number;
}

export interface InvoiceRenderData {
  id: string;
  /**
   * Which kind of document this is. Absent means "INVOICE", which is what every snapshot captured
   * before estimates reached the HTML renderer says — and shared snapshots are frozen, so the
   * default is load-bearing rather than tidiness.
   *
   * An estimate is the same document with a different vocabulary and no money received: the labels
   * come from ESTIMATE_LABELS and the AMOUNT PAID / BALANCE DUE rows are dropped.
   */
  documentType?: "INVOICE" | "ESTIMATE";
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  poNumber?: string | null;
  status: InvoiceStatus;
  currency: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingCost: number;
  total: number;
  amountPaid?: number | null;
  balanceDue?: number | null;
  paymentStatus?: string | null;
  notes?: string | null;
  // Terms & Conditions + Payment Instructions text (native TermsModule / PaymentInstructionsModule);
  // rendered when present + toggled on. Column alignment mirrors the native item-table config.
  terms?: string | null;
  paymentInstructions?: string | null;
  itemTableHeaderAlignment?: string | null;
  itemTableBodyAlignment?: string | null;
  color: string;
  titleColor?: string | null;
  toggles: Record<string, boolean>;
  business: {
    name: string;
    logo?: string | null;
    // Full sender detail (mirrors the client) so the "From" block matches native.
    emailAddress?: string | null;
    phone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
  client: ClientDetail | null;
  headerImage?: string | null;
  backgroundImage?: string | null;
  backgroundOpacity: number;
  signatureImage?: string | null;
  // Signature/company-stamp position (fraction of the sheet, 0..1) + size, so the render places them
  // where the user dragged them instead of a hardcoded default.
  signatureOffsetX?: number | null;
  signatureOffsetY?: number | null;
  signatureSize?: number | null;
  stampImage?: string | null;
  stampOffsetX?: number | null;
  stampOffsetY?: number | null;
  stampSize?: number | null;
  // Auto PAID / PARTIALLY-PAID stamp — a SEPARATE stamp pinned to the totals box, shown alongside the
  // company stamp above.
  paymentStampImage?: string | null;
  items: RenderItem[];
}

export async function getInvoiceRenderData(id: string): Promise<InvoiceRenderData | null> {
  const data = await getRawSync();
  const inv = (data.invoices ?? []).find((i) => i.id === id && !i.isDeleted);
  if (!inv) return null;

  const client = (data.clients ?? []).find((c) => c.id === inv.clientId) ?? null;
  const business = (data.businesses ?? []).find((b) => b.id === inv.businessId) ?? null;
  const template = (data.templates ?? []).find((t) => t.id === inv.templateId) ?? null;
  const header = template?.headerId ? (data.headers ?? []).find((h) => h.id === template.headerId) : null;
  const background = template?.backgroundId ? (data.backgrounds ?? []).find((b) => b.id === template.backgroundId) : null;
  const sig = (data.signatures ?? []).find((s) => s.id === (inv.signatureId ?? template?.signatureId));
  const stamp = (data.stamps ?? []).find((s) => s.id === (inv.stampId ?? template?.stampId));

  const orderedItems = sortByOrder((data.invoiceItems ?? []).filter((it) => it.invoiceId === id && !it.isDeleted));
  const items: RenderItem[] = orderedItems
    .map((it, i) => ({
      sn: i + 1,
      name: it.name,
      description: it.description,
      quantity: num(it.quantity),
      unitPrice: num(it.unitPrice),
      discountValue: num(it.discountValue),
      discountType: it.discountType ?? "PERCENTAGE",
      taxRate: num(it.taxRate),
      amount: num(it.netPrice) * num(it.quantity),
    }));

  // Colour, blocks, header and background come from the one function the invoice form's Preview
  // uses too, so a preview cannot fall back to a different default from this page.
  const look = templateLook(template, { header: header?.image, background: background?.image });

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    poNumber: inv.poNumber,
    status: inv.status,
    currency: inv.currency || client?.currencyCode || business?.currencyCode || "USD",
    subtotal: num(inv.subtotal),
    discountAmount: num(inv.discountAmount),
    taxAmount: num(inv.taxAmount),
    shippingCost: num(inv.shippingCost),
    total: num(inv.totalAmount),
    notes: inv.notes,
    terms: null,
    paymentInstructions: null,
    ...look,
    business: business ? { name: business.name, logo: business.logo } : null,
    client: (client as ClientDetail) ?? null,
    signatureImage: look.toggles.signature ? sig?.image ?? null : null,
    stampImage: look.toggles.stamp ? stamp?.image ?? null : null,
    items,
  };
}

// One sync pull per render, shared across the page tree.
const getRawSync = cache(async (): Promise<SyncPullData> => {
  if (config.mockMode) return {};
  const res = await backendFetch<SyncPullData>("/v2/sync/pull");
  return res.data ?? {};
});

export const getWorkspace = cache(async (): Promise<WorkspaceData> => {
  if (config.mockMode) {
    return {
      clients: mockClients, invoices: mockInvoices, products: [], taxes: [],
      businesses: [], merchants: [], expenses: [], payments: [], estimates: [],
      templates: [], signatures: [], stamps: [], headers: [], backgrounds: [],
      primaryBusinessId: null, stats: mockStats,
    };
  }

  const data = await getRawSync();

  const rawClients = (data.clients ?? []).filter((c) => !c.isDeleted);
  const rawInvoices = (data.invoices ?? []).filter((i) => !i.isDeleted);
  const products: Product[] = (data.inventoryItems ?? [])
    .filter((p) => !p.isDeleted)
    .map((p) => ({ id: p.id, name: p.name, unitPrice: p.unitPrice ?? "0", taxRate: p.taxRate }));
  const taxes: Tax[] = (data.taxes ?? [])
    .filter((t) => !t.isDeleted)
    .map((t) => ({ id: t.id, name: t.name, rate: t.rate ?? "0" }));
  const businesses: Business[] = (data.businesses ?? [])
    .filter((b) => !b.isDeleted)
    .map((b) => ({ id: b.id, name: b.name, currencyCode: b.currencyCode, logo: b.logo }));
  const asset = (a: RawAsset): InvoiceAsset => ({ id: a.id, name: a.name ?? "", image: a.image });
  const signatures = (data.signatures ?? []).filter((s) => !s.isDeleted && s.image).map(asset);
  const stamps = (data.stamps ?? []).filter((s) => !s.isDeleted && s.image).map(asset);
  const headers = (data.headers ?? []).filter((h) => !h.isDeleted && h.image).map(asset);
  const backgrounds = (data.backgrounds ?? []).filter((b) => !b.isDeleted && b.image).map(asset);
  const templates: Template[] = (data.templates ?? [])
    .filter((t) => !t.isDeleted)
    .map((t) => ({
      id: t.id,
      name: t.templateName || "Template",
      color: t.color || "#0D4DC0",
      headerId: t.headerId,
      signatureId: t.signatureId,
      stampId: t.stampId,
      titleColor: t.titleColor,
      backgroundId: t.backgroundId,
      backgroundOpacity: t.backgroundOpacity,
      itemTableHeaderAlignment: t.itemTableHeaderAlignment,
      itemTableBodyAlignment: t.itemTableBodyAlignment,
      showBusinessLogo: t.showBusinessLogo ?? true,
      showTitle: t.showTitle ?? true,
      showSender: t.showSender ?? true,
      showReceiver: t.showReceiver ?? true,
      showPayment: t.showPayment ?? true,
      showNotes: t.showNotes ?? true,
      showSignature: t.showSignature ?? true,
      showStamp: t.showStamp ?? true,
      showTerms: t.showTerms ?? true,
      showTotal: t.showTotal ?? true,
      showItemsTable: t.showItemsTable ?? true,
    }));
  const merchants: Merchant[] = (data.merchants ?? [])
    .filter((m) => !m.isDeleted)
    .map((m) => ({ id: m.id, name: m.name }));
  const expenses: Expense[] = (data.expenses ?? [])
    .filter((e) => !e.isDeleted)
    .map((e) => ({ id: e.id, merchantId: e.merchantId, date: e.date, category: e.category, total: e.total, description: e.description }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const payments: Payment[] = (data.payments ?? [])
    .filter((p) => !p.isDeleted)
    .map((p) => ({ id: p.id, clientId: p.clientId, paymentNumber: p.paymentNumber, amount: p.amount, paymentDate: p.paymentDate, status: p.status }))
    .sort((a, b) => (a.paymentDate < b.paymentDate ? 1 : -1));
  const estimates: Estimate[] = (data.estimates ?? [])
    .filter((e) => !e.isDeleted)
    .map((e) => ({ id: e.id, customerId: e.customerId, estimateNumber: e.estimateNumber, estimateDate: e.estimateDate, totalAmount: e.totalAmount, currency: e.currency ?? "USD", status: e.estimateStatus ?? "DRAFT" }))
    .sort((a, b) => ((a.estimateDate ?? "") < (b.estimateDate ?? "") ? 1 : -1));

  const clientNameById = new Map(rawClients.map((c) => [c.id, c.name]));

  const clients: Client[] = rawClients.map((c) => ({
    id: c.id,
    businessId: c.businessId ?? null,
    name: c.name,
    companyName: c.companyName,
    emailAddress: c.emailAddress,
    phone: c.phone,
    addressLine1: c.addressLine1,
    currencyCode: c.currencyCode,
    city: c.city,
    country: c.country,
  }));

  // What was paid against each invoice: the sum of its invoice payments that are not deleted.
  const paidByInvoice = new Map<string, number>();
  for (const p of data.invoicePayments ?? []) {
    if (p.isDeleted) continue;
    paidByInvoice.set(p.invoiceId, (paidByInvoice.get(p.invoiceId) ?? 0) + num(p.amountApplied));
  }

  const invoices: InvoiceSummary[] = rawInvoices
    .map((i) => ({
      id: i.id,
      clientId: i.clientId,
      clientName: i.clientId ? clientNameById.get(i.clientId) ?? "—" : "—",
      businessId: i.businessId,
      invoiceNumber: i.invoiceNumber,
      invoiceDate: i.invoiceDate,
      dueDate: i.dueDate,
      totalAmount: i.totalAmount,
      currency: i.currency ?? "USD",
      status: i.status,
      paidAmount: paidByInvoice.get(i.id) ?? 0,
    }))
    .sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : -1));

  // The app's rule (invoice-status.ts): a DRAFT or a CANCELLED invoice is not money anybody owes.
  // The server's date decides "overdue" here; nothing reads these stats today.
  const summary = summarizeInvoices(invoices, localDate());

  return {
    clients,
    invoices,
    products,
    taxes,
    businesses,
    merchants,
    expenses,
    payments,
    estimates,
    templates,
    signatures,
    stamps,
    headers,
    backgrounds,
    primaryBusinessId: businesses[0]?.id ?? null,
    stats: {
      totalRevenue: summary.revenue,
      paid: summary.collected,
      outstanding: summary.outstanding,
      invoiceCount: invoices.length,
      clientCount: clients.length,
    },
  };
});
