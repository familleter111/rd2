import type { Metadata } from "next";
import { ProjectPlanningView } from "@/components/project/project-planning";

export const metadata: Metadata = { title: "Planning des équipements" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/planning">) {
  const { code } = await params;
  const { jour, demande } = await searchParams;
  const day = typeof jour === "string" && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : "2026-10-07";
  const [resourceId, start, end] = typeof demande === "string" ? demande.split(",") : [];
  const request = resourceId && start && end ? { resourceId, date: day, start, end, method: resourceId.startsWith("HPLC") ? "M-01" : undefined } : undefined;
  return <ProjectPlanningView key={`${day}-${demande ?? ""}`} slug={code} initialDay={day} request={request} />;
}
