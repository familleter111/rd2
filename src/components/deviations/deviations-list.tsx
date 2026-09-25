"use client";

import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { DEVIATION_TONE } from "@/components/lots/lot-deviations";
import { ProjectTabs } from "@/components/project/project-frame";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenRef } from "@/components/ui/page";
import { formatDateTime } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { useDemo } from "@/lib/store";

export function DeviationsList({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  if (!project) return null;
  const deviations = state.deviations.filter((d) => d.projectCode === project.code);
  const pilot = state.pilotLots.find((l) => l.projectCode === project.code);
  return (
    <>
      <ProjectTabs slug={slug} />
      <Card className="mt-5 p-5">
        <h2 className="text-xl font-bold text-ink-900">Déviations du projet</h2>
        {deviations.length === 0 ? (
          <EmptyState
            icon={TriangleAlert}
            title="Aucune déviation déclarée"
            description="Les déviations se déclarent pendant la fabrication d'un lot pilote."
            action={pilot ? <LinkButton href={`/projets/${slug}/lots/${pilot.lotCode.toLowerCase()}/deviations?declarer=1`}>Déclarer une déviation</LinkButton> : undefined}
          />
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {deviations.map((d) => (
              <li key={d.id}>
                <Link href={`/projets/${slug}/deviations/${d.id.toLowerCase()}`} className="group flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-subtle">
                  <TriangleAlert className="h-6 w-6 text-warn-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-ink-900">
                      {d.id} • {d.title}
                    </span>
                    <span className="block text-sm text-ink-500">
                      Lot {d.lotCode} — étape {d.step} • {formatDateTime(d.createdAt)}
                    </span>
                  </span>
                  <Badge tone={DEVIATION_TONE[d.status]} dot size="md">
                    {d.status}
                  </Badge>
                  <ChevronRight className="h-5 w-5 text-ink-500 group-hover:text-brand-700" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ScreenRef label="Déviations du projet" />
    </>
  );
}
