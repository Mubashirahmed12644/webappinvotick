import { NextResponse } from "next/server";
import { backendFetch } from "@/lib/backend";

// Generic authenticated passthrough to the Spring backend for the logged-in user.
// e.g. POST /api/backend/v1/clients  ->  POST {BACKEND}/v1/clients
// Only /v1/** paths are allowed (no admin/webpanel access from the browser).
function buildPath(segments: string[], search: string): string | null {
  const path = "/" + segments.join("/");
  if (!path.startsWith("/v1/")) return null;
  if (path.includes("/webpanel")) return null;
  return path + search;
}

async function handle(request: Request, segments: string[], method: string) {
  const url = new URL(request.url);
  const path = buildPath(segments, url.search);
  if (!path) {
    return NextResponse.json({ success: false, message: "Path not allowed." }, { status: 403 });
  }

  const body = method === "GET" || method === "DELETE" ? undefined : await request.text();
  const res = await backendFetch(path, { method, body });
  return NextResponse.json(res, { status: res.success ? 200 : 400 });
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, (await params).path, "GET");
}
export async function POST(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, (await params).path, "POST");
}
export async function PUT(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, (await params).path, "PUT");
}
export async function DELETE(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, (await params).path, "DELETE");
}
