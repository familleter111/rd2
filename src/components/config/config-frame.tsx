"use client";

import { User } from "lucide-react";
import type { ReactNode } from "react";
import { Breadcrumb, PageHeader } from "@/components/ui/page";
import { LinkTabs } from "@/components/ui/tabs";

/** Header and tabs of the configuration pages (screens 54–55). */
export function ConfigFrame({ title, subtitle, screen, children }: { title: string; subtitle: string; screen: ReactNode; children: ReactNode }) {
  return (
    <>
      <Breadcrumb items={[{ label: "Configuration" }]} />
      <PageHeader className="mt-3" title={title} subtitle={subtitle} />
      <LinkTabs
        className="mt-5"
        items={[
          { href: "/configuration", label: "Équipe & rôles" },
          { href: "/configuration/modeles", label: "Modèles de parcours", guide: 55 },
          { href: "/configuration/ressources", label: "Ressources" },
          { href: "/configuration/notifications", label: "Notifications" },
        ]}
      />
      {children}
      <p className="mt-6 flex items-center gap-2 text-[15px] text-ink-600">
        <User className="h-5 w-5 text-ink-500" aria-hidden />
        Rôle actuel : <span className="font-semibold text-ink-900">Administrateur</span>
      </p>
      {screen}
    </>
  );
}
