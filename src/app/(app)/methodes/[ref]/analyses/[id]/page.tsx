import type { Metadata } from "next";
import { AnalysisView } from "@/components/methods/analysis-view";

export const metadata: Metadata = { title: "Essai — saisie des résultats" };

export default async function Page({ params }: PageProps<"/methodes/[ref]/analyses/[id]">) {
  const { ref, id } = await params;
  return <AnalysisView slug={ref} analysisId={id} />;
}
