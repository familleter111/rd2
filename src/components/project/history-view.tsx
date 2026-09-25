"use client";

import { ChevronRight, Download, ExternalLink, FileText, Funnel, History, MessageSquareText, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { IconTile } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Select } from "@/components/ui/field";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { DEMO_TODAY, downloadText, formatDateTime, formatShort, formatTime, toCsv } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { useDemo } from "@/lib/store";
import type { HistoryEvent } from "@/lib/types";
import { EVENT_ICONS } from "./project-overview";
import { ProjectTabs } from "./project-frame";

function Quote({ children }: { children: string }) {
  return (
    <p className="text-[15px] italic leading-relaxed text-ink-700">
      <span className="mr-1 text-2xl leading-none text-ink-300" aria-hidden>
        “
      </span>
      {children}
      <span className="ml-1 text-2xl leading-none text-ink-300" aria-hidden>
        ”
      </span>
    </p>
  );
}

function EventDetail({ event }: { event: HistoryEvent }) {
  const cells: [string, string][] = [
    ["Objet", event.objectLabel],
    ["Type", event.type],
    ["Date et heure", formatDateTime(event.at)],
    ["Auteur", event.author],
    ["Motif", event.motif ?? "—"],
  ];
  return (
    <>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
        {cells.map(([k, v]) => (
          <div key={k} className={k === "Motif" ? "sm:col-span-2" : undefined}>
            <dt className="text-sm text-ink-600">{k}</dt>
            <dd className="mt-0.5 text-[15px] text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 border-t border-line pt-5">
        {event.field ? (
          <>
            <h3 className="font-semibold text-ink-900">Champ modifié</h3>
            <p className="mt-2 flex items-center gap-2.5 rounded-lg bg-slate-100 px-3.5 py-2.5 text-sm text-ink-800">
              <MessageSquareText className="h-4 w-4 text-ink-600" aria-hidden />
              {event.field}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-line">
                <p className="bg-slate-100 px-4 py-2.5 text-sm font-semibold text-ink-800">Ancienne valeur</p>
                <div className="px-4 py-4">
                  <Quote>{event.oldValue ?? "—"}</Quote>
                </div>
              </div>
              <div className="overflow-hidden rounded-xl border border-brand-100">
                <p className="bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700">Nouvelle valeur</p>
                <div className="px-4 py-4">
                  <Quote>{event.newValue ?? "—"}</Quote>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-ink-900">Description</h3>
            <p className="mt-2 rounded-lg bg-subtle px-4 py-3 text-[15px] leading-relaxed text-ink-700">{event.description ?? "—"}</p>
          </>
        )}
      </div>
      {event.href && (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <LinkButton href={event.href} variant="outline" size="lg" icon={<ExternalLink className="h-5 w-5" />}>
            Ouvrir la source
          </LinkButton>
          <span className="text-sm text-ink-500">Accéder à l&apos;élément d&apos;origine de cette modification.</span>
        </div>
      )}
    </>
  );
}

export function HistoryView({
  slug,
  initialObject,
  initialEventId,
  allPeriods,
}: {
  slug: string;
  initialObject?: string;
  initialEventId?: string;
  allPeriods: boolean;
}) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [object, setObject] = useState(initialObject ?? "Tous");
  const [author, setAuthor] = useState("Tous");
  const [period, setPeriod] = useState(allPeriods || initialEventId ? "" : DEMO_TODAY);
  const [selectedId, setSelectedId] = useState<string | null>(initialEventId ?? null);

  if (!project) return null;

  const events = state.history.filter((h) => h.projectCode === project.code).sort((a, b) => b.at.localeCompare(a.at));
  const objects = [...new Set(events.map((e) => e.object))];
  const authors = [...new Set(events.map((e) => e.author))];
  const visible = events
    .filter((e) => object === "Tous" || e.object === object)
    .filter((e) => author === "Tous" || e.author === author)
    .filter((e) => !period || e.at.startsWith(period));
  const selected = visible.find((e) => e.id === selectedId) ?? visible[0];

  const exportCsv = () => {
    const rows = [
      ["Date", "Heure", "Événement", "Objet", "Type", "Auteur", "Motif", "Champ", "Ancienne valeur", "Nouvelle valeur", "Description"],
      ...visible.map((e) => [
        e.at.slice(0, 10),
        formatTime(e.at),
        e.title,
        e.objectLabel,
        e.type,
        e.author,
        e.motif ?? "",
        e.field ?? "",
        e.oldValue ?? "",
        e.newValue ?? "",
        e.description ?? "",
      ]),
    ];
    downloadText(`historique-${project.code}.csv`, toCsv(rows), "text/csv");
    toast.show({ title: "Historique exporté", description: `${visible.length} événement(s) — historique-${project.code}.csv` });
  };

  return (
    <>
      <ProjectTabs
        slug={slug}
        actions={
          <Button size="lg" icon={<Download className="h-5 w-5" />} onClick={exportCsv} disabled={!visible.length}>
            Exporter l&apos;historique
          </Button>
        }
      />

      <Card className="mt-5 p-5">
        <h2 className="flex items-center gap-2.5 text-xl font-bold text-ink-900">
          <Funnel className="h-5 w-5 text-ink-700" aria-hidden />
          Filtres
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
          <Field label="Objet" htmlFor="h-object">
            <Select id="h-object" options={["Tous", ...objects]} value={object} onChange={(e) => setObject(e.target.value)} />
          </Field>
          <Field label="Auteur" htmlFor="h-author">
            <Select id="h-author" options={["Tous", ...authors]} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
          <Field label="Période" htmlFor="h-period" hint={!period ? "Toutes les dates" : undefined}>
            <DateInput id="h-period" value={period} onChange={setPeriod} onClear={() => setPeriod("")} />
          </Field>
          <Button
            variant="outline"
            size="lg"
            icon={<RotateCcw className="h-5 w-5" />}
            className="md:mb-0"
            onClick={() => {
              setObject("Tous");
              setAuthor("Tous");
              setPeriod("");
            }}
          >
            Réinitialiser
          </Button>
        </div>
      </Card>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <Card className="p-5">
          <h2 className="flex items-center gap-2.5 text-xl font-bold text-ink-900">
            <FileText className="h-6 w-6 text-ink-700" strokeWidth={1.6} aria-hidden />
            Événements ({visible.length})
          </h2>
          {visible.length === 0 ? (
            <EmptyState icon={History} title="Aucun événement" description="Aucun événement ne correspond aux filtres. Élargissez la période." />
          ) : (
            <ol className="relative mt-4 space-y-2 before:absolute before:bottom-6 before:left-[11px] before:top-6 before:w-0.5 before:bg-line">
              {visible.map((e) => {
                const Icon = EVENT_ICONS[e.icon];
                const active = e.id === selected?.id;
                return (
                  <li key={e.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full cursor-pointer items-center gap-4 rounded-xl py-3 pl-0 pr-3 text-left transition-colors ${
                        active ? "bg-brand-50" : "hover:bg-subtle"
                      }`}
                    >
                      <span
                        className={`relative z-10 ml-1 h-4 w-4 shrink-0 rounded-full ring-4 ${active ? "bg-brand-600 ring-brand-100" : "bg-brand-200 ring-white"}`}
                        aria-hidden
                      />
                      <span className="w-24 shrink-0 text-sm text-ink-700">
                        {formatShort(e.at)}
                        <br />
                        <span className="text-ink-500">{formatTime(e.at)}</span>
                      </span>
                      <IconTile icon={Icon} size="md" className="rounded-full bg-slate-100 text-ink-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink-900">{e.title}</span>
                        <span className="block truncate text-sm text-ink-500">{e.context}</span>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-ink-500" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card className="h-fit p-6">
          <h2 className="flex items-center gap-2.5 text-xl font-bold text-ink-900">
            <FileText className="h-6 w-6 text-ink-700" strokeWidth={1.6} aria-hidden />
            Détail de l&apos;événement
          </h2>
          <div className="mt-5">
            {selected ? (
              <EventDetail event={selected} />
            ) : (
              <p className="text-sm text-ink-500">
                Sélectionnez un événement. <Link href={`/projets/${slug}`} className="text-brand-700 underline">Retour au projet</Link>
              </p>
            )}
          </div>
        </Card>
      </div>

      <ScreenRef n={16} label="Historique et traçabilité" />
    </>
  );
}
