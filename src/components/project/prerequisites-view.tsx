"use client";

import {
  CircleCheck,
  ClipboardList,
  Clock,
  FileText,
  FlaskConical,
  History,
  Link2,
  Box,
  Plus,
  Send,
  SquareCheck,
  TriangleAlert,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { DateInput, Field, Input, Segmented, Select, Textarea } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { RECIPIENTS, SUPPLIERS } from "@/lib/catalog";
import { DEMO_TODAY, addDays } from "@/lib/format";
import { findProject } from "@/lib/selectors";
import { actions, useDemo } from "@/lib/store";
import type { Prerequisite, PrerequisiteStatus, Project, RequestType, Tone } from "@/lib/types";
import { ProjectTabs } from "./project-frame";

const STATUS_STYLE: Record<PrerequisiteStatus, { tone: Tone; icon: LucideIcon }> = {
  Satisfait: { tone: "success", icon: CircleCheck },
  "En attente": { tone: "warn", icon: TriangleAlert },
  "À planifier": { tone: "neutral", icon: Clock },
  Demandé: { tone: "info", icon: Send },
};

const REQUEST_TYPES: { value: RequestType; label: string; icon: LucideIcon }[] = [
  { value: "Document", label: "Document", icon: FileText },
  { value: "Matière", label: "Matière", icon: FlaskConical },
  { value: "Réactif", label: "Réactif", icon: Box },
];

function RequestDrawer({
  project,
  prerequisite,
  prerequisites,
  open,
  onClose,
}: {
  project: Project;
  prerequisite?: Prerequisite;
  prerequisites: Prerequisite[];
  open: boolean;
  onClose: () => void;
}) {
  const [type, setType] = useState<RequestType>(prerequisite?.icon === "flask" ? "Matière" : "Document");
  const [object, setObject] = useState(prerequisite?.name ?? "");
  const [recipient, setRecipient] = useState(prerequisite ? (RECIPIENTS.includes(prerequisite.source) ? prerequisite.source : "R&D") : "");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(addDays(DEMO_TODAY, 4));
  const [justification, setJustification] = useState(prerequisite?.defaultJustification ?? "");
  const [linkedId, setLinkedId] = useState(prerequisite?.id ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [createdRef, setCreatedRef] = useState<string | null>(null);

  const errors = {
    object: !object.trim() ? "Renseignez l'objet de la demande." : null,
    recipient: !recipient ? "Choisissez un destinataire." : null,
    supplier: !supplier ? "Choisissez un fournisseur." : null,
    date: !date ? "Choisissez une date." : date < DEMO_TODAY ? "La date souhaitée ne peut pas être passée." : null,
    justification: !justification.trim() ? "Justifiez la demande." : null,
  };
  const show = (e: string | null) => (submitted ? e : null);
  const linked = prerequisites.find((p) => p.id === linkedId);

  const submit = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const ref = actions.createRequest({
      projectCode: project.code,
      type,
      object: object.trim(),
      recipient,
      supplier,
      wishedDate: date,
      justification: justification.trim(),
      prerequisiteId: linkedId || undefined,
    });
    setCreatedRef(ref);
    toast.show({ title: `Demande ${ref} créée`, description: `${object.trim()} — transmise à : ${recipient}.` });
  };

  const locked = Boolean(createdRef);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Créer une demande"
      subtitle="Demander un document, une matière ou un réactif."
      footer={
        locked ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Fermer
            </Button>
            <Button
              variant="outline"
              size="lg"
              icon={<Plus className="h-5 w-5" />}
              onClick={() => {
                setCreatedRef(null);
                setSubmitted(false);
                setObject("");
                setJustification("");
                setLinkedId("");
                setSupplier("");
              }}
            >
              Nouvelle demande
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={onClose}>
              Annuler
            </Button>
            <Button size="lg" onClick={submit}>
              Créer la demande
            </Button>
          </div>
        )
      }
    >
      <fieldset disabled={locked} className="space-y-5 disabled:opacity-80">
        <Field label="Type de demande">
          <Segmented label="Type de demande" options={REQUEST_TYPES} value={type} onChange={setType} />
        </Field>
        <Field label="Objet" required htmlFor="req-object" error={show(errors.object)}>
          <Input id="req-object" value={object} placeholder="Ex. Certificat GMP fournisseur" invalid={Boolean(show(errors.object))} onChange={(e) => setObject(e.target.value)} />
        </Field>
        <Field label="Destinataire interne" required htmlFor="req-recipient" error={show(errors.recipient)}>
          <Select id="req-recipient" placeholder="À sélectionner" options={RECIPIENTS} value={recipient} invalid={Boolean(show(errors.recipient))} onChange={(e) => setRecipient(e.target.value)} />
        </Field>
        <Field label="Fournisseur" required htmlFor="req-supplier" error={show(errors.supplier)}>
          <Select id="req-supplier" placeholder="À sélectionner" options={SUPPLIERS} value={supplier} invalid={Boolean(show(errors.supplier))} onChange={(e) => setSupplier(e.target.value)} />
        </Field>
        <Field label="Date souhaitée" required htmlFor="req-date" error={show(errors.date)}>
          <DateInput id="req-date" value={date} onChange={setDate} onClear={() => setDate("")} invalid={Boolean(show(errors.date))} />
        </Field>
        <Field label="Justification" required htmlFor="req-justification" error={show(errors.justification)}>
          <Textarea
            id="req-justification"
            rows={3}
            maxLength={500}
            value={justification}
            placeholder="Ex. Requis pour la revue de faisabilité."
            invalid={Boolean(show(errors.justification))}
            onChange={(e) => setJustification(e.target.value)}
          />
        </Field>
        {prerequisite ? null : (
          <Field label="Prérequis associé" htmlFor="req-linked" optional>
            <Select
              id="req-linked"
              placeholder="Aucun"
              options={prerequisites.filter((p) => p.status !== "Satisfait").map((p) => ({ value: p.id, label: p.name }))}
              value={linkedId}
              onChange={(e) => setLinkedId(e.target.value)}
            />
          </Field>
        )}
      </fieldset>

      {linked && (
        <div className="mt-5 flex gap-3 rounded-xl border border-brand-100 bg-brand-50/80 p-4">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-ink-700" aria-hidden />
          <div>
            <p className="font-semibold text-ink-900">Prérequis associé</p>
            <p className="font-semibold text-ink-900">{linked.name}</p>
            <p className="text-sm text-ink-600">
              Prérequis du projet {project.code} • {project.name}
            </p>
          </div>
        </div>
      )}

      {createdRef && (
        <div className="mt-5">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
            <CircleCheck className="h-8 w-8 shrink-0 fill-success-500 text-white" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold text-ink-900">
                Demande créée • <span className="text-success-600">À traiter</span>
              </p>
              <p className="text-sm text-ink-600">Référence interne : {createdRef}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-ink-500" aria-hidden />
          </div>
          {linked && <p className="mt-2 text-sm text-ink-600">La demande reste liée au prérequis et devra être traitée pour le satisfaire.</p>}
        </div>
      )}
    </Drawer>
  );
}

export function PrerequisitesView({ slug, openRequestFor }: { slug: string; openRequestFor?: string }) {
  const state = useDemo();
  const router = useRouter();
  const project = findProject(state, slug);
  const [drawer, setDrawer] = useState<{ open: boolean; prerequisiteId?: string; key: number }>({
    open: Boolean(openRequestFor),
    prerequisiteId: openRequestFor,
    key: 0,
  });

  if (!project) return null;
  const prerequisites = state.prerequisites.filter((p) => p.projectCode === project.code);
  const openDrawer = (prerequisiteId?: string) => setDrawer((d) => ({ open: true, prerequisiteId, key: d.key + 1 }));

  return (
    <>
      <ProjectTabs slug={slug} />

      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ClipboardList className="mt-0.5 h-8 w-8 text-ink-700" strokeWidth={1.6} aria-hidden />
            <div>
              <h2 className="text-2xl font-bold text-ink-900">Prérequis du projet</h2>
              <p className="text-[15px] text-ink-600">Documents et approbations nécessaires pour démarrer les essais et la revue.</p>
            </div>
          </div>
          <Button icon={<Plus className="h-5 w-5" />} onClick={() => openDrawer()}>
            Demander un document ou une matière
          </Button>
        </div>

        {prerequisites.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Aucun prérequis" description="Ajoutez une demande pour tracer les pièces nécessaires au projet." />
        ) : (
          <div className="relative mt-5 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[15px]">
              <thead>
                <tr className="rounded-lg bg-subtle text-sm text-ink-600">
                  <th className="rounded-l-lg px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Prérequis</th>
                  <th className="px-4 py-3 font-medium">Détail</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="rounded-r-lg px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {prerequisites.map((p) => {
                  const style = STATUS_STYLE[p.status];
                  const Icon = p.icon === "flask" ? FlaskConical : FileText;
                  const canView = p.status === "Satisfait";
                  return (
                    <tr key={p.id} className={p.blocking && p.status !== "Satisfait" ? "bg-brand-50/40" : undefined}>
                      <td className="px-4 py-3.5">
                        <Badge tone={style.tone} icon={style.icon} size="md">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-3 font-medium text-ink-900">
                          <Icon className="h-5 w-5 shrink-0 text-ink-600" strokeWidth={1.7} aria-hidden />
                          {p.name}
                          {p.blocking && p.status !== "Satisfait" && <Badge tone="danger">Bloquant</Badge>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-ink-600">
                        {p.detail}
                        {p.requestRef && <span className="mt-0.5 block text-brand-700">Demande {p.requestRef} à traiter</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-ink-700">{p.source}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          {canView ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-w-24"
                              onClick={() =>
                                p.documentId
                                  ? router.push(`/projets/${slug}/documents?doc=${p.documentId}`)
                                  : toast.show({ title: p.name, description: "Prérequis satisfait — aucun document rattaché dans la démonstration.", tone: "info" })
                              }
                            >
                              Voir
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" className="min-w-24" disabled={p.status === "Demandé"} onClick={() => openDrawer(p.id)}>
                              {p.status === "Demandé" ? "Demandé" : "Demander"}
                            </Button>
                          )}
                          <Menu
                            label={`Actions pour ${p.name}`}
                            items={[
                              ...(p.status !== "Satisfait"
                                ? [
                                    {
                                      label: "Marquer comme satisfait",
                                      icon: SquareCheck,
                                      onSelect: () => {
                                        actions.setPrerequisiteStatus(p.id, "Satisfait");
                                        toast.show({ title: "Prérequis satisfait", description: p.name });
                                      },
                                    },
                                  ]
                                : []),
                              { label: "Voir l'historique", icon: History, href: `/projets/${slug}/historique?objet=Pr%C3%A9requis&periode=tout` },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RequestDrawer
        key={drawer.key}
        project={project}
        prerequisite={prerequisites.find((p) => p.id === drawer.prerequisiteId)}
        prerequisites={prerequisites}
        open={drawer.open}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
      />
      <ScreenRef n={14} label="Demander un document ou une matière" />
    </>
  );
}
