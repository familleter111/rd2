"use client";

import {
  CalendarDays,
  ChartNoAxesColumn,
  ChevronRight,
  FileText,
  FlaskConical,
  Folder,
  House,
  Settings,
  SquareCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GuideDot, useGuideNav } from "@/components/guide/guide-mark";
import { CURRENT_USER } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { useGuideTarget } from "@/lib/guide";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that keep the item active. */
  also?: string[];
  /** Screen of the guided tour reached from this entry. */
  guide?: number;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/vue-ensemble", label: "Vue d'ensemble", icon: House, also: ["/recherche"] },
  { href: "/projets", label: "Projets", icon: Folder, guide: 6 },
  { href: "/activites", label: "Mes activités", icon: SquareCheck, guide: 29 },
  { href: "/planning", label: "Planning", icon: CalendarDays },
  { href: "/methodes", label: "Méthodes & essais", icon: FlaskConical },
  { href: "/stabilite", label: "Stabilité", icon: ChartNoAxesColumn, guide: 40 },
  { href: "/dossiers", label: "Dossiers & revues", icon: FileText, guide: 48 },
];

function isActive(pathname: string, item: NavItem) {
  return [item.href, ...(item.also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isActive(pathname, item);
  const guided = useGuideTarget(item.guide) && !active;
  const go = useGuideNav();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={(e) => {
        // Next step of the tour: open the exact screen of the mock-up (e.g. the dossier of CS-01).
        if (guided && item.guide !== undefined) {
          e.preventDefault();
          go(item.guide);
        }
        onNavigate?.();
      }}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative mr-3 flex h-12 items-center gap-3.5 rounded-r-xl pl-7 pr-3 text-[15.5px] transition-colors",
        active
          ? "bg-brand-100/80 font-semibold text-brand-700 before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-r-full before:bg-brand-600"
          : "font-medium text-ink-800 hover:bg-brand-50 hover:text-brand-700",
        guided && "bg-brand-50 font-semibold text-brand-700 ring-2 ring-inset ring-brand-400",
      )}
    >
      <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.7} aria-hidden />
      <span className="whitespace-nowrap">{item.label}</span>
      {guided && item.guide !== undefined && <GuideDot step={item.guide} inline className="ml-auto" />}
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const guideConfig = useGuideTarget(54) && !pathname.startsWith("/configuration");
  const go = useGuideNav();
  return (
    <div className="flex h-full flex-col">
      <Link
        href="/vue-ensemble"
        onClick={onNavigate}
        className="mx-auto flex flex-col items-center px-4 pb-7 pt-7"
        aria-label="Laboratoires SIMED — Espace R&D, accueil"
      >
        <Image src="/brand/simed-logo.png" alt="Laboratoires SIMED" width={200} height={114} priority className="h-auto w-[196px]" />
        <span className="-mt-0.5 text-[15px] font-medium text-ink-600">Espace R&amp;D</span>
      </Link>

      <nav aria-label="Navigation principale" className="flex-1 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mx-4 space-y-1 border-t border-line pb-5 pt-4">
        <Link
          href="/configuration"
          onClick={(e) => {
            if (guideConfig) {
              e.preventDefault();
              go(54);
            }
            onNavigate?.();
          }}
          className={cn(
            "flex h-11 items-center gap-3.5 rounded-lg px-3 text-[15px] font-medium transition-colors",
            pathname.startsWith("/configuration") ? "bg-brand-100/80 text-brand-700" : "text-ink-800 hover:bg-brand-50",
            guideConfig && "bg-brand-50 font-semibold text-brand-700 ring-2 ring-inset ring-brand-400",
          )}
        >
          <Settings className="h-[22px] w-[22px]" strokeWidth={1.7} aria-hidden />
          Configuration
          {guideConfig && <GuideDot step={54} inline className="ml-auto" />}
        </Link>
        <Link
          href="/profil"
          onClick={onNavigate}
          className={cn(
            "flex h-11 items-center gap-3.5 rounded-lg px-3 text-[15px] font-medium transition-colors",
            pathname.startsWith("/profil") ? "bg-brand-100/80 text-brand-700" : "text-ink-800 hover:bg-brand-50",
          )}
        >
          <User className="h-[22px] w-[22px]" strokeWidth={1.7} aria-hidden />
          <span className="flex-1">{CURRENT_USER}</span>
          <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-line bg-white lg:block">
      <SidebarContent />
    </aside>
  );
}
