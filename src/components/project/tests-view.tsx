"use client";

import { FileText, FlaskConical, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { ScreenRef } from "@/components/ui/page";
import { formatShort, plural } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { useDemo } from "@/lib/store";
import { CRITERION_ICONS, TestStatusText } from "./formula-bits";
import { ProjectTabs } from "./project-frame";

export function TestsView({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const [formula, setFormula] = useState("Toutes");
  if (!project) return null;

  const tests = state.tests.filter((t) => t.projectCode === project.code && t.lotCode !== "REF");
  const formulas = [...new Set(tests.map((t) => t.formula))];
  const visible = tests.filter((t) => formula === "Toutes" || t.formula === formula);
  const lots = [...new Set(visible.map((t) => t.lotCode))];
  const requests = state.analysisRequests.filter((r) => r.projectCode === project.code);

  return (
    <>
      <ProjectTabs
        slug={slug}
        actions={
          <LinkButton href={`/methodes?onglet=demandes&nouvelle=1&projet=${project.code}`} size="lg" icon={<Plus className="h-5 w-5" />}>
            Demander une analyse
          </LinkButton>
        }
      />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-ink-600">
          {visible.length} {plural(visible.length, "essai")} sur {lots.length} {plural(lots.length, "lot")} — {requests.length} {plural(requests.length, "demande")} d&apos;analyse
        </p>
        <Select aria-label="Filtrer par formule" options={["Toutes", ...formulas]} value={formula} onChange={(e) => setFormula(e.target.value)} className="w-52" />
      </div>

      {lots.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={FlaskConical}
            title="Aucun essai"
            description="Les essais apparaissent ici dès que des analyses sont demandées sur un lot (onglet « Analyses liées » du lot)."
            action={
              <LinkButton href={`/projets/${slug}/formules/lots`} variant="outline">
                Ouvrir les lots du projet
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="mt-4 space-y-5">
          {lots.map((lotCode) => {
            const lotTests = visible.filter((t) => t.lotCode === lotCode);
            const lot = state.lots.find((l) => l.projectCode === project.code && l.code === lotCode);
            return (
              <Card key={lotCode} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-ink-900">
                    Lot {lotCode} <span className="font-normal text-ink-500">— formule {lotTests[0]?.formula}</span>
                  </h2>
                  <Link href={`/projets/${slug}/formules/lots?lot=${lotCode}`} className="text-sm font-semibold text-brand-700 hover:underline">
                    Voir le lot{lot ? ` (${lot.status.toLowerCase()})` : ""}
                  </Link>
                </div>
                <div className="relative mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[15px]">
                    <thead>
                      <tr className="bg-subtle text-sm text-ink-700">
                        <th className="rounded-l-lg px-4 py-2.5 font-semibold">Critère</th>
                        <th className="px-4 py-2.5 font-semibold">Méthode</th>
                        <th className="px-4 py-2.5 font-semibold">Résultat</th>
                        <th className="px-4 py-2.5 font-semibold">Date</th>
                        <th className="rounded-r-lg px-4 py-2.5 font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {lotTests.map((t) => {
                        const Icon = CRITERION_ICONS[t.criterion] ?? FileText;
                        return (
                          <tr key={t.id}>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-3 font-medium text-ink-900">
                                <Icon className="h-5 w-5 text-ink-500" strokeWidth={1.6} aria-hidden />
                                {t.criterion}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {t.method ? (
                                <Link href={`/methodes/${t.method.toLowerCase()}`} className="text-brand-700 hover:underline">
                                  {t.method}
                                </Link>
                              ) : (
                                <span className="text-ink-500">Contrôle direct</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-ink-800">{t.result ?? "—"}</td>
                            <td className="px-4 py-3 text-ink-700">{t.date ? formatShort(t.date) : "—"}</td>
                            <td className="px-4 py-3">
                              <TestStatusText status={t.status} short />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ScreenRef label="Essais du projet (écran complémentaire)" />
    </>
  );
}
