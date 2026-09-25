import type { Metadata } from "next";
import { StudyView, type StudyTab } from "@/components/stability/study-view";

export const metadata: Metadata = { title: "Étude de stabilité" };

const TABS: StudyTab[] = ["protocole", "echeancier", "resultats", "documents", "historique"];

export default async function Page({ params, searchParams }: PageProps<"/stabilite/[id]">) {
  const { id } = await params;
  const { onglet, point } = await searchParams;
  const tab = TABS.find((t) => t === onglet) ?? "protocole";
  const resultId = typeof point === "string" ? point : undefined;
  return <StudyView key={`${id}-${tab}-${resultId ?? ""}`} id={id} initialTab={tab} initialPoint={resultId} />;
}
