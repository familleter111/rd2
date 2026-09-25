import type { ReactNode } from "react";
import { GuideFloatingDot } from "@/components/guide/guide-mark";
import { Toaster } from "@/components/ui/toast";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-[264px]">
        <Topbar />
        <main id="contenu" className="mx-auto max-w-[1600px] px-4 pb-6 pt-6 sm:px-8 sm:pt-7">
          {children}
        </main>
      </div>
      <GuideFloatingDot />
      <Toaster />
    </div>
  );
}
