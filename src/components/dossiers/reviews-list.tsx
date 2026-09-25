"use client";

import { CalendarDays, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScreenRef } from "@/components/ui/page";
import { REVIEW_STATUS_TONE, dossierComplete, projectReviews } from "@/lib/dossier-selectors";
import { formatNumeric } from "@/lib/format";
import { DossierHeader, DossierMissing, DossierTabs, projectCrumbs, useDossier } from "./dossier-frame";

export function ReviewsList({ slug }: { slug: string }) {
  const { state, project, dossier } = useDossier(slug);
  if (!project) return null;
  if (!dossier) return <DossierMissing slug={slug} />;
  const reviews = projectReviews(state, project.code);
  const complete = dossierComplete(state, dossier);
  const pending = reviews.some((r) => r.status === "En revue");
  const canPrepare = complete && !pending;

  const prepare = canPrepare ? (
    <LinkButton href={`/dossiers/${slug}/revues/nouvelle`} icon={<Users className="h-4 w-4" />}>
      Préparer une revue
    </LinkButton>
  ) : (
    <Button disabled variant="secondary" icon={<Users className="h-4 w-4" />}>
      Préparer une revue
    </Button>
  );

  return (
    <>
      <DossierHeader crumbs={[...projectCrumbs(project), { label: "Dossiers & revues", href: `/dossiers/${slug}` }, { label: "Revues" }]} title="Revues du dossier" meta={[project.name, project.dosage, dossier.formula]} />
      <DossierTabs slug={slug} />
      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-ink-900">Revues ({reviews.length})</h2>
          <div className="text-right">
            {prepare}
            {!canPrepare && (
              <p className="mt-1 text-sm text-ink-500">{pending ? "Une revue est déjà en cours." : "Disponible lorsque le dossier est complet."}</p>
            )}
          </div>
        </div>
        {reviews.length === 0 ? (
          <EmptyState icon={Users} title="Aucune revue" description="Préparez une revue du dossier une fois tous les éléments requis réunis." />
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {reviews.map((r) => (
              <li key={r.id}>
                <Link href={`/dossiers/${slug}/revues/${r.id.toLowerCase()}`} className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-subtle">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-bold text-ink-700">{r.id}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink-900">{r.type}</span>
                    <span className="flex items-center gap-2 text-sm text-ink-500">
                      <CalendarDays className="h-4 w-4" aria-hidden />
                      {formatNumeric(r.date)} • {r.participants.join(", ")}
                    </span>
                  </span>
                  <Badge tone={REVIEW_STATUS_TONE[r.status]} size="md">
                    {r.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-ink-500" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ScreenRef label="Revues du dossier" />
    </>
  );
}
