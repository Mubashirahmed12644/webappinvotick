// Mirrors the backend ApiResponse<T> wrapper: { success, message, data }
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

export interface User {
  id: string;
  email: string;
  username: string;
  phoneNumber?: string | null;
  profilePictureUrl?: string | null;
  role: string;
  isEmailVerified: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
  message?: string;
}

export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";

// Summary shape used in list views.
export interface InvoiceSummary {
  id: string;
  clientId: string | null;
  clientName?: string | null;
  businessId?: string | null;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate?: string | null; // YYYY-MM-DD
  totalAmount: string; // string-encoded decimal
  currency: string;
  status: InvoiceStatus;
  isSynced?: boolean;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  businessId?: string | null;
  name: string;
  companyName?: string | null;
  emailAddress?: string | null;
  phone?: string | null;
  currencyCode?: string | null;
  credit?: string;
  openingBalance?: string;
  city?: string | null;
  country?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DashboardTotals {
  invoiceTotalAmount: number;
  paymentTotalAmount: number;
  expenseTotalAmount: number;
}
