"use client";

import { Archive, ArchiveRestore, ChevronRight, CircleAlert, CircleCheck, Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MetaLine } from "@/components/project-context-header";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { closureChecks } from "@/lib/dossier-selectors";
import { formatNumeric } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { dossierActions, useDemo } from "@/lib/store";

const EXAMPLE_REASON = "Parcours de développement terminé et transfert réceptionné.";

export function ProjectClosure({ slug, confirm }: { slug: string; confirm: boolean }) {
  const state = useDemo();
  const router = useRouter();
  const project = findProject(state, slug);
  const checks = project ? closureChecks(state, project.code) : [];
  const ready = checks.length > 0 && checks.every((c) => c.ok);
  const [open, setOpen] = useState(confirm && ready);
  const [reason, setReason] = useState(confirm ? EXAMPLE_REASON : "");
  const [confirmed, setConfirmed] = useState(confirm);
  const [attempted, setAttempted] = useState(false);

  if (!project) return null;

  const formula = state.dossiers.find((d) => d.projectCode === project.code)?.formula ?? state.formulaDecisions.find((d) => d.projectCode === project.code)?.formula;
  const blockers = checks.filter((c) => !c.ok);
  const reasonError = reason.trim().length < 10 ? "Indiquez le motif de clôture (10 caractères minimum)." : null;

  const close = () => {
    setAttempted(true);
    if (reasonError || !confirmed || !ready) return;
    dossierActions.closeProject(project.code, reason.trim());
    toast.show({
      title: `${project.code} clôturé et archivé`,
      description: "Le projet est consultable en lecture seule dans Projets > Archivés.",
      action: { label: "Voir les projets archivés", href: "/projets?vue=archives" },
    });
    setOpen(false);
    router.push("/projets?vue=archives");
  };

  return (
    <>
      <div className="mt-3">
        <h1 className="text-[34px] font-extrabold leading-tight tracking-tight text-ink-900 sm:text-[38px]">
          {project.code} • Clôture du projet
        </h1>
        <MetaLine className="mt-1" items={[project.name, project.dosage, ...(formula ? [formula] : [])]} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {checks.map((c) => (
          <Card key={c.key} className={cn("flex gap-4 p-5", c.ok ? "bg-success-50/40" : "bg-warn-50/40")}>
            {c.ok ? (
              <CircleCheck className="h-12 w-12 shrink-0 fill-success-500 text-white" aria-hidden />
            ) : (
              <CircleAlert className="h-12 w-12 shrink-0 fill-warn-500 text-white" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="font-bold text-ink-900">{c.title}</p>
              <p className="mt-1 text-2xl font-bold text-ink-900">{c.value}</p>
              {c.ok ? (
                <p className="mt-1 text-sm text-ink-700">{c.okText}</p>
              ) : (
                <Link href={c.href} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-warn-700 hover:underline">
                  {c.blockers.length} point{c.blockers.length > 1 ? "s" : ""} à traiter
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-4 rounded-xl border border-brand-100 bg-brand-50/70 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
          <Info className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-bold text-ink-900">Historique et documents conservés en lecture seule</p>
          <p className="text-[15px] text-ink-700">
            Après clôture, le projet sera déplacé dans <strong>Projets &gt; Archivés</strong>. Toutes les informations (décisions, essais, documents, historique) resteront
            disponibles en lecture seule.
          </p>
        </div>
      </div>

      {project.closedAt ? (
        <Card className="mt-5 flex flex-wrap items-center gap-4 p-5">
          <Archive className="h-8 w-8 text-ink-600" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink-900">Projet clôturé le {formatNumeric(project.closedAt)}</p>
            <p className="text-sm text-ink-600">Motif : {project.closeReason}</p>
          </div>
          <LinkButton href="/projets?vue=archives" variant="outline" icon={<ArchiveRestore className="h-4 w-4" />}>
            Voir les projets archivés
          </LinkButton>
        </Card>
      ) : (
        <>
          {blockers.length > 0 && (
            <Card className="mt-5 p-5">
              <h2 className="text-lg font-bold text-ink-900">Points à traiter avant la clôture</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {blockers.map((c) => (
                  <div key={c.key} className="rounded-xl border border-line p-4">
                    <p className="font-semibold text-ink-900">{c.title}</p>
                    <ul className="mt-2 list-disc pl-5 text-sm text-ink-700">
                      {c.blockers.slice(0, 5).map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                      {c.blockers.length > 5 && <li>et {c.blockers.length - 5} autre(s)</li>}
                    </ul>
                    <LinkButton href={c.href} variant="outline" size="sm" className="mt-3">
                      Traiter
                    </LinkButton>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            {!ready && <p className="text-sm text-ink-500">La clôture est disponible lorsque les quatre conditions sont remplies.</p>}
            <Button size="lg" icon={<Archive className="h-5 w-5" />} disabled={!ready} onClick={() => setOpen(true)} className="disabled:bg-slate-300">
              Clôturer le projet
            </Button>
          </div>
        </>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          <span className="flex items-center gap-3">
            <Archive className="h-8 w-8 text-brand-600" strokeWidth={1.5} aria-hidden />
            Clôturer et archiver le projet ?
          </span>
        }
        footer={
          <>
            <Button variant="outline" size="lg" className="min-w-40" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button size="lg" icon={<Archive className="h-5 w-5" />} onClick={close} disabled={attempted && (Boolean(reasonError) || !confirmed)} className="min-w-52">
              Clôturer et archiver
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-ink-700">
          Cette action clôture le projet{" "}
          <strong>
            {project.code} • {project.name}
          </strong>{" "}
          ({project.dosage}
          {formula ? `, ${formula}` : ""}) et le déplace dans <strong>Projets &gt; Archivés</strong>. Le projet restera accessible en lecture seule. Aucune donnée ne sera
          supprimée.
        </p>
        <Field label="Motif de clôture" required htmlFor="close-reason" className="mt-5" error={attempted ? reasonError : null}>
          <Textarea id="close-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} invalid={attempted && Boolean(reasonError)} />
        </Field>
        <Checkbox className="mt-4" checked={confirmed} onChange={setConfirmed} label="Je confirme que les activités de suivi sont terminées ou reprises dans un autre périmètre." />
        {attempted && !confirmed && (
          <p className="mt-1 text-sm text-danger-600" role="alert">
            Confirmez la reprise des activités de suivi.
          </p>
        )}
        <p className="mt-4 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-4 text-sm">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />
          <span>
            <span className="block font-semibold text-ink-900">Le projet sera accessible depuis Projets &gt; Archivés.</span>
            <span className="text-ink-600">Vous pourrez consulter l&apos;ensemble des informations en lecture seule.</span>
          </span>
        </p>
      </Modal>
      <ScreenRef n={project.code === "CS-01" ? 56 : undefined} label="Clôture et archivage du projet" />
    </>
  );
}
