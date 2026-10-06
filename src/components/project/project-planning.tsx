"use client";

import { CalendarDays, ChevronLeft, ChevronRight, MousePointerClick } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ConflictModal, ResourceTimeline, TimelineLegend, type SlotRequest } from "@/components/planning/planning-bits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateInput } from "@/components/ui/field";
import { ScreenRef } from "@/components/ui/page";
import { addDays, formatWeekday, fromMinutes, toMinutes } from "@/lib/format";
import { DAY_END, findConflicts } from "@/lib/lab-selectors";
import { findProject } from "@/lib/selectors";
import { useDemo } from "@/lib/store";
import { ProjectTabs } from "./project-frame";

const EQUIPMENT_ORDER = ["HPLC-01", "HPLC-02", "UV-01", "BAL-01", "ETU-01", "RFG-01", "DIS-01", "FRI-01", "MEL-01"];

/** Project tab "Planning" — day view of the equipment; a click on a free hour requests a 2-hour booking. */
export function ProjectPlanningView({ slug, initialDay, request }: { slug: string; initialDay: string; request?: SlotRequest }) {
  const state = useDemo();
  const router = useRouter();
  const pathname = usePathname();
  const project = findProject(state, slug);
  const [day, setDay] = useState(initialDay);
  const [pending, setPending] = useState<SlotRequest | null>(request && findConflicts(state, request.resourceId, request.date, request.start, request.end).length ? request : null);
  const [key, setKey] = useState(0);
  if (!project) return null;

  const equipment = state.resources
    .filter((r) => r.category === "Équipement")
    .sort((a, b) => (EQUIPMENT_ORDER.indexOf(a.id) + 1 || 99) - (EQUIPMENT_ORDER.indexOf(b.id) + 1 || 99) || a.id.localeCompare(b.id));

  const toForm = (req: SlotRequest) => {
    const params = new URLSearchParams({ ressource: req.resourceId, date: req.date, debut: req.start, fin: req.end, projet: project.code });
    router.push(`/planning/reservation?${params.toString()}`);
  };

  const requestSlot = (resourceId: string, hour: string) => {
    const end = fromMinutes(Math.min(toMinutes(hour) + 120, DAY_END));
    const req: SlotRequest = { resourceId, date: day, start: hour, end, method: resourceId.startsWith("HPLC") ? "M-01" : undefined };
    if (findConflicts(state, resourceId, day, hour, end).length) {
      setKey((k) => k + 1);
      setPending(req);
    } else toForm(req);
  };

  return (
    <>
      <ProjectTabs slug={slug} />
      <Card className="mt-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-lg font-bold text-ink-900">Planning des équipements</h2>
          <Button variant="secondary" aria-label="Jour précédent" onClick={() => setDay(addDays(day, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-3 font-semibold text-ink-900">
            <CalendarDays className="h-5 w-5 text-ink-600" aria-hidden />
            {formatWeekday(day)}
          </span>
          <Button variant="secondary" aria-label="Jour suivant" onClick={() => setDay(addDays(day, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <DateInput value={day} onChange={(v) => v && setDay(v)} className="w-48" />
        </div>
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-600">
          <MousePointerClick className="h-4 w-4 text-ink-500" aria-hidden />
          Cliquez sur une heure libre d&apos;un équipement pour demander un créneau de 2 h.
        </p>
        <div className="mt-3">
          <ResourceTimeline resources={equipment} date={day} onSlot={requestSlot} compact />
        </div>
        <TimelineLegend />
      </Card>
      {pending && (
        <ConflictModal
          key={`c-${key}`}
          request={pending}
          open
          onClose={() => {
            setPending(null);
            if (request) router.replace(`${pathname}?jour=${day}`, { scroll: false });
          }}
          onUse={(slot) => toForm(slot)}
        />
      )}
      <ScreenRef n={34} label="Conflit de réservation" />
    </>
  );
}
