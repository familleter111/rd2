"use client";

import { Archive, ArrowRight, ChevronDown, ChevronRight, Copy, FileText, GitFork, History, Info, Pill, Plus, Scale, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ProductVisual } from "@/components/product-visual";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/modal";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatLong, formatNumber, plural } from "@/lib/format";
import { findProject, projectFormulas, testsForFormula } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Formula, Project } from "@/lib/types";
import { CompositionTable, FormulaStatusBadge, TestStatusText } from "./formula-bits";
import { FormulaSubTabs, ProjectTabs } from "./project-frame";

function FormulaCard({
  formula,
  project,
  checked,
  onCheck,
  onDetails,
  onArchive,
}: {
  formula: Formula;
  project: Project;
  checked: boolean;
  onCheck: (v: boolean) => void;
  onDetails: () => void;
  onArchive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const base = `/projets/${project.slug}`;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex items-start gap-5">
          <div className="pt-1">
            <Checkbox checked={checked} onChange={onCheck} label={<span className="sr-only">Sélectionner {formula.code}</span>} />
          </div>
          <ProductVisual kind={project.kind} className="h-[132px] w-[140px]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-bold text-ink-900">{formula.code}</h3>
            <FormulaStatusBadge status={formula.status} />
          </div>
          <p className="mt-2 text-lg font-semibold text-ink-900">{formula.label}</p>
          <p className="text-[15px] text-ink-600">{formula.description}</p>
          {formula.parent && (
            <p className="mt-3 inline-flex flex-wrap items-center gap-3 rounded-lg bg-brand-50 px-3.5 py-2 text-sm text-brand-800">
              <GitFork className="h-4 w-4" aria-hidden />
              <span className="font-medium">Issue de {formula.parent}</span>
              <span className="h-4 w-px bg-brand-200" aria-hidden />
              <ArrowRight className="h-4 w-4" aria-hidden />
              {formula.code} est basée sur la version {formula.parent}
              <span title={`Les modifications de ${formula.code} sont décrites dans son motif de création.`}>
                <Info className="h-4 w-4 cursor-help" aria-hidden />
              </span>
            </p>
          )}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="mt-3 flex cursor-pointer items-center gap-2 font-semibold text-brand-700 hover:underline underline-offset-4"
          >
            <ChevronDown className={cn("h-5 w-5 transition-transform", open && "rotate-180")} aria-hidden />
            Aperçu composition
          </button>
          {open && (
            <div className="mt-3 max-w-xl rounded-xl border border-line p-3">
              {formula.composition.length ? <CompositionTable rows={formula.composition} /> : <p className="text-sm text-ink-500">Composition non renseignée.</p>}
            </div>
          )}
        </div>

        <dl className="grid shrink-0 grid-cols-1 gap-4 border-line text-[15px] sm:grid-cols-3 lg:w-56 lg:grid-cols-1 lg:border-l lg:pl-6">
          <div className="flex items-start gap-3">
            <Pill className="mt-0.5 h-6 w-6 text-ink-600" strokeWidth={1.6} aria-hidden />
            <div>
              <dt className="sr-only">Dosage</dt>
              <dd className="font-semibold text-ink-900">{project.dosage}</dd>
              <dd className="text-sm text-ink-500">{project.form}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-6 w-6 text-ink-600" strokeWidth={1.6} aria-hidden />
            <div>
              <dt className="text-sm text-ink-500">Créée le</dt>
              <dd className="text-ink-900">{formatLong(formula.createdAt)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <User className="mt-0.5 h-6 w-6 text-ink-600" strokeWidth={1.6} aria-hidden />
            <div>
              <dt className="text-sm text-ink-500">Créée par</dt>
              <dd className="text-ink-900">{formula.createdBy}</dd>
            </div>
          </div>
        </dl>

        <div className="flex shrink-0 items-start gap-2 border-line lg:border-l lg:pl-6">
          <Button variant="outline" size="lg" className="min-w-52 justify-between" iconRight={<ChevronRight className="h-5 w-5" />} onClick={onDetails}>
            Voir les détails
          </Button>
          <Menu
            label={`Actions pour ${formula.code}`}
            triggerClassName="h-12 w-12 border border-brand-300 bg-white text-brand-700"
            items={[
              { label: "Voir l'historique", icon: History, href: `${base}/historique?objet=Formule&periode=tout` },
              { label: "Dupliquer en nouvelle version", icon: Copy, href: `${base}/formules/nouvelle?parent=${formula.code}` },
              { label: "Archiver cette version", icon: Archive, tone: "danger", onSelect: onArchive },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}

function FormulaDrawer({ formula, project, onClose }: { formula: Formula | null; project: Project; onClose: () => void }) {
  const state = useDemo();
  const lots = formula ? state.lots.filter((l) => l.projectCode === project.code && l.formula === formula.code) : [];
  const tests = formula ? testsForFormula(state, project.code, formula.code) : [];
  return (
    <Drawer
      open={Boolean(formula)}
      onClose={onClose}
      title={formula ? `Formule ${formula.code}` : ""}
      subtitle={formula ? `${formula.label} — révision ${formula.revision}` : undefined}
      widthClass="max-w-[560px]"
      footer={
        formula && (
          <div className="flex justify-end gap-3">
            <LinkButton href={`/projets/${project.slug}/formules/nouvelle?parent=${formula.code}`} variant="outline" icon={<Copy className="h-4 w-4" />}>
              Dupliquer en nouvelle version
            </LinkButton>
            <LinkButton href={`/projets/${project.slug}/formules/comparaison`} icon={<Scale className="h-4 w-4" />}>
              Comparer
            </LinkButton>
          </div>
        )
      }
    >
      {formula && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <FormulaStatusBadge status={formula.status} />
            {formula.parent && <span className="text-sm text-ink-600">Basée sur {formula.parent}</span>}
          </div>
          {formula.motif && (
            <section>
              <h3 className="font-semibold text-ink-900">Motif de modification</h3>
              <p className="mt-1 rounded-lg bg-subtle p-3 text-[15px] text-ink-700">{formula.motif}</p>
            </section>
          )}
          <section>
            <h3 className="font-semibold text-ink-900">Composition (par unité)</h3>
            <div className="mt-2 rounded-xl border border-line p-3">
              {formula.composition.length ? <CompositionTable rows={formula.composition} /> : <p className="text-sm text-ink-500">Composition non renseignée.</p>}
            </div>
          </section>
          {formula.process.length > 0 && (
            <section>
              <h3 className="font-semibold text-ink-900">Procédé</h3>
              <ol className="mt-2 space-y-1.5 text-[15px] text-ink-700">
                {formula.process.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section>
            <h3 className="font-semibold text-ink-900">Lots liés</h3>
            {lots.length ? (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {lots.map((l) => (
                  <li key={l.id} className="flex items-center justify-between px-4 py-2.5 text-[15px]">
                    <Link href={`/projets/${project.slug}/formules/lots?lot=${l.code}`} className="font-semibold text-brand-700 hover:underline">
                      {l.code}
                    </Link>
                    <span className="text-ink-600">
                      {formatNumber(l.quantity)} {l.unit} — {l.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-ink-500">Aucun lot fabriqué avec cette formule.</p>
            )}
          </section>
          {tests.length > 0 && (
            <section>
              <h3 className="font-semibold text-ink-900">Derniers résultats d&apos;essais</h3>
              <ul className="mt-2 space-y-1.5">
                {tests.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-[15px]">
                    <span className="text-ink-800">{t.criterion}</span>
                    <TestStatusText status={t.status} short />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Drawer>
  );
}

export function FormulasView({ slug }: { slug: string }) {
  const state = useDemo();
  const project = findProject(state, slug);
  const formulas = project ? projectFormulas(state, project.code).sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true })) : [];
  const [selected, setSelected] = useState<string[]>(() => formulas.filter((f) => f.status !== "Brouillon").map((f) => f.code));
  const [detailId, setDetailId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Formula | null>(null);

  if (!project) return null;
  const selectedVisible = selected.filter((c) => formulas.some((f) => f.code === c));
  const latest = formulas[formulas.length - 1];

  return (
    <>
      <ProjectTabs slug={slug} />
      <FormulaSubTabs slug={slug} />

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <FileText className="mt-1 h-9 w-9 text-ink-700" strokeWidth={1.4} aria-hidden />
          <div>
            <h2 className="text-[28px] font-bold text-ink-900">Versions de formule</h2>
            <p className="text-[15px] text-ink-600">Historique des versions et composition des formules.</p>
          </div>
        </div>
        <LinkButton href={`/projets/${slug}/formules/nouvelle${latest ? `?parent=${latest.code}` : ""}`} size="lg" icon={<Plus className="h-5 w-5" />} guide={slug === "cs-01" ? 18 : undefined}>
          Nouvelle version
        </LinkButton>
      </div>

      <div className="mt-5 space-y-4">
        {formulas.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title="Aucune formule pour ce projet"
              description="Créez la première version de formule pour démarrer les essais."
              action={
                <LinkButton href={`/projets/${slug}/formules/nouvelle`} icon={<Plus className="h-4 w-4" />}>
                  Créer la première version
                </LinkButton>
              }
            />
          </Card>
        ) : (
          formulas.map((f) => (
            <FormulaCard
              key={f.id}
              formula={f}
              project={project}
              checked={selected.includes(f.code)}
              onCheck={(v) => setSelected((l) => (v ? [...l, f.code] : l.filter((c) => c !== f.code)))}
              onDetails={() => setDetailId(f.id)}
              onArchive={() => setArchiveTarget(f)}
            />
          ))
        )}
      </div>

      {formulas.length > 1 && (
        <div className="sticky bottom-4 z-10 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/95 px-5 py-3 shadow-pop backdrop-blur">
          <Checkbox
            checked={selectedVisible.length === formulas.length}
            onChange={(v) => setSelected(v ? formulas.map((f) => f.code) : [])}
            label={
              <span className="text-[15px] text-ink-800">
                <strong>{selectedVisible.length}</strong> {plural(selectedVisible.length, "version sélectionnée", "versions sélectionnées")}
              </span>
            }
          />
          {selectedVisible.length >= 2 ? (
            <LinkButton
              href={`/projets/${slug}/formules/comparaison?versions=${selectedVisible.join(",")}`}
              size="lg"
              icon={<Scale className="h-5 w-5" />}
            >
              Comparer {selectedVisible.length} versions
            </LinkButton>
          ) : (
            <Button size="lg" disabled icon={<Scale className="h-5 w-5" />}>
              Sélectionnez au moins 2 versions
            </Button>
          )}
        </div>
      )}

      <FormulaDrawer formula={state.formulas.find((f) => f.id === detailId) ?? null} project={project} onClose={() => setDetailId(null)} />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        title={`Archiver la version ${archiveTarget?.code ?? ""} ?`}
        message="La version ne sera plus proposée pour les nouveaux lots et comparaisons. Son historique et ses résultats restent consultables."
        confirmLabel="Archiver"
        danger
        onConfirm={() => {
          if (!archiveTarget) return;
          actions.archiveFormula(archiveTarget.id);
          setSelected((l) => l.filter((c) => c !== archiveTarget.code));
          toast.show({ title: `Formule ${archiveTarget.code} archivée`, description: "L'archivage est tracé dans l'historique du projet." });
        }}
      />
      <ScreenRef n={17} label="Versions de formule" />
    </>
  );
}
