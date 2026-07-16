import "server-only";
import { cache } from "react";
import { config } from "./config";
import { backendFetch } from "./backend";
import { mockClients, mockInvoices, mockStats } from "./mock";
import { systemAssetImage } from "./system-assets";
import { sortByOrder } from "./givens";
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
  name: string;
  companyName?: string | null;
  emailAddress?: string | null;
  phone?: string | null;
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

interface SyncPullData {
  clients?: RawClient[] | null;
  invoices?: RawInvoice[] | null;
  invoiceItems?: RawInvoiceItem[] | null;
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
  items: InvoiceItemDetail[];
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  const res = await backendFetch<InvoiceDetail>(`/v1/invoices/${id}`);
  return res.success ? res.data : null;
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
  color: string;
  titleColor?: string | null;
  toggles: Record<string, boolean>;
  business: { name: string; logo?: string | null } | null;
  client: ClientDetail | null;
  headerImage?: string | null;
  backgroundImage?: string | null;
  backgroundOpacity: number;
  signatureImage?: string | null;
  stampImage?: string | null;
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

  const toggles: Record<string, boolean> = {
    logo: template?.showBusinessLogo ?? true,
    title: template?.showTitle ?? true,
    sender: template?.showSender ?? true,
    receiver: template?.showReceiver ?? true,
    notes: template?.showNotes ?? true,
    signature: template?.showSignature ?? true,
    stamp: template?.showStamp ?? true,
    total: template?.showTotal ?? true,
    items: template?.showItemsTable ?? true,
  };

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
    color: template?.color || "#0D4DC0",
    titleColor: template?.titleColor ?? null, // auto-applies when mobile/server sends it
    toggles,
    business: business ? { name: business.name, logo: business.logo } : null,
    client: (client as ClientDetail) ?? null,
    headerImage: header?.image ?? systemAssetImage(template?.headerId),
    backgroundImage: background?.image ?? systemAssetImage(template?.backgroundId),
    backgroundOpacity: template?.backgroundOpacity ?? 1,
    signatureImage: toggles.signature ? sig?.image ?? null : null,
    stampImage: toggles.stamp ? stamp?.image ?? null : null,
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
      templates: [], signatures: [], stamps: [], headers: [],
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
  const templates: Template[] = (data.templates ?? [])
    .filter((t) => !t.isDeleted)
    .map((t) => ({
      id: t.id,
      name: t.templateName || "Template",
      color: t.color || "#0D4DC0",
      headerId: t.headerId,
      signatureId: t.signatureId,
      stampId: t.stampId,
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
    name: c.name,
    companyName: c.companyName,
    emailAddress: c.emailAddress,
    phone: c.phone,
    currencyCode: c.currencyCode,
    city: c.city,
    country: c.country,
  }));

  const invoices: InvoiceSummary[] = rawInvoices
    .map((i) => ({
      id: i.id,
      clientId: i.clientId,
      clientName: i.clientId ? clientNameById.get(i.clientId) ?? "—" : "—",
      invoiceNumber: i.invoiceNumber,
      invoiceDate: i.invoiceDate,
      dueDate: i.dueDate,
      totalAmount: i.totalAmount,
      currency: i.currency ?? "USD",
      status: i.status,
    }))
    .sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : -1));

  const totalRevenue = invoices.reduce((sum, i) => sum + num(i.totalAmount), 0);
  const paid = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + num(i.totalAmount), 0);

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
    primaryBusinessId: businesses[0]?.id ?? null,
    stats: {
      totalRevenue,
      paid,
      outstanding: totalRevenue - paid,
      invoiceCount: invoices.length,
      clientCount: clients.length,
    },
  };
});
