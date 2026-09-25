"use client";

import { Download, FileText, History } from "lucide-react";
import Link from "next/link";
import { EVENT_ICONS } from "@/components/project/project-overview";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { downloadText, formatDateTime, formatNumeric } from "@/lib/format";
import { DOC_STATUS_TONE } from "@/lib/selectors";
import { useDemo } from "@/lib/store";
import { findPilot } from "./lot-frame";

export function LotDocumentsView({ slug, lotSlug }: { slug: string; lotSlug: string }) {
  const state = useDemo();
  const { project, pilot } = findPilot(state, slug, lotSlug);
  if (!project || !pilot) return null;
  const docs = state.documents.filter((d) => d.projectCode === project.code && (d.lot === pilot.lotCode || (d.formula === pilot.formula && d.category === "Formulation")));
  const proofs = pilot.steps.flatMap((s) => s.proofs.map((p) => ({ ...p, step: s.title })));
  return (
    <>
      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink-900">Documents du lot {pilot.lotCode}</h2>
          <Link href={`/projets/${project.slug}/documents`} className="text-sm font-semibold text-brand-700 hover:underline">
            Tous les documents du projet
          </Link>
        </div>
        {docs.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun document" />
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <FileText className="h-6 w-6 text-ink-600" strokeWidth={1.5} aria-hidden />
                <Link href={`/projets/${project.slug}/documents?doc=${d.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block font-semibold text-ink-900">
                    {d.name} v{d.version}
                  </span>
                  <span className="block text-ink-500">{d.type}</span>
                </Link>
                <Badge tone={DOC_STATUS_TONE[d.status]} dot>
                  {d.status}
                </Badge>
                <span className="text-ink-600">{formatNumeric(d.updatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        {proofs.length > 0 && (
          <>
            <h3 className="mt-6 font-bold text-ink-900">Preuves de réalisation</h3>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {proofs.map((p) => (
                <li key={`${p.step}-${p.name}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <FileText className="h-5 w-5 text-ink-600" aria-hidden />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink-900">{p.name}</span>
                    <span className="block text-ink-500">
                      Étape {p.step} — {p.size}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Télécharger ${p.name}`}
                    onClick={() => {
                      downloadText(`${p.name}.txt`, `${p.name}\nPreuve de réalisation — ${p.step}`);
                      toast.show({ title: "Téléchargement lancé", description: p.name });
                    }}
                    className="cursor-pointer rounded p-1 text-ink-600 hover:bg-subtle"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      <ScreenRef label="Lot pilote — documents" />
    </>
  );
}

export function LotHistoryView({ slug, lotSlug }: { slug: string; lotSlug: string }) {
  const state = useDemo();
  const { project, pilot } = findPilot(state, slug, lotSlug);
  if (!project || !pilot) return null;
  const events = state.history.filter((h) => h.projectCode === project.code && (h.lotCode === pilot.lotCode || h.objectLabel.includes(pilot.lotCode))).sort((a, b) => b.at.localeCompare(a.at));
  return (
    <>
      <Card className="mt-5 p-5">
        <h2 className="text-xl font-bold text-ink-900">Historique du lot {pilot.lotCode}</h2>
        {events.length === 0 ? (
          <EmptyState icon={History} title="Aucun événement" description="Démarrage, étapes, contrôles et déviations du lot sont tracés ici." />
        ) : (
          <ol className="mt-4 space-y-3">
            {events.map((e) => {
              const Icon = EVENT_ICONS[e.icon];
              return (
                <li key={e.id} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
                  <Icon className="mt-0.5 h-5 w-5 text-ink-500" aria-hidden />
                  <span className="flex-1">
                    <span className="block font-semibold text-ink-900">{e.title}</span>
                    <span className="block text-ink-600">{e.field ? `${e.field} : ${e.oldValue} → ${e.newValue}` : e.description}</span>
                    <span className="block text-xs text-ink-500">
                      {formatDateTime(e.at)} — {e.author}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <Link href={`/projets/${project.slug}/historique?periode=tout`} className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
          Historique complet du projet
        </Link>
      </Card>
      <ScreenRef label="Lot pilote — historique" />
    </>
  );
}
