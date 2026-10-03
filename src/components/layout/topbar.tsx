"use client";

import { Bell, Check, ChevronDown, Database, ListOrdered, LogOut, PlayCircle, RotateCcw, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { GuideControl } from "@/components/guide/guide-control";
import { GuideDot } from "@/components/guide/guide-mark";
import { StatusDot } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/modal";
import { useDismissable } from "@/components/ui/overlay";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { advanceTo, guideUi, useGuideTarget } from "@/lib/guide";
import { actions, useDemo } from "@/lib/store";

const menuItem = "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink-800 hover:bg-brand-50";

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
              {notifications.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-500">Aucune notification pour le moment.</li>}
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
  const [confirm, setConfirm] = useState<"reset" | "demo" | "quit" | null>(null);
  const router = useRouter();
  const { demo } = useDemo();
  const ref = useDismissable<HTMLDivElement>(open, () => setOpen(false));
  const label = demo ? "Démonstration" : "Espace de travail";
  const ask = (kind: "reset" | "demo" | "quit") => {
    setOpen(false);
    setConfirm(kind);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-white px-2.5 text-[16px] font-semibold text-brand-700 shadow-card transition-colors hover:border-brand-300 sm:gap-3 sm:px-4 xl:min-w-[236px]"
      >
        <Database className="h-5 w-5 text-ink-700" strokeWidth={1.8} aria-hidden />
        <span className="hidden flex-1 text-left xl:inline">{label}</span>
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
                <span className="block text-sm font-semibold text-brand-700">{label}</span>
                <span className="block text-xs text-ink-500">{demo ? "Données fictives de démonstration" : "Vos projets et vos données"}</span>
              </span>
            </div>
            <div className="my-1.5 border-t border-line" />
            {demo ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    guideUi.openPanel();
                  }}
                  className={menuItem}
                >
                  <ListOrdered className="h-4 w-4 text-ink-500" aria-hidden />
                  Parcours des écrans
                </button>
                <button type="button" role="menuitem" onClick={() => ask("reset")} className={menuItem}>
                  <RotateCcw className="h-4 w-4 text-ink-500" aria-hidden />
                  Réinitialiser la démonstration
                </button>
                <button type="button" role="menuitem" onClick={() => ask("quit")} className={menuItem}>
                  <LogOut className="h-4 w-4 text-ink-500" aria-hidden />
                  Quitter la démonstration
                </button>
              </>
            ) : (
              <>
                <button type="button" role="menuitem" onClick={() => ask("demo")} className={menuItem}>
                  <PlayCircle className="h-4 w-4 text-ink-500" aria-hidden />
                  Charger la démonstration
                </button>
                <button type="button" role="menuitem" onClick={() => ask("reset")} className={menuItem}>
                  <RotateCcw className="h-4 w-4 text-ink-500" aria-hidden />
                  Tout remettre à zéro
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        title={demo ? "Réinitialiser la démonstration ?" : "Tout remettre à zéro ?"}
        message={
          demo
            ? "Les projets, documents, décisions et vues enregistrées créés pendant la session seront remplacés par les données de démonstration d'origine."
            : "Tous les projets, documents, activités et réglages de l'espace R&D seront supprimés. Cette action est définitive."
        }
        confirmLabel={demo ? "Réinitialiser" : "Tout supprimer"}
        onConfirm={() => {
          actions.reset();
          router.push("/vue-ensemble");
          toast.show(
            demo
              ? { title: "Données réinitialisées", description: "Les données de démonstration d'origine sont restaurées.", tone: "info" }
              : { title: "Espace remis à zéro", description: "Aucun projet ni donnée : l'espace est prêt à être configuré.", tone: "info" },
          );
        }}
      />
      <ConfirmDialog
        open={confirm === "demo"}
        onClose={() => setConfirm(null)}
        title="Charger la démonstration ?"
        message="Vos projets et vos données seront remplacés par un jeu de données fictif, avec le parcours guidé des écrans. Vous pourrez quitter la démonstration pour revenir à un espace vierge."
        confirmLabel="Charger la démonstration"
        onConfirm={() => {
          actions.loadDemo();
          router.push("/vue-ensemble");
          toast.show({ title: "Démonstration chargée", description: "Données fictives et parcours guidé des écrans.", tone: "info" });
        }}
      />
      <ConfirmDialog
        open={confirm === "quit"}
        onClose={() => setConfirm(null)}
        title="Quitter la démonstration ?"
        message="Les données fictives seront retirées : l'espace R&D revient à un état vierge, sans projet ni donnée."
        confirmLabel="Quitter la démonstration"
        onConfirm={() => {
          actions.clearAll();
          router.push("/vue-ensemble");
          toast.show({ title: "Démonstration quittée", description: "L'espace R&D est vierge, prêt à être configuré.", tone: "info" });
        }}
      />
    </div>
  );
}

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1600px] items-center gap-3 px-8">
        <Suspense fallback={<div className={searchShell} />}>
          <SearchBox />
        </Suspense>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <GuideControl />
          <Notifications />
          <EnvironmentMenu />
        </div>
      </div>
    </header>
  );
}
