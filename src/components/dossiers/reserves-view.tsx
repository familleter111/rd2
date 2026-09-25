"use client";

import { ClipboardCheck, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { formatNumeric, relativeDue } from "@/lib/format";
import { dossierActions } from "@/lib/store";
import type { Reserve } from "@/lib/types";
import { DossierHeader, DossierMissing, DossierTabs, projectCrumbs, useDossier } from "./dossier-frame";

/** Lifts a reserve with the justification of its treatment. */
export function LiftReserveModal({ reserve, onClose }: { reserve: Reserve | null; onClose: () => void }) {
  const [comment, setComment] = useState("");
  const [attempted, setAttempted] = useState(false);
  const error = comment.trim().length < 10 ? "Décrivez le traitement de la réserve (10 caractères minimum)." : null;
  return (
    <Modal
      open={Boolean(reserve)}
      onClose={onClose}
      title={`Lever la réserve ${reserve?.id ?? ""}`}
      subtitle={reserve?.description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              setAttempted(true);
              if (!reserve || error) return;
              dossierActions.liftReserve(reserve.id, comment.trim());
              toast.show({ title: `Réserve ${reserve.id} levée`, description: reserve.description });
              onClose();
            }}
          >
            Lever la réserve
          </Button>
        </>
      }
    >
      <Field label="Traitement de la réserve" required htmlFor="lift-comment" error={attempted ? error : null}>
        <Textarea
          id="lift-comment"
          data-autofocus
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ex. Version approuvée de la synthèse jointe au dossier."
        />
      </Field>
    </Modal>
  );
}

export function ReservesView({ slug }: { slug: string }) {
  const { state, project, dossier } = useDossier(slug);
  const [lifting, setLifting] = useState<Reserve | null>(null);
  if (!project) return null;
  if (!dossier) return <DossierMissing slug={slug} />;
  const reserves = state.reserves.filter((r) => r.projectCode === project.code);
  const blockingOpen = reserves.filter((r) => r.blocking && r.status === "Ouverte");

  return (
    <>
      <DossierHeader crumbs={[...projectCrumbs(project), { label: "Dossiers & revues", href: `/dossiers/${slug}` }, { label: "Réserves" }]} title="Réserves du dossier" meta={[project.name, project.dosage, dossier.formula]} />
      <DossierTabs slug={slug} />
      {blockingOpen.length > 0 && (
        <p className="mt-5 flex items-center gap-3 rounded-xl border border-warn-200 bg-warn-50 px-4 py-3 text-[15px] font-medium text-warn-700">
          <ShieldAlert className="h-5 w-5" aria-hidden />
          Le transfert reste bloqué tant que les réserves bloquantes sont ouvertes ({blockingOpen.length}).
        </p>
      )}
      <Card className="mt-5 p-5">
        {reserves.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Aucune réserve"
            description="Les réserves sont créées lors de la décision d'une revue de dossier (« Approuver avec réserves »)."
            action={<LinkButton href={`/dossiers/${slug}/revues`}>Voir les revues</LinkButton>}
          />
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="bg-subtle text-[13px] text-ink-700">
                  <th className="px-4 py-3 font-medium">Réserve</th>
                  <th className="px-3 py-3 font-medium">Revue</th>
                  <th className="px-3 py-3 font-medium">Responsable</th>
                  <th className="px-3 py-3 font-medium">Échéance</th>
                  <th className="px-3 py-3 font-medium">Statut</th>
                  <th className="px-3 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {reserves.map((r) => (
                  <tr key={r.id} className="border-t border-line/70 align-top">
                    <td className="px-4 py-3">
                      <span className="flex items-start gap-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-ink-700">{r.id}</span>
                        <span>
                          <span className="block font-semibold text-ink-900">{r.description}</span>
                          {r.blocking && <Badge tone="danger">Bloquante pour le transfert</Badge>}
                          {r.liftComment && <span className="mt-1 block text-ink-600">Traitement : {r.liftComment}</span>}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink-800">{r.reviewId}</td>
                    <td className="px-3 py-3 text-ink-800">{r.owner}</td>
                    <td className="px-3 py-3 text-ink-800">
                      {formatNumeric(r.due)}
                      {r.status === "Ouverte" && <span className="block text-xs text-ink-500">{relativeDue(r.due)}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={r.status === "Levée" ? "success" : "warn"} size="md">
                        {r.status}
                        {r.liftedAt && ` le ${formatNumeric(r.liftedAt)}`}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {r.status === "Ouverte" && (
                        <Button size="sm" variant="outline" onClick={() => setLifting(r)}>
                          Lever la réserve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <LiftReserveModal key={lifting?.id} reserve={lifting} onClose={() => setLifting(null)} />
      <ScreenRef label="Réserves du dossier" />
    </>
  );
}
