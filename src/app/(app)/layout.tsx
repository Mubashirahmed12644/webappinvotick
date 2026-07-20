import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { backendFetchWithStatus } from "@/lib/backend";
import { Sidebar } from "@/components/app/Sidebar";
import { Topbar } from "@/components/app/Topbar";
import { MobileNav } from "@/components/app/MobileNav";
import { SessionWatch } from "@/components/app/SessionWatch";

// The whole authenticated app is login-gated — keep it out of search indexes so
// all SEO authority stays on the public landing ("/").
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // A cookie is not proof the session still works.
  //
  // Signing this browser out happens on the phone, so nothing here hears about it — the cookie
  // stays, and every page rendered on it came back empty. That is worse than an error: the account
  // looked intact and wiped, rather than signed out. Asking the backend once, at the top of the
  // authenticated app, is what turns that into being sent back to sign in.
  //
  // `?signout=1` is what drops the cookie; without it the redirect below bounces straight back here.
  const probe = await backendFetchWithStatus("/v1/profile/me");
  if (probe.status === 401) redirect("/login?signout=1");

  return (
    <div className="flex min-h-screen w-full">
      {/* The check above runs once, while this renders. Moving around inside the app is a soft
          navigation that never re-renders it, so without something watching, a browser signed out
          on the phone kept working until the page happened to reload. */}
      <SessionWatch />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={session.user} />
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6 lg:p-8 lg:pb-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
