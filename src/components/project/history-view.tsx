"use client";

import { ArrowRight, ChevronDown, CircleCheck, Download, ExternalLink, FileText, FlaskConical, History, TriangleAlert, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Select } from "@/components/ui/field";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { DOC_STATUS_DOT } from "@/lib/dossier-selectors";
import { downloadText, formatNumeric, formatTime, toCsv } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { useDemo } from "@/lib/store";
import type { DocSnapshot, HistoryEvent } from "@/lib/types";
import { EVENT_ICONS } from "./project-overview";
import { ProjectTabs } from "./project-frame";

/** Icon and colour of an event bubble (document, action done, deviation, lot…). */
function eventLook(e: HistoryEvent): { icon: LucideIcon; className: string } {
  if (e.icon === "check") return { icon: CircleCheck, className: "bg-success-500 text-white" };
  if (e.icon === "alert" || e.object === "Déviation") return { icon: TriangleAlert, className: "bg-warn-50 text-warn-600 ring-2 ring-warn-500" };
  if (e.object === "Lot") return { icon: FlaskConical, className: "bg-violet-100 text-violet-600" };
  return { icon: e.object === "Document" || e.object === "Formule" ? FileText : EVENT_ICONS[e.icon], className: "bg-brand-50 text-brand-600" };
}

function DocCard({ title, doc }: { title: string; doc: DocSnapshot }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-line p-4">
      <p className="border-b border-line pb-2 font-semibold text-ink-900">{title}</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-subtle text-ink-700">
          <FileText className="h-6 w-6" strokeWidth={1.5} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-ink-900">{doc.label}</span>
          <span className="block text-sm text-ink-500">Ajouté le {formatNumeric(doc.date)}</span>
        </span>
        <Badge tone={DOC_STATUS_DOT[doc.status] === "neutral" ? "info" : DOC_STATUS_DOT[doc.status]}>{doc.status}</Badge>
      </div>
    </div>
  );
}

function TextCard({ title, text, tone }: { title: string; text: string; tone: "old" | "new" }) {
  return (
    <div className={cn("min-w-0 flex-1 overflow-hidden rounded-xl border", tone === "new" ? "border-brand-100" : "border-line")}>
      <p className={cn("px-4 py-2 text-sm font-semibold", tone === "new" ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-ink-800")}>{title}</p>
      <p className="px-4 py-3 text-[15px] leading-relaxed text-ink-700">{text}</p>
    </div>
  );
}

function EventDetail({ event }: { event: HistoryEvent }) {
  const docHref = event.docId ? `/projets/${event.projectCode.toLowerCase()}/documents/${event.docId}` : undefined;
  return (
    <div className="mt-3 rounded-xl border border-line bg-white p-4 sm:p-5">
      {event.docBefore && event.docAfter ? (
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          <DocCard title="Avant" doc={event.docBefore} />
          <ArrowRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-ink-400 md:rotate-0" aria-hidden />
          <DocCard title="Après" doc={event.docAfter} />
        </div>
      ) : event.field ? (
        <>
          <p className="text-sm text-ink-600">
            Champ modifié : <span className="font-semibold text-ink-900">{event.field}</span>
          </p>
          <div className="mt-3 flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <TextCard title="Avant" text={event.oldValue ?? "—"} tone="old" />
            <ArrowRight className="mx-auto h-5 w-5 shrink-0 rotate-90 text-ink-400 md:rotate-0" aria-hidden />
            <TextCard title="Après" text={event.newValue ?? "—"} tone="new" />
          </div>
        </>
      ) : (
        <>
          <p className="font-semibold text-ink-900">Description</p>
          <p className="mt-2 rounded-lg bg-subtle px-4 py-3 text-[15px] leading-relaxed text-ink-700">{event.description ?? event.context}</p>
        </>
      )}
      {event.docBefore && event.description && <p className="mt-3 text-sm text-ink-600">{event.description}</p>}
      {event.motif && (
        <>
          <p className="mt-4 font-semibold text-ink-900">Motif</p>
          <p className="mt-2 rounded-lg bg-subtle px-4 py-3 text-[15px] text-ink-700">{event.motif}</p>
        </>
      )}
      {(docHref || event.href) && (
        <LinkButton
          href={docHref ?? event.href!}
          size="lg"
          className="mt-4"
          icon={docHref ? <FileText className="h-5 w-5" /> : <ExternalLink className="h-5 w-5" />}
        >
          {docHref ? "Ouvrir le document" : "Ouvrir la source"}
        </LinkButton>
      )}
    </div>
  );
}

export function HistoryView({
  slug,
  initialObject,
  initialEventId,
}: {
  slug: string;
  initialObject?: string;
  initialEventId?: string;
  allPeriods?: boolean;
}) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [object, setObject] = useState(initialObject ?? "Tous");
  const [author, setAuthor] = useState("Tous");
  const [period, setPeriod] = useState("");
  const [openId, setOpenId] = useState<string | null | undefined>(initialEventId);

  if (!project) return null;

  const cs = project.code === "CS-01";
  const late = state.formulaDecisions.some((d) => d.projectCode === project.code && d.status === "Approuvée");
  const events = state.history.filter((h) => h.projectCode === project.code).sort((a, b) => b.at.localeCompare(a.at));
  const objects = [...new Set(events.map((e) => e.object))];
  const authors = [...new Set(events.map((e) => e.author))];
  const visible = events
    .filter((e) => object === "Tous" || e.object === object)
    .filter((e) => author === "Tous" || e.author === author)
    .filter((e) => !period || e.at.startsWith(period));
  // The latest event is expanded by default (screen 47), unless another one was requested.
  const expanded = openId === undefined ? visible[0]?.id : openId;

  const exportCsv = () => {
    const rows = [
      ["Date", "Heure", "Événement", "Objet", "Type", "Auteur", "Motif", "Champ", "Avant", "Après", "Description"],
      ...visible.map((e) => [
        e.at.slice(0, 10),
        formatTime(e.at),
        e.title,
        e.objectLabel,
        e.type,
        e.author,
        e.motif ?? "",
        e.field ?? "",
        e.docBefore ? `${e.docBefore.label} (${e.docBefore.status})` : (e.oldValue ?? ""),
        e.docAfter ? `${e.docAfter.label} (${e.docAfter.status})` : (e.newValue ?? ""),
        e.description ?? "",
      ]),
    ];
    downloadText(`historique-${project.code}.csv`, toCsv(rows), "text/csv");
    toast.show({ title: "Historique exporté", description: `${visible.length} événement(s) — historique-${project.code}.csv` });
  };

  return (
    <>
      <ProjectTabs slug={slug} />

      <Card className="mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-ink-900">Historique du projet</h2>
            <p className="mt-1 text-[15px] text-ink-600">Suivez les principales évolutions du projet, des documents et des actions.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Type d'événement" htmlFor="h-object" className="w-44">
              <Select id="h-object" options={["Tous", ...objects]} value={object} onChange={(e) => setObject(e.target.value)} />
            </Field>
            <Field label="Utilisateur" htmlFor="h-author" className="w-44">
              <Select id="h-author" options={["Tous", ...authors]} value={author} onChange={(e) => setAuthor(e.target.value)} />
            </Field>
            <Field label="Période" htmlFor="h-period" className="w-48">
              <DateInput id="h-period" value={period} onChange={setPeriod} onClear={() => setPeriod("")} />
            </Field>
            <Button variant="outline" size="lg" icon={<Download className="h-5 w-5" />} onClick={exportCsv} disabled={!visible.length}>
              Exporter l&apos;historique
            </Button>
          </div>
        </div>
        {period && <p className="mt-2 text-right text-sm text-ink-500">Événements du {formatNumeric(period)}</p>}

        {visible.length === 0 ? (
          <EmptyState icon={History} title="Aucun événement" description="Aucun événement ne correspond aux filtres." />
        ) : (
          <ol className="relative mt-6 space-y-3 before:absolute before:bottom-6 before:left-[11px] before:top-6 before:w-0.5 before:bg-brand-100">
            {visible.map((e) => {
              const look = eventLook(e);
              const isOpen = e.id === expanded;
              return (
                <li key={e.id} id={e.id} className="relative pl-10">
                  <span className="absolute left-0 top-5 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-brand-200" aria-hidden>
                    <span className="h-3.5 w-3.5 rounded-full bg-brand-600" />
                  </span>
                  <div className={cn("rounded-xl border px-4 py-3", isOpen ? "border-line bg-subtle/70" : "border-line bg-white")}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenId(isOpen ? null : e.id)}
                      className="flex w-full cursor-pointer flex-wrap items-center gap-4 text-left sm:flex-nowrap"
                    >
                      <span className="w-24 shrink-0 text-sm">
                        <span className="block font-semibold text-ink-900">{formatNumeric(e.at)}</span>
                        <span className="text-ink-500">{formatTime(e.at)}</span>
                      </span>
                      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full", look.className)}>
                        <look.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-ink-900">{e.title}</span>
                        <span className="block text-sm text-ink-500">
                          Par {e.author} <span className="mx-1 text-ink-300">|</span> {e.object}
                        </span>
                      </span>
                      <ChevronDown className={cn("h-5 w-5 shrink-0 text-ink-600 transition-transform", isOpen && "rotate-180")} aria-hidden />
                    </button>
                    {isOpen && <EventDetail event={e} />}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <ScreenRef n={cs ? (late ? 47 : 16) : undefined} label={late ? "Projet — historique" : "Historique et traçabilité"} />
    </>
  );
}
