import type { Client, InvoiceSummary, User } from "./types";

// Sample data used only when MOCK_MODE=true, so the app is fully clickable
// without a running backend. Shapes mirror the real API responses.

export const mockUser: User = {
  id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  email: "demo@invotick.com",
  username: "Demo User",
  phoneNumber: "+15555555555",
  profilePictureUrl: null,
  role: "USER",
  isEmailVerified: true,
  lastLoginAt: new Date().toISOString(),
  createdAt: "2026-02-01T10:15:30Z",
};

export const mockClients: Client[] = [
  { id: "c1", name: "Acme Inc", companyName: "Acme", emailAddress: "billing@acme.com", currencyCode: "USD", city: "Karachi", country: "PK" },
  { id: "c2", name: "Globex Corp", emailAddress: "ap@globex.com", currencyCode: "USD", city: "Lahore", country: "PK" },
  { id: "c3", name: "Stark Industries", emailAddress: "tony@stark.com", currencyCode: "USD", city: "Dubai", country: "AE" },
];

export const mockInvoices: InvoiceSummary[] = [
  { id: "i1", clientId: "c1", clientName: "Acme Inc", invoiceNumber: "INV-0001", invoiceDate: "2026-06-01", dueDate: "2026-06-15", totalAmount: "1250.00", currency: "USD", status: "PAID" },
  { id: "i2", clientId: "c2", clientName: "Globex Corp", invoiceNumber: "INV-0002", invoiceDate: "2026-06-10", dueDate: "2026-06-24", totalAmount: "3400.50", currency: "USD", status: "SENT" },
  { id: "i3", clientId: "c3", clientName: "Stark Industries", invoiceNumber: "INV-0003", invoiceDate: "2026-06-20", dueDate: "2026-07-04", totalAmount: "820.00", currency: "USD", status: "OVERDUE" },
  { id: "i4", clientId: "c1", clientName: "Acme Inc", invoiceNumber: "INV-0004", invoiceDate: "2026-06-28", dueDate: "2026-07-12", totalAmount: "560.00", currency: "USD", status: "DRAFT" },
];

export const mockStats = {
  totalRevenue: 5470.5,
  paid: 1250.0,
  outstanding: 4220.5,
  invoiceCount: mockInvoices.length,
  clientCount: mockClients.length,
};
