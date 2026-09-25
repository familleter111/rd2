"use client";

import { Bell, Check, ChevronDown, Database, ListOrdered, Menu as MenuIcon, RotateCcw, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { GuideControl } from "@/components/guide/guide-control";
import { GuideDot } from "@/components/guide/guide-mark";
import { StatusDot } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/modal";
import { useDismissable } from "@/components/ui/overlay";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { advanceTo, guideUi, useGuideTarget } from "@/lib/guide";
import { actions, useDemo } from "@/lib/store";
import { SidebarContent } from "./sidebar";

const searchShell =
  "flex h-12 min-w-0 flex-1 max-w-[720px] items-center gap-3 rounded-xl border border-line-strong bg-white/90 px-4 transition-[border-color,box-shadow] focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-100";

function SearchField({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const guided = useGuideTarget(5);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    if (guided) advanceTo(5);
    router.push(`/recherche?q=${encodeURIComponent(q)}`);
  };

  return (
    <form role="search" onSubmit={submit} className={cn(searchShell, guided && "guide-ring relative")}>
      {guided && <GuideDot step={5} hint="Tapez CS-01 dans la recherche puis Entrée." />}
      <Search className="h-5 w-5 shrink-0 text-ink-500" aria-hidden />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Rechercher un projet, un lot, un document…"
        aria-label="Rechercher un projet, un lot, un document"
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-ink-900 outline-none placeholder:text-ink-500"
      />
      {value && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => setValue("")}
          className="cursor-pointer rounded-md p-1 text-ink-500 hover:bg-slate-100 hover:text-ink-800"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </form>
  );
}

function SearchBox() {
  const pathname = usePathname();
  const params = useSearchParams();
  const q = pathname === "/recherche" ? (params.get("q") ?? "") : "";
  // Remount when the query in the URL changes so the field mirrors it.
  return <SearchField key={q} initial={q} />;
}

function Notifications() {
  const { notifications } = useDemo();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useDismissable<HTMLDivElement>(open, () => setOpen(false));
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl text-ink-700 transition-colors hover:bg-white"
      >
        <Bell className="h-6 w-6" strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-500 px-1 text-[11px] font-bold text-white ring-2 ring-canvas">
            {unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-40 mt-2 w-[min(400px,calc(100vw-2rem))] rounded-xl border border-line bg-white shadow-pop"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-semibold text-ink-900">Notifications</p>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => actions.readAllNotifications()}
                  className="cursor-pointer text-sm font-medium text-brand-700 hover:underline"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
            <ul className="max-h-96 overflow-y-auto p-1.5">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      actions.readNotification(n.id);
                      setOpen(false);
                      router.push(n.href);
                    }}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-brand-50"
                  >
                    <StatusDot tone={n.read ? "neutral" : n.tone} className="mt-1.5" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm", n.read ? "text-ink-700" : "font-semibold text-ink-900")}>{n.title}</span>
                      <span className="block text-[13px] text-ink-500">{n.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-400">{n.when}</span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EnvironmentMenu() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const ref = useDismissable<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Démonstration"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-white px-2.5 text-[16px] font-semibold text-brand-700 shadow-card transition-colors hover:border-brand-300 sm:gap-3 sm:px-4 xl:min-w-[236px]"
      >
        <Database className="h-5 w-5 text-ink-700" strokeWidth={1.8} aria-hidden />
        <span className="hidden flex-1 text-left xl:inline">Démonstration</span>
        <ChevronDown className={cn("h-5 w-5 text-ink-600 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-line bg-white p-1.5 shadow-pop"
          >
            <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Environnement</p>
            <div className="flex items-start gap-3 rounded-lg bg-brand-50 px-3 py-2.5">
              <Check className="mt-0.5 h-4 w-4 text-brand-700" aria-hidden />
              <span>
                <span className="block text-sm font-semibold text-brand-700">Démonstration</span>
                <span className="block text-xs text-ink-500">Données fictives de démonstration</span>
              </span>
            </div>
            <div className="my-1.5 border-t border-line" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                guideUi.openPanel();
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink-800 hover:bg-brand-50"
            >
              <ListOrdered className="h-4 w-4 text-ink-500" aria-hidden />
              Parcours des écrans
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setConfirm(true);
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink-800 hover:bg-brand-50"
            >
              <RotateCcw className="h-4 w-4 text-ink-500" aria-hidden />
              Réinitialiser les données
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Réinitialiser la démonstration ?"
        message="Les projets, documents, décisions et vues enregistrées créés pendant la session seront remplacés par les données de démonstration d'origine."
        confirmLabel="Réinitialiser"
        onConfirm={() => {
          actions.reset();
          router.push("/vue-ensemble");
          toast.show({ title: "Données réinitialisées", description: "Les données de démonstration d'origine sont restaurées.", tone: "info" });
        }}
      />
    </div>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Ouvrir le menu"
        onClick={() => setOpen(true)}
        className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-700 hover:bg-white lg:hidden"
      >
        <MenuIcon className="h-6 w-6" />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Menu" side="left" widthClass="max-w-[300px]" icon={<span />} bodyClassName="px-0 pb-0">
        <SidebarContent onNavigate={() => setOpen(false)} />
      </Drawer>
    </>
  );
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1600px] items-center gap-2 px-4 sm:gap-3 sm:px-8">
        <MobileNav />
        <Suspense fallback={<div className={searchShell} />}>
          <SearchBox />
        </Suspense>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
          <GuideControl />
          <Notifications />
          <EnvironmentMenu />
        </div>
      </div>
    </header>
  );
}
