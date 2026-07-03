import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import type { InvoiceDetail } from "@/lib/data";

// Update an invoice: PUT /v1/invoices/{id}
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const res = await backendFetch<InvoiceDetail>(`/v1/invoices/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}

// Soft-delete an invoice: DELETE /v1/invoices/{id}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await backendFetch<null>(`/v1/invoices/${id}`, { method: "DELETE" });
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}
