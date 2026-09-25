import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MethodsView } from "@/components/methods/methods-view";

export const metadata: Metadata = { title: "Méthodes & essais" };

export default async function Page({ searchParams }: PageProps<"/methodes">) {
  const { onglet, nouvelle, projet, ref } = await searchParams;
  if (typeof ref === "string") redirect(`/methodes/${ref.toLowerCase()}`);
  const tab = onglet === "demandes" ? "demandes" : onglet === "resultats" ? "resultats" : "methodes";
  const slug = typeof projet === "string" ? projet.toLowerCase() : "cs-01";
  return <MethodsView key={`${slug}-${tab}-${nouvelle === "1" ? "n" : ""}`} slug={slug} initialTab={tab} openNewRequest={nouvelle === "1"} />;
}
