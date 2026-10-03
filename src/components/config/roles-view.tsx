"use client";

import { ChevronRight, Factory, FlaskConical, Info, Plus, Save, ShieldCheck, TriangleAlert, User, Users, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Toggle } from "@/components/ui/field";
import { Menu } from "@/components/ui/menu";
import { ScreenRef } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { DIRECTORY } from "@/lib/data-dossier";
import { formatDateTime } from "@/lib/format";
import { dossierActions, useDemo } from "@/lib/store";
import type { RolePermission, TeamRole } from "@/lib/types";
import { ConfigFrame } from "./config-frame";

const ROLE_ICONS: Record<TeamRole["icon"], LucideIcon> = {
  user: User,
  users: Users,
  flask: FlaskConical,
  shield: ShieldCheck,
  factory: Factory,
};

const initials = (name: string) =>
  name
    .replace(/^Dr\.\s*/, "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Blank workspace: the client types the members of the team (name and function). */
function AddMemberForm({ role }: { role: TeamRole }) {
  const [name, setName] = useState("");
  const [job, setJob] = useState("");
  const trimmed = name.trim();
  const duplicate = role.members.some((m) => m.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!trimmed || duplicate) return;
        dossierActions.addRoleMember(role.id, { name: trimmed, role: job.trim() || role.name });
        toast.show({ title: "Membre ajouté", description: `${trimmed} → ${role.name}` });
        setName("");
        setJob("");
      }}
    >
      <label className="min-w-48 flex-1 text-sm font-semibold text-ink-800">
        Nom et prénom
        <Input className="mt-1 font-normal" placeholder="Ex. Nom Prénom" value={name} invalid={duplicate} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="min-w-48 flex-1 text-sm font-semibold text-ink-800">
        Fonction <span className="font-normal text-ink-500">(optionnel)</span>
        <Input className="mt-1 font-normal" placeholder={role.name} value={job} onChange={(e) => setJob(e.target.value)} />
      </label>
      <Button type="submit" variant="outline" icon={<Plus className="h-5 w-5" />} disabled={!trimmed || duplicate}>
        Ajouter un membre
      </Button>
      {duplicate && <p className="w-full text-sm text-danger-600">Ce membre est déjà affecté à ce rôle.</p>}
    </form>
  );
}

function RoleDetail({ role }: { role: TeamRole }) {
  const state = useDemo();
  const [permissions, setPermissions] = useState<RolePermission[]>(role.permissions);
  const [scope, setScope] = useState<TeamRole["scope"]>(role.scope);
  const dirty = scope !== role.scope || permissions.some((p, i) => p.enabled !== role.permissions[i]?.enabled);
  const available = DIRECTORY.filter((p) => !role.members.some((m) => m.name === p.name));
  const ownApproval = permissions.find((p) => p.key === "approuverPropres")?.enabled;
  const last = state.configLog[0];

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-2xl font-bold text-ink-900">{role.name}</h2>
      <p className="mt-1 text-[15px] text-ink-600">{role.description}</p>

      <h3 className="mt-5 border-t border-line pt-4 text-lg font-bold text-ink-900">Droits et permissions</h3>
      <ul className="mt-3 space-y-3">
        {permissions.map((p) => (
          <li key={p.key} className="flex items-center gap-4">
            <Toggle checked={p.enabled} label={p.label} onChange={(v) => setPermissions((l) => l.map((x) => (x.key === p.key ? { ...x, enabled: v } : x)))} />
            <span className="flex-1 text-[15px] text-ink-900">{p.label}</span>
            <span title={p.detail} className="cursor-help text-ink-400">
              <Info className="h-5 w-5" aria-label={p.detail} />
            </span>
          </li>
        ))}
      </ul>
      {ownApproval && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-warn-50 px-3 py-2.5 text-sm text-warn-700">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Déconseillé : un résultat doit être approuvé par une autre personne que celle qui l&apos;a saisi (principe des quatre yeux).
        </p>
      )}

      <h3 className="mt-6 text-lg font-bold text-ink-900">Périmètre d&apos;accès</h3>
      <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-line p-4">
        <Users className="h-7 w-7 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-900">{scope}</p>
          <p className="text-sm text-ink-600">
            {scope === "Projets assignés" ? "Accès aux projets pour lesquels le membre est affecté." : "Accès en lecture à tous les projets de l'espace R&D."}
          </p>
        </div>
        <Select aria-label="Périmètre d'accès" className="w-52" options={["Projets assignés", "Tous les projets"]} value={scope} onChange={(e) => setScope(e.target.value as TeamRole["scope"])} />
      </div>

      <h3 className="mt-6 text-lg font-bold text-ink-900">Membres de ce rôle</h3>
      <div className="mt-2 rounded-xl border border-line bg-subtle p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Users className="h-7 w-7 shrink-0 text-ink-700" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink-900">{role.name}</p>
            <p className="text-sm text-ink-600">Membres affectés à ce rôle dans l&apos;organisation.</p>
          </div>
          {state.demo && <Menu
            label="Ajouter un membre"
            widthClass="w-72"
            triggerClassName="inline-flex h-11 items-center gap-2 rounded-lg border border-brand-300 bg-white px-4 font-semibold text-brand-700 hover:bg-brand-50"
            trigger={
              <>
                <Plus className="h-5 w-5" aria-hidden />
                Ajouter un membre
              </>
            }
            items={
              available.length
                ? available.map((p) => ({
                    label: p.name,
                    description: p.role,
                    icon: User,
                    onSelect: () => {
                      dossierActions.addRoleMember(role.id, p);
                      toast.show({ title: "Membre ajouté", description: `${p.name} → ${role.name}` });
                    },
                  }))
                : [{ label: "Tous les membres sont déjà affectés", disabled: true }]
            }
          />}
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {role.members.map((m) => (
            <li key={m.name} className="flex items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{initials(m.name)}</span>
              <span className="text-sm">
                <span className="font-medium text-ink-900">{m.name}</span>
                <span className="text-ink-500"> — {m.role}</span>
              </span>
              <button
                type="button"
                aria-label={`Retirer ${m.name} du rôle`}
                onClick={() => {
                  dossierActions.removeRoleMember(role.id, m.name);
                  toast.show({ title: "Membre retiré", description: `${m.name} — ${role.name}`, tone: "info" });
                }}
                className="cursor-pointer rounded-full p-0.5 text-ink-400 hover:bg-slate-100 hover:text-danger-600"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {role.members.length === 0 && <li className="text-sm text-ink-500">Aucun membre.</li>}
        </ul>
        {!state.demo && <AddMemberForm role={role} />}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          size="lg"
          disabled={!dirty}
          onClick={() => {
            setPermissions(role.permissions);
            setScope(role.scope);
          }}
        >
          Annuler
        </Button>
        <Button
          size="lg"
          icon={<Save className="h-5 w-5" />}
          disabled={!dirty}
          onClick={() => {
            dossierActions.saveRole(role.id, { permissions, scope });
            toast.show({ title: "Droits enregistrés", description: `Rôle « ${role.name} » mis à jour.` });
          }}
        >
          Enregistrer les droits
        </Button>
      </div>
      <p className="mt-4 flex items-center gap-2 rounded-lg border border-brand-100 bg-brand-50/70 px-4 py-3 text-sm text-ink-700">
        <Info className="h-4 w-4 shrink-0 text-brand-600" aria-hidden />
        Les modifications sont tracées dans l&apos;historique.
        {last && (
          <span className="text-ink-500">
            Dernière : {last.text} ({formatDateTime(last.at)})
          </span>
        )}
      </p>
    </Card>
  );
}

export function RolesView() {
  const state = useDemo();
  const [selectedId, setSelectedId] = useState("analyste");
  const role = state.roles.find((r) => r.id === selectedId) ?? state.roles[0];

  return (
    <ConfigFrame title="Configuration" subtitle="Gérer les rôles, les accès et les paramètres de l'espace R&D." screen={<ScreenRef n={54} label="Configuration — rôles et accès" />}>
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card className="h-fit p-5">
          <h2 className="text-xl font-bold text-ink-900">Rôles de l&apos;équipe</h2>
          <p className="mt-1 text-[15px] text-ink-600">Sélectionnez un rôle pour gérer ses droits et ses membres.</p>
          <ul className="mt-4 space-y-3">
            {state.roles.map((r) => {
              const Icon = ROLE_ICONS[r.icon];
              const active = r.id === role.id;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(r.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-4 rounded-xl border px-4 py-4 text-left transition-colors",
                      active ? "border-brand-400 bg-brand-50 ring-1 ring-brand-300" : "border-line hover:bg-subtle",
                    )}
                  >
                    <Icon className={cn("h-8 w-8 shrink-0", active ? "text-brand-700" : "text-ink-800")} strokeWidth={1.5} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold text-ink-900">{r.name}</span>
                      <span className="block text-sm text-ink-600">{r.description}</span>
                    </span>
                    <ChevronRight className={cn("h-5 w-5", active ? "text-brand-700" : "text-ink-500")} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <RoleDetail key={`${role.id}-${role.permissions.map((p) => p.enabled).join()}-${role.scope}`} role={role} />
      </div>
    </ConfigFrame>
  );
}
