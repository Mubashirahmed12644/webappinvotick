"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav";
import { cn } from "@/lib/cn";

// Bottom navigation for small screens — mirrors the mobile app's bottom bar.
const items = navItems.filter((i) => ["/dashboard", "/invoices", "/estimates", "/clients", "/settings"].includes(i.href));

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-outline-variant)] bg-[var(--color-surface)] lg:hidden">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold",
              active ? "text-[var(--color-primary)]" : "text-[var(--color-on-surface-variant)]",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
