"use client";

import { ArrowRight, FileText, FolderOpen, Plus } from "lucide-react";
import { ProductVisual } from "@/components/product-visual";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, ScreenRef } from "@/components/ui/page";
import { allSections, missingElements, projectReviews } from "@/lib/dossier-selectors";
import { dossierActions, useDemo } from "@/lib/store";

/** "Dossiers & revues" entry of the menu: one card per project dossier. */
export function DossiersList() {
  const state = useDemo();
  const projects = state.projects.filter((p) => !p.archived || state.dossiers.some((d) => d.projectCode === p.code));

  return (
    <>
      <PageHeader title="Dossiers & revues" subtitle="Dossiers CTD, revues de dossier, réserves et transferts industriels." />
      {projects.length === 0 && (
        <Card className="mt-6">
          <EmptyState
            icon={FolderOpen}
            title="Aucun dossier pour le moment"
            description="Les dossiers CTD, les revues et les transferts sont rattachés aux projets : créez un premier projet pour préparer son dossier."
            action={
              <LinkButton href="/projets/nouveau" icon={<Plus className="h-5 w-5" />}>
                Créer un projet
              </LinkButton>
            }
          />
        </Card>
      )}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        {projects.map((p) => {
          const dossier = state.dossiers.find((d) => d.projectCode === p.code);
          if (!dossier) {
            return (
              <Card key={p.code} className="flex items-center gap-4 p-5 opacity-80">
                <ProductVisual kind={p.kind} className="h-16 w-16" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-ink-900">
                    {p.code} • {p.name}
                  </p>
                  <p className="text-sm text-ink-500">{p.formLabel}</p>
                  <p className="mt-2 text-sm text-ink-600">Dossier non initialisé : il le sera à l&apos;étape « Déposer & transférer » du parcours.</p>
                </div>
                {!p.archived && (
                  <Button variant="outline" onClick={() => dossierActions.initDossier(p.code)}>
                    Initialiser
                  </Button>
                )}
              </Card>
            );
          }
          const sections = allSections(dossier).map((x) => x.section);
          const missing = missingElements(state, dossier);
          const reviews = projectReviews(state, p.code);
          const transfer = state.transfers.find((t) => t.projectCode === p.code);
          const stats = [
            { label: "Sections en revue ou approuvées", value: `${sections.filter((x) => x.status === "En revue" || x.status === "Approuvée").length} / ${sections.length}` },
            { label: "Éléments manquants", value: String(missing.length) },
            { label: "Revues", value: String(reviews.length) },
          ];
          return (
            <Card key={p.code} className="p-5">
              <div className="flex items-start gap-4">
                <ProductVisual kind={p.kind} className="h-16 w-16" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-ink-900">Dossier {p.code}</p>
                  <p className="text-sm text-ink-500">
                    {p.name} • {p.dosage} • Formulation {dossier.formula}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.closedAt && <Badge>Projet clôturé</Badge>}
                    {transfer && <Badge tone={transfer.status === "Réceptionné" ? "success" : "info"}>Transfert : {transfer.status.toLowerCase()}</Badge>}
                  </div>
                </div>
                <FolderOpen className="h-7 w-7 text-brand-600" strokeWidth={1.6} aria-hidden />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-subtle p-3">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="text-xs text-ink-500">{s.label}</dt>
                    <dd className="text-lg font-bold text-ink-900">{s.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap gap-3">
                <LinkButton href={`/dossiers/${p.slug}`} icon={<FileText className="h-4 w-4" />} iconRight={<ArrowRight className="h-4 w-4" />}>
                  Ouvrir le dossier
                </LinkButton>
                <LinkButton href={`/dossiers/${p.slug}/revues`} variant="outline">
                  Revues
                </LinkButton>
              </div>
            </Card>
          );
        })}
      </div>
      <ScreenRef label="Dossiers & revues" />
    </>
  );
}
