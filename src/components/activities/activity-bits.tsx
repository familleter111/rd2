"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { PEOPLE } from "@/lib/catalog";
import type { DemoState } from "@/lib/data";
import { PEOPLE_LAB } from "@/lib/data-lab";
import { DEMO_TODAY, daysBetween } from "@/lib/format";
import { activityState, lotConditions } from "@/lib/lab-selectors";
import { labActions } from "@/lib/store";
import type { Activity, ActivityState } from "@/lib/types";

export const STATE_LABEL: Record<ActivityState, string> = {
  "a-faire": "À faire",
  "en-cours": "En cours",
  "en-revue": "En revue",
  terminee: "Terminées",
};

/** Named people and roles an activity can be assigned to. */
export const ASSIGNEES: { name: string; role?: string }[] = [
  ...Object.values(PEOPLE_LAB).map((p) => ({ name: p.name, role: p.role })),
  ...PEOPLE.map((name) => ({ name })),
];

/** "aujourd'hui", "dans 2 jours", "en retard de 3 jours". */
export function dueLabel(due: string) {
  const n = daysBetween(DEMO_TODAY, due);
  if (n === 0) return "aujourd'hui";
  if (n > 0) return `dans ${n} jour${n > 1 ? "s" : ""}`;
  return `en retard de ${-n} jour${n < -1 ? "s" : ""}`;
}

export function isUrgent(a: Activity) {
  return Boolean(a.urgent) || a.status.tone === "danger" || (!a.done && a.due < DEMO_TODAY);
}

/** Reason why an activity cannot be closed yet (null when it can). */
export function completionBlocker(s: DemoState, a: Activity): string | null {
  if (a.done) return null;
  if (a.kind === "preparation-lot" && a.lotCode) {
    const missing = lotConditions(s, a.projectCode, a.lotCode).filter((c) => !c.done);
    if (!missing.length) return null;
    const reservation = missing.find((c) => c.key === "reservation");
    if (missing.length === 1 && reservation) return "Impossible de terminer : réservation du mélangeur en attente.";
    return `Impossible de terminer : ${missing.map((c) => c.title.toLowerCase()).join(", ")} en attente.`;
  }
  return null;
}

export function activityProgress(s: DemoState, a: Activity) {
  if (a.kind === "preparation-lot" && a.lotCode) {
    const steps = lotConditions(s, a.projectCode, a.lotCode);
    return { done: steps.filter((x) => x.done).length, total: steps.length };
  }
  const state = activityState(a);
  return { done: state === "terminee" ? 1 : 0, total: 1 };
}

export function ReassignModal({ activity, open, onClose }: { activity: Activity; open: boolean; onClose: () => void }) {
  const [owner, setOwner] = useState(activity.owner);
  const options = ASSIGNEES.some((p) => p.name === activity.owner) ? ASSIGNEES : [{ name: activity.owner, role: activity.ownerRole }, ...ASSIGNEES];
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Réaffecter l'activité"
      subtitle={activity.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={owner === activity.owner}
            onClick={() => {
              const person = options.find((p) => p.name === owner);
              labActions.reassignActivity(activity.id, owner, person?.role);
              toast.show({ title: "Activité réaffectée", description: `${activity.title} → ${owner}.` });
              onClose();
            }}
          >
            Réaffecter
          </Button>
        </>
      }
    >
      <Field label="Nouveau responsable" htmlFor="reassign-owner">
        <Select
          id="reassign-owner"
          options={options.map((p) => ({ value: p.name, label: p.role ? `${p.name} — ${p.role}` : p.name }))}
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
