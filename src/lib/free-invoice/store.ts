// Minimal promise-based IndexedDB wrapper for the free tool's local invoices.
// IndexedDB (not localStorage) so users can keep 100s of invoices with logos
// without hitting the ~5MB string cap. No external dependency.
import type { FreeInvoice } from "./types";

const DB_NAME = "invotick-free";
const STORE = "invoices";
const VERSION = 1;
const ACTIVE_KEY = "invotick-free:activeId";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

// True when the draft is worth persisting (avoids saving blank seeds).
export function hasContent(inv: FreeInvoice): boolean {
  return Boolean(
    inv.businessName || inv.businessEmail || inv.clientName ||
      inv.items.some((it) => it.description || it.rate),
  );
}

export async function putInvoice(inv: FreeInvoice): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put(inv));
  } catch {
    /* private mode / no IDB — tool still works in-memory */
  }
}

export async function getAllInvoices(): Promise<FreeInvoice[]> {
  try {
    const all = await tx<FreeInvoice[]>("readonly", (s) => s.getAll() as IDBRequest<FreeInvoice[]>);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id) as unknown as IDBRequest<undefined>);
  } catch {
    /* ignore */
  }
}

// Which draft the editor had open — used to restore after a reload/redirect.
export function getActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* ignore */
  }
}
