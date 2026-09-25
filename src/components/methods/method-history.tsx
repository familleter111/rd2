"use client";

import { CalendarDays, ChevronDown, ChevronUp, Download, FileClock, FileText, GitCompareArrows, History } from "lucide-react";
import { Fragment, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadText, formatDateTime, formatNumeric, formatTime } from "@/lib/format";
import { getDemoState, useDemo } from "@/lib/store";
import type { HistoryEvent, Method } from "@/lib/types";
import { exportMethodHistory, findMethodBySlug } from "./method-frame";

const PERIODS = [
  { value: "sept-oct", label: "01/09/2026 → 31/10/2026", from: "2026-09-01", to: "2026-10-31" },
  { value: "tout", label: "Tout l'historique", from: "", to: "" },
  { value: "sept", label: "Septembre 2026", from: "2026-09-01", to: "2026-09-30" },
  { value: "oct", label: "Octobre 2026", from: "2026-10-01", to: "2026-10-31" },
];

const DOT: Record<HistoryEvent["type"], string> = {
  Correction: "bg-warn-500",
  Approbation: "bg-success-500",
  Création: "bg-brand-600",
  Modification: "bg-brand-600",
  Ajout: "bg-brand-600",
  Soumission: "bg-brand-600",
  Suppression: "bg-danger-500",
  Relance: "bg-brand-600",
};

function CompareModal({ method, open, onClose }: { method: Method; open: boolean; onClose: () => void }) {
  const [a, b] = method.versions;
  const p = method.protocol;
  const rows: [string, string, string][] = p
    ? [
        ["Statut", a?.status ?? "—", b?.status ?? "—"],
        ["Date", a ? formatNumeric(a.date) : "—", b ? formatNumeric(b.date) : "—"],
        ["Auteur", a?.by ?? "—", b?.by ?? "—"],
        ["Note", a?.note ?? "—", b?.note ?? "—"],
        ...p.criteria.map((c): [string, string, string] => [c.label, a?.status === "Brouillon" ? "Inchangé (brouillon)" : c.value || "—", c.value || "—"]),
      ]
    : [];
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Comparer les versions" subtitle={`${method.ref} • ${method.name}`}>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="bg-subtle text-ink-700">
              <th className="rounded-l-lg px-4 py-2.5 font-semibold">Élément</th>
              <th className="px-4 py-2.5 font-semibold">{a?.version}</th>
              <th className="rounded-r-lg px-4 py-2.5 font-semibold">{b?.version}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([label, x, y]) => (
              <tr key={label}>
                <td className="px-4 py-2.5 text-ink-700">{label}</td>
                <td className={cn("px-4 py-2.5", x !== y && "font-semibold text-brand-700")}>{x}</td>
                <td className="px-4 py-2.5 text-ink-900">{y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export function MethodHistoryView({ slug }: { slug: string }) {
  const state = useDemo();
  const method = findMethodBySlug(state, slug);
  const [type, setType] = useState("Tous");
  const [period, setPeriod] = useState("sept-oct");
  const [user, setUser] = useState("Tous");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  if (!method) return null;

  const events = state.history.filter((h) => h.methodRef === method.ref).sort((x, y) => y.at.localeCompare(x.at));
  const types = [...new Set(events.map((e) => e.type))];
  const users = [...new Set(events.map((e) => e.author))];
  const range = PERIODS.find((p) => p.value === period)!;
  const visible = events
    .filter((e) => type === "Tous" || e.type === type)
    .filter((e) => user === "Tous" || e.author === user)
    .filter((e) => !range.from || (e.at.slice(0, 10) >= range.from && e.at.slice(0, 10) <= range.to));
  const openId = expanded ?? visible.find((e) => e.field?.startsWith("ECH-"))?.id ?? visible.find((e) => e.field)?.id ?? null;

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-ink-900">Historique de la méthode</h2>
              <p className="text-[15px] text-ink-600">Traçabilité des modifications, validations et événements de la méthode.</p>
            </div>
            <Button variant="outline" size="lg" icon={<Download className="h-5 w-5" />} onClick={() => exportMethodHistory(getDemoState(), method)}>
              Exporter l&apos;historique
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-line bg-subtle p-4 md:grid-cols-3">
            <label className="text-sm font-semibold text-ink-800">
              Type d&apos;événement
              <Select className="mt-1.5" options={[{ value: "Tous", label: "Tous les événements" }, ...types]} value={type} onChange={(e) => setType(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-ink-800">
              Période
              <Select className="mt-1.5" icon={CalendarDays} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} value={period} onChange={(e) => setPeriod(e.target.value)} />
            </label>
            <label className="text-sm font-semibold text-ink-800">
              Utilisateur
              <Select className="mt-1.5" options={[{ value: "Tous", label: "Tous les utilisateurs" }, ...users]} value={user} onChange={(e) => setUser(e.target.value)} />
            </label>
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={History} title="Aucun événement" description="Aucun événement ne correspond aux filtres." />
          ) : (
            <div className="relative mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
                  <tr className="bg-subtle text-ink-700">
                    <th className="w-8 px-3 py-3" aria-label="Type" />
                    <th className="px-3 py-3 font-semibold">Date et heure</th>
                    <th className="px-3 py-3 font-semibold">Utilisateur</th>
                    <th className="px-3 py-3 font-semibold">Événement</th>
                    <th className="px-3 py-3 font-semibold">Objet / Version</th>
                    <th className="w-10 px-3 py-3" aria-label="Détail" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((e) => {
                    const open = openId === e.id;
                    return (
                      <Fragment key={e.id}>
                        <tr className={cn("cursor-pointer hover:bg-subtle", open && "bg-subtle")} onClick={() => setExpanded(open ? "" : e.id)}>
                          <td className="px-3 py-3">
                            <span className={cn("block h-3.5 w-3.5 rounded-full", DOT[e.type])} aria-hidden />
                          </td>
                          <td className="px-3 py-3 text-ink-800">
                            {formatNumeric(e.at)}
                            <span className="block text-ink-500">{formatTime(e.at)}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="block text-ink-900">{e.author}</span>
                            <span className="block text-ink-500">{e.authorRole ?? ""}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="block font-semibold text-ink-900">{e.title}</span>
                            <span className="line-clamp-1 block text-ink-600">{e.description ?? (e.field ? `${e.field} : ${e.oldValue} → ${e.newValue}` : "")}</span>
                          </td>
                          <td className="px-3 py-3">
                            {e.version ? (
                              <Badge tone={e.version.tone} size="md">
                                {e.version.label}
                              </Badge>
                            ) : (
                              <span className="text-ink-500">{e.object}</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              aria-expanded={open}
                              aria-label={open ? "Masquer le détail" : "Afficher le détail"}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setExpanded(open ? "" : e.id);
                              }}
                              className="cursor-pointer rounded p-1 text-ink-600 hover:bg-white"
                            >
                              {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </button>
                          </td>
                        </tr>
                        {open && (
                          <tr className="bg-subtle">
                            <td />
                            <td colSpan={5} className="px-3 pb-4">
                              <div className="grid gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
                                <div>
                                  <p className="font-semibold text-ink-900">Modification</p>
                                  <p className="text-ink-700">{e.field ? `${e.field} : ${e.oldValue} → ${e.newValue}` : (e.description ?? "—")}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-ink-900">Motif de la modification</p>
                                  <p className="text-ink-700">{e.motif ?? "—"}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-ink-900">Date et heure</p>
                                  <p className="text-ink-700">{formatDateTime(e.at)}</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-ink-900">Utilisateur</p>
                                  <p className="text-ink-700">{e.author}</p>
                                  <p className="text-ink-500">{e.authorRole ?? ""}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit p-5">
          <h2 className="text-lg font-bold text-ink-900">Versions de la méthode</h2>
          {method.versions.length === 0 ? (
            <p className="mt-3 flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-ink-600">
              <FileClock className="h-6 w-6 text-ink-500" strokeWidth={1.5} aria-hidden />
              Aucune version : le protocole n&apos;a pas encore été préparé.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {method.versions.map((v) => (
                <li
                  key={v.version}
                  className={cn("rounded-xl border border-l-4 border-line p-4", v.status === "Approuvé" ? "border-l-success-500" : v.status === "Brouillon" ? "border-l-brand-600" : "border-l-ink-300")}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-ink-900">{v.version}</span>
                    <Badge tone={v.status === "Approuvé" ? "success" : v.status === "Brouillon" ? "info" : "neutral"} dot size="md">
                      {v.status}
                    </Badge>
                    <Menu
                      label={`Actions pour ${v.version}`}
                      className="ml-auto"
                      items={[
                        { label: "Voir le protocole", icon: FileText, href: `/methodes/${method.ref.toLowerCase()}/protocole` },
                        {
                          label: "Télécharger",
                          icon: Download,
                          onSelect: () => {
                            downloadText(`${method.ref}-${v.version}.txt`, `${method.ref} — ${v.version} (${v.status})\n${v.note}\n`);
                            toast.show({ title: "Téléchargement lancé", description: `${method.ref} — ${v.version}` });
                          },
                        },
                      ]}
                    />
                  </div>
                  <p className="mt-1 text-sm text-ink-700">{formatDateTime(v.date)}</p>
                  <p className="text-sm text-ink-500">Par {v.by}</p>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            size="lg"
            className="mt-4 w-full"
            icon={<GitCompareArrows className="h-5 w-5" />}
            disabled={method.versions.length < 2}
            title={method.versions.length < 2 ? "Deux versions sont nécessaires pour comparer." : undefined}
            onClick={() => setComparing(true)}
          >
            Comparer les versions
          </Button>
          {method.versions.length < 2 && <p className="mt-2 text-center text-xs text-ink-500">Créez une nouvelle version (menu « Actions méthode ») pour comparer.</p>}
        </Card>
      </div>
      <CompareModal method={method} open={comparing} onClose={() => setComparing(false)} />
      <ScreenRef n={method.ref === "M-01" ? 28 : undefined} label="Méthode — historique et versions" />
    </>
  );
}
