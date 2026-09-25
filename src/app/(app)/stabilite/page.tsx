import type { Metadata } from "next";
import { StabilityView } from "@/components/stability/stability-view";

export const metadata: Metadata = { title: "Études de stabilité" };

export default async function Page({ searchParams }: PageProps<"/stabilite">) {
  const { projet, onglet, etude } = await searchParams;
  const tab = onglet === "echeances" ? "echeances" : onglet === "alertes" ? "alertes" : "etudes";
  const slug = typeof projet === "string" ? projet.toLowerCase() : "cs-01";
  const study = typeof etude === "string" ? etude.toUpperCase() : undefined;
  return <StabilityView key={`${slug}-${tab}-${study ?? ""}`} slug={slug} initialTab={tab} initialStudy={study} />;
}
