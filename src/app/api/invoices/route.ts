import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";
import type { InvoiceDetail } from "@/lib/data";

// Create an invoice: POST /v1/invoices (scoped to the logged-in user by JWT).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const res = await backendFetch<InvoiceDetail>("/v1/invoices", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return NextResponse.json(res, { status: res.success ? 201 : 400 });
}
