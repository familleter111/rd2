import type { Metadata } from "next";
import { ComparisonView } from "@/components/project/comparison-view";

export const metadata: Metadata = { title: "Comparaison des formules" };

export default async function Page({ params, searchParams }: PageProps<"/projets/[code]/formules/comparaison">) {
  const { code } = await params;
  const { versions, decision, examen } = await searchParams;
  const list = typeof versions === "string" ? versions.split(",").filter(Boolean) : undefined;
  return (
    <ComparisonView
      key={`${versions?.toString() ?? "all"}-${examen === "1" ? "exam" : decision === "1" ? "decision" : ""}`}
      slug={code}
      versions={list}
      openDecision={decision === "1"}
      openExam={examen === "1"}
    />
  );
}
