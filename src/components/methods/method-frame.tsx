"use client";

import { Archive, ArchiveRestore, ChevronRight, Copy, Download, FilePlus2, FlaskConical, FolderSearch, List } from "lucide-react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import type { ReactNode } from "react";
import { ACTIONS_TRIGGER_CLASS, MetaLine, actionsTrigger } from "@/components/project-context-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { Breadcrumb } from "@/components/ui/page";
import { LinkTabs } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { downloadText, formatDateTime, toCsv } from "@/lib/format";
import { getDemoState, labActions, useDemo } from "@/lib/store";
import { nextMethodRef } from "@/lib/lab";
import { methodContext, methodStatus } from "@/lib/lab-selectors";
import type { DemoState } from "@/lib/data";
import type { Method } from "@/lib/types";

export function findMethodBySlug(s: DemoState, slug: string) {
  return s.methods.find((m) => m.ref.toLowerCase() === slug.toLowerCase());
}

export function exportMethodHistory(s: DemoState, m: Method) {
  const events = s.history.filter((h) => h.methodRef === m.ref).sort((a, b) => b.at.localeCompare(a.at));
  const rows = [
    ["Date et heure", "Utilisateur", "Rôle", "Événement", "Objet / version", "Champ", "Ancienne valeur", "Nouvelle valeur", "Motif", "Description"],
    ...events.map((e) => [
      formatDateTime(e.at),
      e.author,
      e.authorRole ?? "",
      e.title,
      e.version?.label ?? e.objectLabel,
      e.field ?? "",
      e.oldValue ?? "",
      e.newValue ?? "",
      e.motif ?? "",
      e.description ?? "",
    ]),
  ];
  downloadText(`historique-${m.ref}.csv`, toCsv(rows), "text/csv");
  toast.show({ title: "Historique exporté", description: `historique-${m.ref}.csv — ${events.length} événement(s).` });
}

/** Header + tabs shared by the pages of a method (screens 23, 24, 25, 27, 28). */
export function MethodFrame({ slug, children }: { slug: string; children: ReactNode }) {
  const state = useDemo();
  const segments = useSelectedLayoutSegments();
  const method = findMethodBySlug(state, slug);

  if (!method) {
    return (
      <Card className="mt-4">
        <EmptyState
          icon={FolderSearch}
          title="Méthode introuvable"
          description={`Aucune méthode ne correspond à la référence « ${slug.toUpperCase()} ».`}
          action={<LinkButton href="/methodes">Retour au catalogue</LinkButton>}
        />
      </Card>
    );
  }

  // The result entry of an analysis has its own header (screen 26).
  if (segments[0] === "analyses") return <>{children}</>;

  const project = state.projects.find((p) => p.code === method.projectCode);
  const status = methodStatus(state, method);
  const ctx = methodContext(state, method);
  const base = `/methodes/${method.ref.toLowerCase()}`;

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Projets", href: "/projets" },
          { label: method.projectCode, href: project ? `/projets/${project.slug}` : undefined },
          { label: "Méthodes & essais", href: `/methodes?projet=${method.projectCode.toLowerCase()}` },
          { label: method.ref },
        ]}
      />
      {method.archived && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-slate-100 px-4 py-3 text-[15px] text-ink-700">
          <Archive className="h-5 w-5 text-ink-500" aria-hidden />
          <span className="flex-1">Cette méthode est archivée : elle reste consultable, son historique est conservé.</span>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-[32px] font-extrabold tracking-tight text-ink-900 sm:text-[34px]">
              {method.ref} <span className="text-ink-400">•</span> {method.name}
            </h1>
            <Badge tone="info" icon={FlaskConical} size="md" className="rounded-full px-3">
              {method.type}
            </Badge>
            <Badge tone={status.tone} dot size="md">
              {status.label}
            </Badge>
          </div>
          <MetaLine
            className="mt-1"
            items={[
              method.subtitle,
              <span key="p" className="font-semibold text-ink-800">
                {project ? `${project.code} • ${project.name}` : method.projectCode}
              </span>,
              ...(project ? [project.dosage] : []),
            ]}
          />
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          {project && (
            <Link
              href={`/projets/${project.slug}`}
              className="flex min-w-[270px] items-center gap-4 rounded-xl border border-line bg-white px-4 py-3 shadow-card hover:border-brand-200"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] text-ink-500">Projet</span>
                <span className="block font-bold text-ink-900">
                  {project.code} • {project.name}
                </span>
                <span className="block text-sm text-ink-600">
                  {[ctx.formula && `Formule ${ctx.formula}`, ctx.lotLabel].filter(Boolean).join("  |  ") || project.formLabel}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 text-ink-500" aria-hidden />
            </Link>
          )}
          <Menu
            label="Actions méthode"
            widthClass="w-72"
            triggerClassName={ACTIONS_TRIGGER_CLASS}
            trigger={actionsTrigger("Actions méthode")}
            items={[
              {
                label: "Créer une version",
                icon: FilePlus2,
                onSelect: () => {
                  labActions.newMethodVersion(method.ref);
                  toast.show({ title: `Nouvelle version de ${method.ref}`, description: `Version v${method.versions.length + 1} ouverte en brouillon.` });
                },
              },
              {
                label: "Dupliquer",
                icon: Copy,
                onSelect: () => {
                  const ref = nextMethodRef(getDemoState());
                  labActions.duplicateMethod(method.ref);
                  toast.show({ title: `Méthode ${ref} créée`, description: `Copie de ${method.ref}.`, action: { label: "Ouvrir", href: `/methodes/${ref.toLowerCase()}` } });
                },
              },
              { label: "Exporter l'historique (CSV)", icon: Download, onSelect: () => exportMethodHistory(getDemoState(), method) },
              { label: "Voir le catalogue", icon: List, href: `/methodes?projet=${method.projectCode.toLowerCase()}` },
              method.archived
                ? {
                    label: "Restaurer la méthode",
                    icon: ArchiveRestore,
                    separatorBefore: true,
                    onSelect: () => {
                      labActions.restoreMethod(method.ref);
                      toast.show({ title: `${method.ref} restaurée` });
                    },
                  }
                : {
                    label: "Archiver la méthode",
                    icon: Archive,
                    tone: "danger",
                    separatorBefore: true,
                    onSelect: () => {
                      labActions.archiveMethod(method.ref);
                      toast.show({ title: `${method.ref} archivée`, tone: "info" });
                    },
                  },
            ]}
          />
        </div>
      </div>
      <LinkTabs
        className="mt-5"
        items={[
          { href: base, label: "Référence" },
          { href: `${base}/protocole`, label: "Protocole" },
          { href: `${base}/essais`, label: "Essais" },
          { href: `${base}/validation`, label: "Validation" },
          { href: `${base}/historique`, label: "Historique" },
        ]}
      />
      {children}
    </>
  );
}
