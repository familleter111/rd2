import type { ReactNode } from "react";
import { GuideFloatingDot } from "@/components/guide/guide-mark";
import { Toaster } from "@/components/ui/toast";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

/** Desktop shell (web only): the sidebar stays visible, narrower windows scroll horizontally. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-[1200px]">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Topbar />
        <main id="contenu" className="mx-auto max-w-[1600px] px-8 pb-6 pt-7">
          {children}
        </main>
      </div>
      <GuideFloatingDot />
      <Toaster />
    </div>
  );
}
