/** Helpers shared by the store actions and the lab reducers. */
import type { DemoState } from "./data";
import { DEMO_TODAY, nowTime } from "./format";
import type { HistoryEvent } from "./types";

let seq = 0;

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++seq}`;
export const pad2 = (n: number) => String(n).padStart(2, "0");
/** Demo date + current wall-clock time ("2026-09-24T14:32"). Call from event handlers only. */
export const stamp = () => `${DEMO_TODAY}T${nowTime()}`;

export function nextNumber(values: string[], pattern: RegExp) {
  const nums = values
    .map((v) => pattern.exec(v)?.[1])
    .filter((v): v is string => Boolean(v))
    .map(Number);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

export type NewEvent = Omit<HistoryEvent, "id" | "at" | "author"> & { author?: string; at?: string };

/** Appends a traceability event and touches the project's "last update" date. */
export function withEvent(s: DemoState, event: NewEvent): DemoState {
  const full: HistoryEvent = { id: uid("h"), at: stamp(), author: "Chef de projet", ...event };
  return {
    ...s,
    history: [full, ...s.history],
    projects: s.projects.map((p) => (p.code === event.projectCode ? { ...p, updatedAt: DEMO_TODAY } : p)),
  };
}

export function projectLabel(s: DemoState, code: string) {
  const p = s.projects.find((x) => x.code === code);
  return p ? `${p.code} • ${p.name}` : code;
}
